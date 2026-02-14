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
from typing import Any

import dspy

from ...ace.models.strategy_accumulation import StrategyOutcome
from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ...reasoning.config import get_dspy_lm
from ...reasoning.modules.evaluator import EvaluatorModule
from ...reasoning.utils import StepOutcome
from ...services.analysis.llm_usage import LlmUsageTracker, record_from_lm
from ...services.execution.events import (
    AutoFixCompletedEvent,
    AwaitingClarificationEvent,
    EvaluationCompletedEvent,
    EvaluationResult,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    GoalAchievedEvent,
    PlanUpdatedEvent,
    RecoveryAnalysisEvent,
    RecoveryPlanProposedEvent,
    ReflectionCompletedEvent,
    ReplanTriggeredEvent,
)
from ...services.execution.replan_handler import (
    ReplanHandler,
    ReplanNeedsClarificationError,
)
from ..runtime import RuntimeContext
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def replan_node(
    state: PlanExecuteState, runtime: RuntimeContext
) -> dict[str, Any]:
    """
    Unified decision point after each step execution.
    Handles evaluation, failure recovery, replanning, and synthesis.
    """
    plan = state.get("plan")
    error = state.get("error")
    replan_count = state.get("replan_count", 0)
    max_replans = state.get("max_replans", 3)
    org_model = state.get("org_model")
    raw_outcomes = state.get("step_outcomes", {})
    outcomes: dict[str, StepOutcome] = {
        k: StepOutcome.from_dict(v) for k, v in raw_outcomes.items()
    }

    events: list[Any] = []

    assert plan is not None, "Cannot replan without a plan"

    if not runtime.token_accumulator:
        raise ValueError("TokenAccumulator is required for replanning.")
    tracker = runtime.token_accumulator.get_llm_tracker()

    # Check for human skill interrupt FIRST - don't proceed with replan logic.
    # Human skill sets awaiting_input but step is "in_progress" (not "pending"),
    # so get_pending_steps() would return empty and we'd incorrectly finish the plan.
    # Instead, pass through to await_approval node which will call interrupt().
    if state.get("awaiting_input") == "human_skill":
        logger.info("Human skill awaiting input - deferring to await_approval node")
        return {"events": events}

    if error:
        return await _handle_step_failure(state, runtime, events, tracker)

    step_reflections = dict(state.get("step_reflections", {}))
    reflection_summary = state.get("reflection_summary", "")

    last_completed = _get_last_completed_step(plan)
    if last_completed and _should_reflect(last_completed, plan):
        reflection_dict = await _reflect_on_step(
            last_completed, plan, state, events, tracker
        )
        if reflection_dict is not None:
            step_reflections[last_completed.step_id] = reflection_dict
            reflection_summary = _update_reflection_summary(
                reflection_summary, last_completed.step_id, reflection_dict
            )

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

    evaluation = await _evaluate_progress(plan, org_model, events, outcomes, tracker)

    if evaluation.goal_achieved:
        return await _finish(
            plan, state, org_model, evaluation, events, runtime, tracker
        )

    if replan_count >= max_replans:
        logger.warning(f"Max replans ({max_replans}) reached, finishing")
        return await _finish(
            plan, state, org_model, evaluation, events, runtime, tracker
        )

    return await _do_replan(state, runtime, error, replan_count, events, tracker)


def _get_last_completed_step(plan: Plan) -> PlanStep | None:
    completed = [s for s in plan.steps if s.status == PlanStepStatus.COMPLETED.value]
    return completed[-1] if completed else None


def _should_reflect(step: PlanStep, plan: Plan) -> bool:
    if len(plan.steps) > 5:
        return True
    result = (step.result or "").strip()
    if len(result) < 20:
        return True
    return step.replan_after or False


async def _reflect_on_step(
    step: PlanStep,
    plan: Plan,
    state: PlanExecuteState,
    events: list[Any],
    tracker: LlmUsageTracker,
) -> dict[str, Any] | None:
    existing_reflections = state.get("step_reflections", {})
    if step.step_id in existing_reflections:
        return None

    org_model = state.get("org_model")
    raw_outcomes = state.get("step_outcomes", {})
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
        record_from_lm(lm, tracker)
        reflection_dict = reflection.model_dump()
        events.append(
            ReflectionCompletedEvent(
                step_id=step.step_id,
                quality_score=reflection.quality_score,
                was_suboptimal=reflection.was_suboptimal,
                pattern_learned=reflection.pattern_learned,
            )
        )
        return reflection_dict
    except Exception as e:
        logger.warning(f"Reflection failed for step {step.step_id}: {e}")
        return None


def _update_reflection_summary(
    current_summary: str, step_id: str, reflection_dict: dict[str, Any]
) -> str:
    pattern = reflection_dict.get("pattern_learned", "")
    improvement = reflection_dict.get("what_could_improve", "")
    insight = (
        f"[{step_id}] {pattern}"
        if pattern
        else f"[{step_id}] {improvement}"
        if improvement
        else ""
    )
    if not insight:
        return current_summary
    updated = f"{current_summary}\n{insight}" if current_summary else insight
    while len(updated) > 1500:
        newline_idx = updated.find("\n")
        if newline_idx == -1:
            break
        updated = updated[newline_idx + 1 :]
    return updated


def _enrich_next_step_with_reflections(plan: Plan, reflection_summary: str) -> Plan:
    if not reflection_summary:
        return plan
    pending = plan.get_pending_steps()
    if not pending:
        return plan
    next_step = pending[0]
    if "[INSIGHTS FROM PREVIOUS STEPS]" in next_step.description:
        return plan
    enriched_desc = f"{next_step.description}\n\n[INSIGHTS FROM PREVIOUS STEPS]\n{reflection_summary}"
    updated_step = dataclasses.replace(next_step, description=enriched_desc)
    return plan.update_step(next_step.step_id, updated_step)


async def _handle_step_failure(
    state: PlanExecuteState,
    runtime: RuntimeContext,
    events: list[Any],
    tracker: LlmUsageTracker,
) -> dict[str, Any]:
    plan = state.get("plan")
    error = state.get("error", "")
    ledger = state.get("ledger")
    organization_id = state.get("organization_id")
    org_model = runtime.org_model
    api_key = runtime.api_key
    capability_registry = runtime.capability_registry
    assert plan is not None
    failed_step = next(
        (s for s in plan.steps if s.status == PlanStepStatus.FAILED.value), None
    )
    if not failed_step or not ledger:
        return {"awaiting_input": "recovery", "events": events}

    try:
        plan_service = runtime.engine.planner
        recovery = plan_service.analyze_step_failure(
            failed_step=failed_step,
            error_message=error,
            plan=plan,
            ledger=ledger,
            org_model=org_model,
            api_key=api_key,
            organization_id=organization_id,
            capability_registry=capability_registry,
            tracker=tracker,
        )
        events.append(
            RecoveryAnalysisEvent(
                step_id=failed_step.step_id, confidence=recovery.confidence
            )
        )
        if recovery.should_auto_fix:
            updated_step = failed_step.with_parameters(
                {**(failed_step.parameters or {}), **recovery.corrected_parameters}
            )
            updated_plan = plan.update_step(failed_step.step_id, updated_step)
            events.append(
                AutoFixCompletedEvent(
                    step_id=failed_step.step_id, result="Recovery prepared."
                )
            )
            return {"plan": updated_plan, "error": None, "events": events}
        elif recovery.should_propose:
            events.append(
                RecoveryPlanProposedEvent(
                    step_id=failed_step.step_id,
                    fix_description=recovery.reasoning,
                    confidence=recovery.confidence,
                )
            )
            return {"awaiting_input": "recovery", "events": events}
        else:
            events.append(
                AwaitingClarificationEvent(
                    questions=recovery.questions or ["What to do?"]
                )
            )
            return {"awaiting_input": "recovery", "events": events}
    except Exception as e:
        logger.error(f"Recovery analysis failed: {e}")
        events.append(
            AwaitingClarificationEvent(
                questions=["What would you like to do about this error?"]
            )
        )
        return {"awaiting_input": "recovery", "events": events}


async def _evaluate_progress(
    plan: Plan,
    org_model: str | None,
    events: list[Any],
    outcomes: dict[str, StepOutcome],
    tracker: LlmUsageTracker,
) -> EvaluationResult:
    try:
        plan_steps, step_results = [], []
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

        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()
        with dspy.context(lm=lm):
            result = await asyncio.to_thread(
                evaluator.evaluate_goal,
                plan.goal,
                plan_steps,
                step_results,
                list(outcomes.values()),
            )
        record_from_lm(lm, tracker)

        reason = f"Confidence: {result.confidence:.0%}. "
        reason += (
            f"Blockers: {', '.join(result.blockers)}"
            if result.blockers
            else f"Remaining: {', '.join(result.remaining_items)}"
            if result.remaining_items
            else "Goal achieved"
        )
        evaluation = EvaluationResult(
            goal_achieved=result.achieved,
            blocking_issues=bool(result.blockers),
            should_continue=not result.achieved and bool(result.remaining_items),
            needs_replan=bool(result.blockers) and not result.achieved,
            reason=reason,
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

    events.append(
        EvaluationCompletedEvent(
            plan_id=plan.id,
            evaluation=evaluation,
            evaluation_number=1,
        )
    )
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
    org_model: str | None,
    evaluation: EvaluationResult,
    events: list[Any],
    runtime: RuntimeContext,
    tracker: LlmUsageTracker,
) -> dict[str, Any]:
    success = evaluation.goal_achieved
    ledger = state.get("ledger")
    plan = plan.complete() if success else plan.fail()

    if runtime.engine:
        runtime.engine.plans.save(plan)

    # === ACE: Record execution pattern for future learning ===
    if runtime.ace_service and plan and plan.steps:
        try:
            outcome = StrategyOutcome.SUCCESS if success else StrategyOutcome.FAILURE
            # Extract success factors from step reflections if available
            reflections = state.get("step_reflections", {})
            success_factors = []
            for step_id, ref in reflections.items():
                if pattern := ref.get("pattern_learned"):
                    success_factors.append(pattern)

            runtime.ace_service.record_execution(
                plan=plan,
                outcome=outcome,
                success_factors=success_factors if success else None,
            )
            logger.info(f"ACE: Recorded {outcome.value} pattern from plan {plan.id[:8]}")
        except Exception as e:
            logger.warning(f"ACE: Failed to record pattern: {e}")

    final_response = None
    if ledger:
        try:
            final_response = await _synthesize_answer(plan, ledger, org_model, tracker)
            if final_response:
                events.append(
                    FinalSynthesisEvent(plan_id=plan.id, synthesis=final_response)
                )
        except Exception as e:
            logger.warning(f"Synthesis failed: {e}")

    if runtime.engine and final_response:
        runtime.engine.memory.add(
            content=f"Task: {state.get('task', '')[:200]}. Result: {final_response[:300]}",
            memory_type="fact",
        )

    events.append(ExecutionCompletedEvent(plan_id=plan.id, success=success))
    return {
        "plan": plan,
        "response": final_response or "Execution finished.",
        "success": success,
        "events": events,
    }


async def _synthesize_answer(
    plan: Plan, ledger: Any, org_model: str | None, tracker: LlmUsageTracker
) -> str:
    step_results = ledger.get_step_results()
    if not step_results:
        return ""

    parts = [
        f"### {ledger.steps.get(step_id).step_name if ledger.steps.get(step_id) else step_id}\n{result or '(no output)'}"
        for step_id, result in step_results.items()
    ]
    formatted_results = "\n\n".join(parts)

    try:
        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()
        with dspy.context(lm=lm):
            result = await asyncio.to_thread(
                evaluator.synthesize_answer, plan.goal, formatted_results, ""
            )
        record_from_lm(lm, tracker)
        return str(result)
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        return formatted_results


async def _do_replan(
    state: PlanExecuteState,
    runtime: RuntimeContext,
    error: str | None,
    replan_count: int,
    events: list[Any],
    tracker: LlmUsageTracker,
) -> dict[str, Any]:
    plan = state.get("plan")
    org_model = state.get("org_model")
    tools = runtime.tools
    assert plan is not None

    replan_count += 1
    events.append(
        ReplanTriggeredEvent(
            plan_id=plan.id, reason=error or "Eval trigger", replan_number=replan_count
        )
    )

    replan_handler = ReplanHandler(model_provider=None, org_model=org_model)
    old_pending_count = len(plan.get_pending_steps())

    try:
        updated_plan = await replan_handler.handle_replan(
            current_plan=plan,
            failed_step=None,
            reason=error or "Eval trigger",
            tools=tools,
            llm_tracker=tracker,
        )
    except ReplanNeedsClarificationError as e:
        events.append(
            AwaitingClarificationEvent.from_dict_list(
                questions=e.questions, reasoning=e.reasoning
            )
        )
        return {
            "awaiting_input": "clarification",
            "replan_count": replan_count,
            "events": events,
        }

    new_pending_count = len(updated_plan.get_pending_steps())
    events.append(
        PlanUpdatedEvent(
            plan_id=plan.id,
            reason=error or "Eval trigger",
            added_steps=max(0, new_pending_count - old_pending_count),
            removed_steps=max(0, old_pending_count - new_pending_count),
            replan_number=replan_count,
        )
    )

    if runtime.engine:
        runtime.engine.plans.save(updated_plan)

    if new_pending_count == 0:
        raw = state.get("step_outcomes", {})
        replan_outcomes = {k: StepOutcome.from_dict(v) for k, v in raw.items()}
        evaluation = await _evaluate_progress(
            updated_plan, org_model, events, replan_outcomes, tracker
        )
        return await _finish(
            updated_plan, state, org_model, evaluation, events, runtime, tracker
        )

    return {
        "plan": updated_plan,
        "replan_count": replan_count,
        "error": None,
        "events": events,
    }
