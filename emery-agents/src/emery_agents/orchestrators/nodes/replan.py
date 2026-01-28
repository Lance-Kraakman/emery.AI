"""
Replan Node — Unified Decision Point

Replaces separate evaluate, handle_failure, and synthesize nodes.
After each step execution, this node decides what to do next:

1. Step failed → attempt recovery (auto-fix or ask user)
2. More pending steps → continue executing
3. All steps done → evaluate goal achievement
   - Goal achieved → synthesize final answer, finish
   - Not achieved + replans left → generate new steps
   - Not achieved + no replans → finish with what we have

Follows the reference LangGraph plan-and-execute pattern where replan
is the single decision point after each step.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import dspy

from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ...services.plan_service import PlanService
from ...services.execution.replan_handler import ReplanHandler, ReplanNeedsClarificationError
from ...services.execution.events import (
    EvaluationResult,
    EvaluationCompletedEvent,
    GoalAchievedEvent,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    ReplanTriggeredEvent,
    PlanUpdatedEvent,
    RecoveryAnalysisEvent,
    AutoFixStartedEvent,
    AutoFixCompletedEvent,
    RecoveryPlanProposedEvent,
    AwaitingClarificationEvent,
)
from ...reasoning.modules.evaluator import EvaluatorModule
from ...reasoning.config import get_dspy_lm
from ..state import PlanExecuteState
from ..runtime import RuntimeContext

logger = logging.getLogger(__name__)


async def replan_node(state: PlanExecuteState, runtime: RuntimeContext) -> Dict[str, Any]:
    """
    Unified decision point after each step execution.

    Handles evaluation, failure recovery, replanning, and synthesis
    in a single node — the graph routes based on the output.
    """
    plan = state.get("plan")
    error = state.get("error")
    replan_count = state.get("replan_count", 0)
    max_replans = state.get("max_replans", 3)
    org_model = state.get("org_model")

    events: List[Any] = []

    assert plan is not None, "Cannot replan without a plan"

    # Case 1: Step failed → attempt recovery
    if error:
        return await _handle_step_failure(state, runtime, events)

    # Case 2: More pending steps → continue executing
    pending = plan.get_pending_steps()
    if pending:
        return {"error": None, "events": events}

    # Case 3: All steps done → evaluate goal and decide
    evaluation = await _evaluate_progress(plan, org_model, events)

    if evaluation.goal_achieved:
        # Goal achieved — synthesize and finish
        return await _finish(plan, state, org_model, evaluation, events, runtime)

    if replan_count >= max_replans:
        # Max replans reached — finish with what we have
        logger.warning(f"Max replans ({max_replans}) reached, finishing")
        return await _finish(plan, state, org_model, evaluation, events, runtime)

    # Not done — replan to generate new steps
    return await _do_replan(state, runtime, error, replan_count, events)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _handle_step_failure(
    state: PlanExecuteState,
    runtime: RuntimeContext,
    events: List[Any],
) -> Dict[str, Any]:
    """
    Handle step failure with confidence-based recovery.

    Routes based on confidence:
    - HIGH (>=0.8): Auto-fix with notification, retry
    - MEDIUM (0.5-0.8): Propose fix for user approval
    - LOW (<0.5): Ask clarifying questions
    """
    plan = state.get("plan")
    error = state.get("error", "")
    ledger = state.get("ledger")
    organization_id = state.get("organization_id")

    org_model = runtime.org_model
    api_key = runtime.api_key
    capability_registry = runtime.capability_registry

    assert plan is not None

    # Find the failed step
    failed_step = None
    for step in plan.steps:
        if step.status == PlanStepStatus.FAILED.value:
            failed_step = step
            break

    if not failed_step or not ledger:
        logger.warning("No failed step or ledger — cannot recover")
        return {
            "awaiting_input": "recovery",
            "events": events,
        }

    logger.info(f"Attempting recovery for step '{failed_step.step_id}'")

    try:
        plan_service = PlanService()
        recovery = plan_service.analyze_step_failure(
            failed_step=failed_step,
            error_message=error or "",
            plan=plan,
            ledger=ledger,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
            capability_registry=capability_registry,
        )

        events.append(RecoveryAnalysisEvent(
            step_id=failed_step.step_id,
            confidence=recovery.confidence,
        ))

        if recovery.should_auto_fix:
            # HIGH CONFIDENCE: Auto-fix and retry
            logger.info(f"Auto-fixing step '{failed_step.step_id}' ({recovery.confidence:.0%})")
            events.append(AutoFixStartedEvent(
                step_id=failed_step.step_id,
                fix_description=recovery.reasoning,
                confidence=recovery.confidence,
            ))

            updated_step = failed_step.with_parameters(
                {**(failed_step.parameters or {}), **recovery.corrected_parameters}
            )
            updated_plan = plan.update_step(failed_step.step_id, updated_step)

            events.append(AutoFixCompletedEvent(
                step_id=failed_step.step_id,
                result="Recovery prepared — will retry step",
            ))

            return {
                "plan": updated_plan,
                "error": None,
                "events": events,
            }

        elif recovery.should_propose:
            # MEDIUM CONFIDENCE: Propose for approval
            logger.info(f"Proposing recovery ({recovery.confidence:.0%})")
            events.append(RecoveryPlanProposedEvent(
                step_id=failed_step.step_id,
                fix_description=recovery.reasoning,
                confidence=recovery.confidence,
                gathered_context={"corrected_parameters": recovery.corrected_parameters},
            ))
            return {
                "awaiting_input": "recovery",
                "events": events,
            }

        else:
            # LOW CONFIDENCE: Ask user
            logger.info(f"Low confidence ({recovery.confidence:.0%}), asking user")
            questions = recovery.questions or [
                "What would you like to do about this error?",
                "Should we retry, skip this step, or try a different approach?",
            ]
            events.append(AwaitingClarificationEvent(
                questions=questions,
                reasoning=f"Error: {error}\n\n{recovery.reasoning}",
            ))
            return {
                "awaiting_input": "recovery",
                "events": events,
            }

    except Exception as e:
        logger.error(f"Recovery analysis failed: {e}")
        events.append(AwaitingClarificationEvent(
            questions=[
                "What would you like to do about this error?",
                "Should we retry, skip this step, or try a different approach?",
            ],
            reasoning=f"Recovery analysis failed: {e}\n\nOriginal error: {error}",
        ))
        return {
            "awaiting_input": "recovery",
            "events": events,
        }


async def _evaluate_progress(
    plan: Plan,
    org_model: Optional[str],
    events: List[Any],
) -> EvaluationResult:
    """Evaluate goal achievement using DSPy EvaluatorModule."""
    try:
        goal = plan.goal

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

    events.append(EvaluationCompletedEvent(
        plan_id=plan.id,
        evaluation=evaluation,
        evaluation_number=1,
    ))

    if evaluation.goal_achieved:
        logger.info("Goal achieved")
        events.append(GoalAchievedEvent(plan_id=plan.id, reason=evaluation.reason))

    if evaluation.blocking_issues:
        logger.warning(f"Blocking issues: {evaluation.reason}")
        events.append(ExecutionBlockedEvent(plan_id=plan.id, reason=evaluation.reason))

    return evaluation


async def _finish(
    plan: Plan,
    state: PlanExecuteState,
    org_model: Optional[str],
    evaluation: EvaluationResult,
    events: List[Any],
    runtime: Optional[RuntimeContext] = None,
) -> Dict[str, Any]:
    """Synthesize final answer and finish execution."""
    success = evaluation.goal_achieved
    ledger = state.get("ledger")

    # Mark plan status
    if success:
        plan = plan.complete()
    else:
        plan = plan.fail()

    # Synthesize final answer
    final_response = None
    if ledger:
        try:
            final_response = await _synthesize_answer(plan, ledger, org_model)
            if final_response:
                events.append(FinalSynthesisEvent(
                    plan_id=plan.id,
                    synthesis=final_response,
                ))
        except Exception as e:
            logger.warning(f"Synthesis failed: {e}")

    # Auto-store task summary to memory
    if runtime and runtime.memory_service and final_response:
        try:
            task = state.get("task", "")
            runtime.memory_service.add(
                content=f"Task: {task[:200]}. Result: {final_response[:300]}",
                memory_type="fact",
                metadata={"auto_stored": True, "source": "task_completion"},
            )
        except Exception as e:
            logger.warning(f"Failed to auto-store task memory: {e}")

    events.append(ExecutionCompletedEvent(plan_id=plan.id, success=success))

    return {
        "plan": plan,
        "response": final_response or f"Execution {'completed' if success else 'finished with issues'}.",
        "success": success,
        "events": events,
    }


async def _synthesize_answer(
    plan: Plan,
    ledger: Any,
    org_model: Optional[str] = None,
) -> str:
    """Use DSPy evaluator to synthesize all step results into final answer."""
    step_results = ledger.get_step_results()
    if not step_results:
        return ""

    goal = plan.goal

    # Format results
    parts = []
    for step_id, result in step_results.items():
        step_state = ledger.steps.get(step_id)
        step_name = step_state.step_name if step_state else step_id
        result_text = result if result else "(completed with no output)"
        parts.append(f"### {step_name}\n{result_text}")
    formatted_results = "\n\n".join(parts)

    try:
        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()

        with dspy.context(lm=lm):
            result = await asyncio.to_thread(
                evaluator.synthesize_answer,
                goal,
                formatted_results,
                "",  # No curated context (ACE removed)
            )
        return str(result)
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        return formatted_results


async def _do_replan(
    state: PlanExecuteState,
    runtime: RuntimeContext,
    error: Optional[str],
    replan_count: int,
    events: List[Any],
) -> Dict[str, Any]:
    """Generate new steps via diff-based replanning."""
    plan = state.get("plan")
    org_model = state.get("org_model")
    tools = runtime.tools

    assert plan is not None

    replan_count += 1

    events.append(ReplanTriggeredEvent(
        plan_id=plan.id,
        reason=error or "Evaluation triggered replan",
        replan_number=replan_count,
    ))

    replan_handler = ReplanHandler(model_provider=None, org_model=org_model)
    old_pending_count = len(plan.get_pending_steps())

    try:
        updated_plan = await replan_handler.handle_replan(
            current_plan=plan,
            failed_step=None,
            reason=error or "Evaluation triggered replan",
            tools=tools,
        )
    except ReplanNeedsClarificationError as e:
        events.append(AwaitingClarificationEvent.from_dict_list(
            questions=e.questions,
            reasoning=e.reasoning or "Need more information to replan",
        ))
        return {
            "awaiting_input": "clarification",
            "clarifying_questions": e.questions,
            "replan_count": replan_count,
            "events": events,
        }

    new_pending_count = len(updated_plan.get_pending_steps())

    events.append(PlanUpdatedEvent(
        plan_id=plan.id,
        reason=error or "Evaluation triggered replan",
        added_steps=max(0, new_pending_count - old_pending_count),
        removed_steps=max(0, old_pending_count - new_pending_count),
        replan_number=replan_count,
    ))

    logger.info(f"Replan complete ({replan_count}): {new_pending_count} pending steps")

    if new_pending_count == 0:
        # Differ couldn't generate new steps — finish with what we have
        # instead of looping back to execute_step with nothing to execute
        logger.info("Replan produced no new steps, finishing")
        evaluation = await _evaluate_progress(updated_plan, org_model, events)
        return await _finish(updated_plan, state, org_model, evaluation, events, runtime)

    return {
        "plan": updated_plan,
        "replan_count": replan_count,
        "error": None,
        "events": events,
    }
