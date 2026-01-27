"""
Plan-and-Execute Graph

LangGraph implementation of the two-phase execution pattern:
  generate_plan -> await_approval -> execute_step -> evaluate -> (loop or synthesize)

Session-scoped: each session gets a graph with RuntimeContext bound to nodes via closures.
"""

import logging
from typing import Any, Dict, Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from ..state import PlanExecuteState, DEFAULT_STATE
from ..runtime import RuntimeContext
from ..nodes.planning import generate_plan_node, replan_node
from ..nodes.execution import execute_step_node
from ..nodes.evaluation import evaluate_node
from ..nodes.recovery import handle_failure_node
from ..nodes.human import await_approval_node
from ..nodes.synthesis import synthesize_node
from ...entities.models.task_ledger import create_ledger_from_plan
from ...services.execution.events import PlanCreatedEvent, PlanApprovedEvent

logger = logging.getLogger(__name__)


# ============================================================
# Routing Functions (conditional edges)
# ============================================================


def route_after_plan(state: PlanExecuteState) -> str:
    """Route after plan generation."""
    error = state.get("error")
    if error:
        return "end"

    awaiting = state.get("awaiting_input")
    if awaiting in ("approval", "clarification"):
        return "await_approval"

    # No plan generated (shouldn't happen, but handle gracefully)
    return "end"


def route_after_approval(state: PlanExecuteState) -> str:
    """Route after human approval/clarification/feedback."""
    error = state.get("error")
    if error:
        # Plan rejected or other error
        return "end"

    # If plan was cleared (feedback), re-generate
    plan = state.get("plan")
    if plan is None:
        return "generate_plan"

    # If plan is approved and in executing status, start executing
    return "execute_step"


def route_after_eval(state: PlanExecuteState) -> str:
    """Route after evaluation using explicit boolean fields."""
    goal_achieved = state.get("eval_goal_achieved", False)
    has_blocking = state.get("eval_has_blocking_issues", False)
    needs_replan = state.get("eval_needs_replan", False)
    should_continue = state.get("eval_should_continue", False)

    if goal_achieved:
        return "done"

    if has_blocking:
        return "done"

    if needs_replan:
        return "needs_replan"

    if should_continue:
        plan = state.get("plan")
        if plan and plan.get_pending_steps():
            return "continue"
        # No more steps but should continue -> auto-replan
        replan_count = state.get("replan_count", 0)
        max_replans = state.get("max_replans", 3)
        if replan_count < max_replans:
            return "needs_replan"

    return "done"


def route_after_step(state: PlanExecuteState) -> str:
    """Route after step execution."""
    # Check for error (step failed)
    error = state.get("error")
    if error:
        return "step_failed"

    # Check if we should evaluate
    steps_since_eval = state.get("steps_since_eval", 0)
    evaluate_after = state.get("evaluate_after_steps", 1)
    if steps_since_eval >= evaluate_after:
        return "evaluate"

    # Check for more pending steps
    plan = state.get("plan")
    if plan and plan.get_pending_steps():
        return "continue"

    # No more steps, do final evaluation
    return "evaluate"


def route_after_failure(state: PlanExecuteState) -> str:
    """Route after failure recovery."""
    awaiting = state.get("awaiting_input")
    if awaiting in ("recovery", "clarification"):
        return "ask_user"

    # Auto-fix succeeded, error cleared
    error = state.get("error")
    if error is None:
        return "auto_fix"

    return "ask_user"


def route_after_replan(state: PlanExecuteState) -> str:
    """Route after replanning."""
    awaiting = state.get("awaiting_input")
    if awaiting == "clarification":
        return "needs_clarification"

    return "execute"


def route_entry(state: PlanExecuteState) -> str:
    """Route at graph entry - handle autonomous vs interactive mode."""
    stored_plan = state.get("stored_plan")
    if stored_plan:
        return "autonomous"
    return "interactive"


async def handle_autonomous_entry(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Set up autonomous mode with stored plan.

    Replaces ExecutionCoordinator.execute() autonomous branch.
    """
    stored_plan = state.get("stored_plan")
    assert stored_plan is not None, "Autonomous entry requires a stored_plan"

    events = [
        PlanCreatedEvent(plan_id=stored_plan.id, plan=stored_plan),
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

    Args:
        runtime: RuntimeContext with non-serializable objects (tools, registries, etc.)
        checkpointer: Optional checkpointer for persistence.
            Defaults to MemorySaver (in-memory, for development).

    Returns:
        Compiled LangGraph that can be invoked with ainvoke() or astream().
    """
    # Create closure-wrapped node functions that bind runtime
    async def _generate_plan(state: PlanExecuteState) -> Dict[str, Any]:
        return await generate_plan_node(state, runtime)

    async def _execute_step(state: PlanExecuteState) -> Dict[str, Any]:
        return await execute_step_node(state, runtime)

    async def _replan(state: PlanExecuteState) -> Dict[str, Any]:
        return await replan_node(state, runtime)

    async def _handle_failure(state: PlanExecuteState) -> Dict[str, Any]:
        return await handle_failure_node(state, runtime)

    async def _synthesize(state: PlanExecuteState) -> Dict[str, Any]:
        return await synthesize_node(state, runtime)

    graph = StateGraph(PlanExecuteState)

    # === Nodes (runtime-bound via closures) ===
    graph.add_node("setup_autonomous", handle_autonomous_entry)
    graph.add_node("generate_plan", _generate_plan)
    graph.add_node("await_approval", await_approval_node)  # No runtime needed
    graph.add_node("execute_step", _execute_step)
    graph.add_node("evaluate", evaluate_node)  # No runtime needed (reads org_model from state)
    graph.add_node("handle_failure", _handle_failure)
    graph.add_node("replan", _replan)
    graph.add_node("synthesize", _synthesize)

    # === Entry point ===
    # Route based on whether we have a stored plan (autonomous) or not (interactive)
    graph.set_conditional_entry_point(route_entry, {
        "autonomous": "setup_autonomous",
        "interactive": "generate_plan",
    })

    # === Autonomous flow ===
    graph.add_edge("setup_autonomous", "execute_step")

    # === Plan generation ===
    graph.add_conditional_edges("generate_plan", route_after_plan, {
        "await_approval": "await_approval",
        "end": END,
    })

    # === Human approval ===
    graph.add_conditional_edges("await_approval", route_after_approval, {
        "execute_step": "execute_step",
        "generate_plan": "generate_plan",
        "end": END,
    })

    # === Step execution ===
    graph.add_conditional_edges("execute_step", route_after_step, {
        "evaluate": "evaluate",
        "continue": "execute_step",
        "step_failed": "handle_failure",
    })

    # === Evaluation ===
    graph.add_conditional_edges("evaluate", route_after_eval, {
        "continue": "execute_step",
        "needs_replan": "replan",
        "done": "synthesize",
    })

    # === Failure recovery ===
    graph.add_conditional_edges("handle_failure", route_after_failure, {
        "auto_fix": "execute_step",
        "ask_user": "await_approval",
    })

    # === Replanning ===
    graph.add_conditional_edges("replan", route_after_replan, {
        "execute": "execute_step",
        "needs_clarification": "await_approval",
    })

    # === Synthesis (terminal) ===
    graph.add_edge("synthesize", END)

    # === Compile ===
    if checkpointer is None:
        checkpointer = MemorySaver()

    compiled = graph.compile(checkpointer=checkpointer)

    logger.info("Session plan-execute graph compiled successfully")

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
