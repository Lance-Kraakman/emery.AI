"""
Plan-and-Execute Graph

LangGraph implementation of the two-phase execution pattern:
  generate_plan -> await_approval -> execute_step -> evaluate -> (loop or synthesize)

Replaces ExecutionCoordinator with a declarative graph.
"""

import logging
from typing import Any, Dict, Literal, Optional, cast

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from ..state import PlanExecuteState, DEFAULT_STATE
from ..nodes.planning import generate_plan_node, replan_node
from ..nodes.execution import execute_step_node
from ..nodes.evaluation import evaluate_node
from ..nodes.recovery import handle_failure_node
from ..nodes.human import await_approval_node
from ..nodes.synthesis import synthesize_node
from ...entities.models.task_ledger import create_ledger_from_plan
from ...services.execution.events import EvaluationResult, PlanCreatedEvent, PlanApprovedEvent

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
    """Route after evaluation."""
    # Get evaluation from state (stored by evaluate_node as _evaluation)
    evaluation: EvaluationResult | None = cast(Optional[EvaluationResult], state.get("_evaluation"))

    if evaluation is None:
        # No evaluation available, continue executing
        plan = state.get("plan")
        if plan and plan.get_pending_steps():
            return "continue"
        return "done"

    if evaluation.goal_achieved:
        return "done"

    if evaluation.blocking_issues:
        return "done"

    if evaluation.needs_replan:
        return "needs_replan"

    if evaluation.should_continue:
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

    # Check for clarification needed
    awaiting = state.get("awaiting_input")
    if awaiting == "clarification":
        return "needs_clarification"

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


def handle_autonomous_entry(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Set up autonomous mode with stored plan.

    Replaces ExecutionCoordinator.execute() autonomous branch.
    """
    stored_plan = state["stored_plan"]
    assert stored_plan is not None

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
# Graph Construction
# ============================================================


def create_plan_execute_graph(
    checkpointer: Optional[Any] = None,
) -> Any:
    """
    Create the plan-and-execute LangGraph.

    Args:
        checkpointer: Optional checkpointer for persistence.
            Defaults to MemorySaver (in-memory, for development).

    Returns:
        Compiled LangGraph that can be invoked with ainvoke() or astream().
    """
    graph = StateGraph(PlanExecuteState)

    # === Nodes ===
    graph.add_node("setup_autonomous", handle_autonomous_entry)
    graph.add_node("generate_plan", generate_plan_node)
    graph.add_node("await_approval", await_approval_node)
    graph.add_node("execute_step", execute_step_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("handle_failure", handle_failure_node)
    graph.add_node("replan", replan_node)
    graph.add_node("synthesize", synthesize_node)

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
        "needs_clarification": "await_approval",
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

    logger.info("Plan-execute graph compiled successfully")

    return compiled


def create_plan_only_graph(
    checkpointer: Optional[Any] = None,
) -> Any:
    """
    Create a plan-only LangGraph (no execution).

    Used by GeneratePlan RPC for skill editor plan generation.
    Generates a plan and stops — no approval or execution.

    Args:
        checkpointer: Optional checkpointer for persistence.

    Returns:
        Compiled LangGraph that terminates after plan generation.
    """
    graph = StateGraph(PlanExecuteState)

    # Only needs planning and approval nodes
    graph.add_node("generate_plan", generate_plan_node)
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

    logger.info("Plan-only graph compiled successfully")

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
