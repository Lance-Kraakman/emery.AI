"""
Evaluation Node

Evaluates progress after step execution using DSPy EvaluatorModule.
Determines whether to continue, replan, or finish.
"""

import asyncio
import logging
from typing import Any, Dict, List

import dspy

from ...entities.models.plan import PlanStepStatus
from ...reasoning.modules.evaluator import EvaluatorModule
from ...reasoning.config import get_dspy_lm
from ...services.execution.events import (
    EvaluationResult,
    EvaluationCompletedEvent,
    GoalAchievedEvent,
    ExecutionBlockedEvent,
)
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def evaluate_node(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Evaluate progress using DSPy EvaluatorModule.

    Replaces ExecutionCoordinator._evaluate_progress().
    Runs after each step (or batch of steps based on evaluate_after_steps).
    """
    plan = state["plan"]
    evaluation_count = state.get("evaluation_count", 0)
    org_model = state.get("org_model")
    ledger = state.get("ledger")

    events: List[Any] = []

    assert plan is not None, "Cannot evaluate without a plan"

    evaluation_count += 1

    try:
        goal = plan.goal

        # Get plan steps and results
        plan_steps: List[str] = []
        step_results: List[str] = []

        for step in plan.steps:
            plan_steps.append(step.description)
            if step.result:
                step_results.append(step.result)
            elif step.status == PlanStepStatus.FAILED.value:
                step_results.append(f"FAILED: {step.error or 'Unknown error'}")
            else:
                step_results.append("Pending")

        # Get DSPy LM and run evaluator
        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()

        with dspy.context(lm=lm):
            result = await asyncio.to_thread(
                evaluator.evaluate_goal,
                goal,
                plan_steps,
                step_results,
            )

        evaluation = EvaluationResult(
            goal_achieved=result.achieved,
            blocking_issues=len(result.blockers) > 0,
            should_continue=not result.achieved and len(result.remaining_items) > 0,
            needs_replan=len(result.blockers) > 0 and not result.achieved,
            reason=f"Confidence: {result.confidence:.0%}. " + (
                f"Blockers: {', '.join(result.blockers)}" if result.blockers
                else f"Remaining: {', '.join(result.remaining_items)}" if result.remaining_items
                else "Goal achieved"
            ),
        )

    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        evaluation = EvaluationResult(
            goal_achieved=False,
            blocking_issues=False,
            should_continue=True,
            needs_replan=False,
            reason=f"Evaluation error: {e}",
        )

    # Record evaluation in ledger
    if ledger:
        ledger.record_evaluation(evaluation.__dict__)

    events.append(EvaluationCompletedEvent(
        plan_id=plan.id,
        evaluation=evaluation,
        evaluation_number=evaluation_count,
    ))

    # Add goal achieved or blocked events
    if evaluation.goal_achieved:
        logger.info("Goal achieved, stopping execution early")
        events.append(GoalAchievedEvent(
            plan_id=plan.id,
            reason=evaluation.reason,
        ))

    if evaluation.blocking_issues:
        logger.warning(f"Blocking issues detected: {evaluation.reason}")
        events.append(ExecutionBlockedEvent(
            plan_id=plan.id,
            reason=evaluation.reason,
        ))

    return {
        "evaluation_count": evaluation_count,
        "steps_since_eval": 0,  # Reset counter
        "ledger": ledger,
        # Store evaluation result for routing
        "_evaluation": evaluation,
        "events": events,
    }
