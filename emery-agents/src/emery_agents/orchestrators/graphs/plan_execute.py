"""
Plan-and-Execute Graph

LangGraph implementation with triage-first routing:
  triage -> direct_execute | generate_plan -> await_approval -> execute_step -> replan

Session-scoped: each session gets a graph with RuntimeContext bound to nodes via closures.

Graph architecture (7 nodes):
  - triage: Classifies task with discovery tools, routes to direct/plan/respond
  - direct_execute: Single ReAct loop for simple tasks, can escalate to plan
  - setup_autonomous: Sets up autonomous mode with pre-approved plan
  - generate_plan: Creates plan from task, may request clarification
  - await_approval: Human-in-the-loop (approval, clarification, recovery)
  - execute_step: Executes one plan step
  - replan: Evaluates progress, handles failures, replans, or synthesizes final answer
"""

import logging
from typing import Any, Dict, Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from ..state import PlanExecuteState, DEFAULT_STATE
from ..runtime import RuntimeContext
from ..nodes.planning import generate_plan_node
from ..nodes.execution import execute_step_node
from ..nodes.replan import replan_node
from ..nodes.human import await_approval_node
from ..nodes.triage import triage_node
from ..nodes.direct import direct_execute_node
from ...entities.models.task_ledger import create_ledger_from_plan
from ...services.execution.events import PlanCreatedEvent, PlanApprovedEvent

logger = logging.getLogger(__name__)


# ============================================================
# Routing Functions (conditional edges)
# ============================================================


def route_entry(state: PlanExecuteState) -> str:
    """Route at graph entry — handle autonomous vs interactive mode."""
    stored_plan = state.get("stored_plan")
    if stored_plan:
        return "autonomous"
    return "interactive"


def route_after_plan(state: PlanExecuteState) -> str:
    """Route after plan generation."""
    error = state.get("error")
    if error:
        return "end"

    awaiting = state.get("awaiting_input")
    if awaiting in ("approval", "clarification"):
        return "await_approval"

    return "end"


def route_after_approval(state: PlanExecuteState) -> str:
    """Route after human approval/clarification/feedback."""
    error = state.get("error")
    if error:
        return "end"

    # If plan was cleared (feedback), re-generate
    plan = state.get("plan")
    if plan is None:
        return "generate_plan"

    # Plan approved — start executing
    return "execute_step"


def route_after_triage(state: PlanExecuteState) -> str:
    """Route based on triage decision."""
    mode = state.get("execution_mode", "plan")

    # "respond" sets response directly in triage node
    if mode == "respond" or state.get("response"):
        return "end"

    if mode == "direct":
        return "direct_execute"

    return "generate_plan"


def route_after_direct(state: PlanExecuteState) -> str:
    """Route after direct execution: done, clarify, or escalate to plan."""
    # Clarification needed
    if state.get("awaiting_input"):
        return "await_approval"

    # Success — response set
    if state.get("response"):
        return "end"

    # Escalation — direct failed, try full planning
    if state.get("execution_mode") == "plan":
        return "generate_plan"

    return "end"


def route_after_replan(state: PlanExecuteState) -> str:
    """Route after replan: done, continue, or ask user."""
    # Final answer ready
    if state.get("response"):
        return "end"

    # Needs user input (recovery, clarification)
    if state.get("awaiting_input"):
        return "await_approval"

    # More steps to run (continue or retry after auto-fix)
    return "execute_step"


async def handle_autonomous_entry(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Set up autonomous mode with stored plan.

    Pre-approved plan skips the approval step and goes straight to execution.
    """
    stored_plan = state.get("stored_plan")
    assert stored_plan is not None, "Autonomous entry requires a stored_plan"

    # Only emit PlanApprovedEvent - skip PlanCreatedEvent since plan is pre-approved
    # PlanCreatedEvent would trigger awaiting_input UI which causes approval loop
    events = [
        PlanApprovedEvent(plan_id=stored_plan.id),
    ]

    # Create ledger
    ledger = create_ledger_from_plan(
        task_id=stored_plan.id,
        goal=stored_plan.goal,
        plan_steps=[{"step_id": s.step_id, "description": s.description} for s in stored_plan.steps],
    )
    ledger.record_plan_created({"plan_id": stored_plan.id, "step_count": len(stored_plan.steps)})
    ledger.record_plan_approved()

    # Start execution
    executing_plan = stored_plan.start_execution()

    logger.info(
        f"Autonomous mode: executing stored plan '{stored_plan.id}' "
        f"with {len(stored_plan.steps)} steps"
    )

    return {
        "plan": executing_plan,
        "ledger": ledger,
        "awaiting_input": None,
        "events": events,
    }


# ============================================================
# Graph Construction — Session-Scoped
# ============================================================


def create_session_graph(
    runtime: RuntimeContext,
    checkpointer: Optional[Any] = None,
) -> Any:
    """
    Create a session-scoped plan-and-execute LangGraph.

    Non-serializable runtime objects are bound to nodes via closures.
    Each session (thread_id) gets its own graph + runtime.

    Graph: 7 nodes with triage-first routing.
    Entry: triage → (direct_execute | generate_plan | END)
    Direct can escalate to plan. Plan follows approve → execute → replan loop.

    Args:
        runtime: RuntimeContext with non-serializable objects (tools, registries, etc.)
        checkpointer: Optional checkpointer for persistence.
            Defaults to MemorySaver (in-memory, for development).

    Returns:
        Compiled LangGraph that can be invoked with ainvoke() or astream().
    """
    # Create closure-wrapped node functions that bind runtime
    async def _triage(state: PlanExecuteState) -> Dict[str, Any]:
        return await triage_node(state, runtime)

    async def _direct_execute(state: PlanExecuteState) -> Dict[str, Any]:
        return await direct_execute_node(state, runtime)

    async def _generate_plan(state: PlanExecuteState) -> Dict[str, Any]:
        return await generate_plan_node(state, runtime)

    async def _execute_step(state: PlanExecuteState) -> Dict[str, Any]:
        return await execute_step_node(state, runtime)

    async def _replan(state: PlanExecuteState) -> Dict[str, Any]:
        return await replan_node(state, runtime)

    graph = StateGraph(PlanExecuteState)

    # === Nodes (7 total) ===
    graph.add_node("triage", _triage)
    graph.add_node("direct_execute", _direct_execute)
    graph.add_node("setup_autonomous", handle_autonomous_entry)
    graph.add_node("generate_plan", _generate_plan)
    graph.add_node("await_approval", await_approval_node)  # No runtime needed
    graph.add_node("execute_step", _execute_step)
    graph.add_node("replan", _replan)

    # === Entry point: triage or autonomous ===
    graph.set_conditional_entry_point(route_entry, {
        "autonomous": "setup_autonomous",
        "interactive": "triage",
    })

    # === Triage routing ===
    graph.add_conditional_edges("triage", route_after_triage, {
        "direct_execute": "direct_execute",
        "generate_plan": "generate_plan",
        "end": END,
    })

    # === Direct execution routing (with escalation + clarification) ===
    graph.add_conditional_edges("direct_execute", route_after_direct, {
        "generate_plan": "generate_plan",
        "await_approval": "await_approval",
        "end": END,
    })

    # === Autonomous → execute ===
    graph.add_edge("setup_autonomous", "execute_step")

    # === Plan → approve ===
    graph.add_conditional_edges("generate_plan", route_after_plan, {
        "await_approval": "await_approval",
        "end": END,
    })

    # === Approve → execute or re-plan ===
    graph.add_conditional_edges("await_approval", route_after_approval, {
        "execute_step": "execute_step",
        "generate_plan": "generate_plan",
        "end": END,
    })

    # === Execute → replan (always) ===
    graph.add_edge("execute_step", "replan")

    # === Replan → execute, ask user, or end ===
    graph.add_conditional_edges("replan", route_after_replan, {
        "execute_step": "execute_step",
        "await_approval": "await_approval",
        "end": END,
    })

    # === Compile ===
    if checkpointer is None:
        checkpointer = MemorySaver()

    compiled = graph.compile(checkpointer=checkpointer)

    logger.info("Session plan-execute graph compiled successfully (7 nodes)")

    return compiled


def create_session_plan_only_graph(
    runtime: RuntimeContext,
    checkpointer: Optional[Any] = None,
) -> Any:
    """
    Create a session-scoped plan-only LangGraph (no execution).

    Used by GeneratePlan RPC for skill editor plan generation.
    Generates a plan and stops — no approval or execution.

    Args:
        runtime: RuntimeContext with non-serializable objects.
        checkpointer: Optional checkpointer for persistence.

    Returns:
        Compiled LangGraph that terminates after plan generation.
    """
    async def _generate_plan(state: PlanExecuteState) -> Dict[str, Any]:
        return await generate_plan_node(state, runtime)

    graph = StateGraph(PlanExecuteState)

    # Only needs planning and approval nodes
    graph.add_node("generate_plan", _generate_plan)
    graph.add_node("await_approval", await_approval_node)

    # Entry
    graph.set_entry_point("generate_plan")

    # After plan generation: if clarification needed, go to await_approval then re-plan.
    # Otherwise terminate (plan created or error).
    graph.add_conditional_edges("generate_plan", route_after_plan, {
        "await_approval": "await_approval",
        "end": END,
    })

    # After clarification: re-generate plan or terminate
    graph.add_conditional_edges("await_approval", route_after_approval_plan_only, {
        "generate_plan": "generate_plan",
        "end": END,
    })

    if checkpointer is None:
        checkpointer = MemorySaver()

    compiled = graph.compile(checkpointer=checkpointer)

    logger.info("Session plan-only graph compiled successfully")

    return compiled


def route_after_approval_plan_only(state: PlanExecuteState) -> str:
    """Route after approval in plan-only mode. Never executes — just re-plans or ends."""
    error = state.get("error")
    if error:
        return "end"

    plan = state.get("plan")
    if plan is None:
        # Feedback or clarification — re-generate
        return "generate_plan"

    # Plan exists (approved or created) — we're done in plan-only mode
    return "end"
