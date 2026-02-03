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
import dataclasses
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
    ReflectionCompletedEvent,
    AwaitingClarificationEvent,
)
from ...reasoning.modules.evaluator import EvaluatorModule
from ...reasoning.config import get_dspy_lm
from ...reasoning.utils import StepOutcome
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
    raw_outcomes = state.get("step_outcomes", {})
    outcomes: Dict[str, StepOutcome] = {
        k: StepOutcome.from_dict(v) for k, v in raw_outcomes.items()
    }

    events: List[Any] = []

    assert plan is not None, "Cannot replan without a plan"

    # Case 1: Step failed → attempt recovery
    if error:
        return await _handle_step_failure(state, runtime, events)

    # Reflect on the last completed step (Reflexion pattern)
    step_reflections = dict(state.get("step_reflections", {}))
    reflection_summary = state.get("reflection_summary", "")

    last_completed = _get_last_completed_step(plan)
    if last_completed:
        reflection_dict = await _reflect_on_step(last_completed, plan, state, events)
        if reflection_dict is not None:
            step_reflections[last_completed.step_id] = reflection_dict
            reflection_summary = _update_reflection_summary(
                reflection_summary, last_completed.step_id, reflection_dict,
            )

    # Case 2: More pending steps → enrich next step with reflections, continue
    pending = plan.get_pending_steps()
    if pending:
        plan = _enrich_next_step_with_reflections(plan, reflection_summary)
        return {
            "plan": plan,
            "step_reflections": step_reflections,
            "reflection_summary": reflection_summary,
            "error": None,
            "events": events,
        }

    # Case 3: All steps done → evaluate goal and decide
    evaluation = await _evaluate_progress(plan, org_model, events, outcomes)

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
# Reflection helpers (Reflexion pattern)
# ---------------------------------------------------------------------------


def _get_last_completed_step(plan: Plan) -> Optional[PlanStep]:
    """Return the most recently completed step, or None."""
    completed = [s for s in plan.steps if s.status == PlanStepStatus.COMPLETED.value]
    return completed[-1] if completed else None


async def _reflect_on_step(
    step: PlanStep,
    plan: Plan,
    state: PlanExecuteState,
    events: List[Any],
) -> Optional[Dict[str, Any]]:
    """Reflect on a completed step and return the reflection dict.

    Returns None if the step was already reflected on (deduplication for LangGraph resume).
    """
    existing_reflections = state.get("step_reflections", {})
    if step.step_id in existing_reflections:
        return None  # Already reflected — skip (handles LangGraph resume)

    org_model = state.get("org_model")
    raw_outcomes = state.get("step_outcomes", {})

    # Build tool evidence from step outcome
    tool_evidence = ""
    outcome_dict = raw_outcomes.get(step.step_id)
    if outcome_dict:
        outcome = StepOutcome.from_dict(outcome_dict)
        evidence = outcome.format_evidence()
        if evidence:
            tool_evidence = evidence

    try:
        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()

        with dspy.context(lm=lm):
            reflection = await asyncio.to_thread(
                evaluator.reflect_on_step,
                step_description=step.description,
                step_result=step.result or "(no output)",
                tool_evidence=tool_evidence,
                plan_goal=plan.goal,
                previous_reflections=state.get("reflection_summary", ""),
            )

        reflection_dict = reflection.model_dump()

        events.append(ReflectionCompletedEvent(
            step_id=step.step_id,
            quality_score=reflection.quality_score,
            was_suboptimal=reflection.was_suboptimal,
            pattern_learned=reflection.pattern_learned,
        ))

        return reflection_dict

    except Exception as e:
        logger.warning(f"Reflection failed for step {step.step_id}: {e}")
        return None


def _update_reflection_summary(
    current_summary: str,
    step_id: str,
    reflection_dict: Dict[str, Any],
) -> str:
    """Append a new insight to the rolling summary, truncating oldest if over 1500 chars."""
    pattern = reflection_dict.get("pattern_learned", "")
    improvement = reflection_dict.get("what_could_improve", "")

    insight = ""
    if pattern:
        insight = f"[{step_id}] {pattern}"
    elif improvement:
        insight = f"[{step_id}] {improvement}"

    if not insight:
        return current_summary

    if current_summary:
        updated = f"{current_summary}\n{insight}"
    else:
        updated = insight

    # Truncate oldest lines if over 1500 chars
    while len(updated) > 1500:
        newline_idx = updated.find("\n")
        if newline_idx == -1:
            updated = updated[-1500:]
            break
        updated = updated[newline_idx + 1:]

    return updated


def _enrich_next_step_with_reflections(
    plan: Plan,
    reflection_summary: str,
) -> Plan:
    """Append rolling reflection summary to the next pending step's description."""
    if not reflection_summary:
        return plan

    pending = plan.get_pending_steps()
    if not pending:
        return plan

    next_step = pending[0]
    # Avoid double-appending if already enriched
    if "[INSIGHTS FROM PREVIOUS STEPS]" in next_step.description:
        return plan

    enriched_desc = (
        f"{next_step.description}\n\n"
        f"[INSIGHTS FROM PREVIOUS STEPS]\n{reflection_summary}"
    )
    updated_step = dataclasses.replace(next_step, description=enriched_desc)
    return plan.update_step(next_step.step_id, updated_step)


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
    step_outcomes: Optional[Dict[str, StepOutcome]] = None,
) -> EvaluationResult:
    """Evaluate goal achievement using DSPy EvaluatorModule."""
    try:
        goal = plan.goal

        plan_steps: List[str] = []
        step_results: List[str] = []

        for step in plan.steps:
            plan_steps.append(step.description)
            if step.status == PlanStepStatus.COMPLETED.value:
                step_results.append(f"[COMPLETED] {step.result or 'Done'}")
            elif step.status == PlanStepStatus.FAILED.value:
                step_results.append(f"[FAILED] {step.error or 'Unknown error'}")
            elif step.status == PlanStepStatus.IN_PROGRESS.value:
                step_results.append("[IN_PROGRESS]")
            else:
                step_results.append("[PENDING]")

        # Collect structured outcomes for evaluator (preserves typed data)
        outcomes_list: List[StepOutcome] = []
        if step_outcomes:
            for step in plan.steps:
                outcome = step_outcomes.get(step.step_id)
                if outcome:
                    outcomes_list.append(outcome)

        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()

        with dspy.context(lm=lm):
            result = await asyncio.to_thread(
                evaluator.evaluate_goal,
                goal,
                plan_steps,
                step_results,
                outcomes_list,
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

    # Save final plan state to filesystem
    if runtime and runtime.plan_file_repository:
        try:
            runtime.plan_file_repository.save(plan)
        except Exception as e:
            logger.warning(f"Failed to save final plan to filesystem: {e}")

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

    # Save updated plan to filesystem
    if runtime.plan_file_repository:
        try:
            runtime.plan_file_repository.save(updated_plan)
        except Exception as e:
            logger.warning(f"Failed to save replanned plan: {e}")

    if new_pending_count == 0:
        # Differ couldn't generate new steps — finish with what we have
        # instead of looping back to execute_step with nothing to execute
        logger.info("Replan produced no new steps, finishing")
        raw = state.get("step_outcomes", {})
        replan_outcomes: Dict[str, StepOutcome] = {
            k: StepOutcome.from_dict(v) for k, v in raw.items()
        }
        evaluation = await _evaluate_progress(
            updated_plan, org_model, events, replan_outcomes
        )
        return await _finish(updated_plan, state, org_model, evaluation, events, runtime)

    return {
        "plan": updated_plan,
        "replan_count": replan_count,
        "error": None,
        "events": events,
    }
