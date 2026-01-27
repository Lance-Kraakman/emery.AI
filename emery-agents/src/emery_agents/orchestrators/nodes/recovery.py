"""
Recovery Node

Handles step failures with confidence-based recovery.
Uses PlanService.analyze_step_failure for intelligent recovery.
"""

import logging
from typing import Any, Dict, List, Optional

from ...entities.models.plan import Plan, PlanStep, PlanStepStatus, RecoveryResult
from ...services.plan_service import PlanService
from ...services.execution.events import (
    RecoveryAnalysisEvent,
    AutoFixStartedEvent,
    AutoFixCompletedEvent,
    RecoveryPlanProposedEvent,
    AwaitingClarificationEvent,
)
from ..state import PlanExecuteState
from ..runtime import RuntimeContext

logger = logging.getLogger(__name__)


async def handle_failure_node(state: PlanExecuteState, runtime: RuntimeContext) -> Dict[str, Any]:
    """
    Handle step failure with confidence-based recovery.

    Replaces ExecutionCoordinator._handle_step_failure().

    Routes based on confidence:
    - HIGH (>=0.8): Auto-fix with notification
    - MEDIUM (0.5-0.8): Propose fix for user approval
    - LOW (<0.5): Ask clarifying questions
    """
    plan = state.get("plan")
    error = state.get("error", "")
    ledger = state.get("ledger")
    organization_id = state.get("organization_id")

    # Read non-serializable objects from runtime
    org_model = runtime.org_model
    api_key = runtime.api_key
    capability_registry = runtime.capability_registry

    events: List[Any] = []

    assert plan is not None, "Cannot recover without a plan"

    # Find the failed step
    failed_step = None
    for step in plan.steps:
        if step.status == PlanStepStatus.FAILED.value:
            failed_step = step
            break

    if not failed_step:
        logger.warning("No failed step found in plan")
        return {"events": events}

    if not ledger:
        logger.warning("No ledger available, cannot attempt recovery")
        return {"events": events}

    logger.info(f"Attempting recovery analysis for step '{failed_step.step_id}'")

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
            # HIGH CONFIDENCE: Auto-fix
            logger.info(
                f"Auto-fixing step '{failed_step.step_id}' "
                f"with {recovery.confidence:.0%} confidence"
            )
            events.append(AutoFixStartedEvent(
                step_id=failed_step.step_id,
                fix_description=recovery.reasoning,
                confidence=recovery.confidence,
            ))

            # Update step parameters for retry
            updated_step = failed_step.with_parameters(
                {**(failed_step.parameters or {}), **recovery.corrected_parameters}
            )
            updated_plan = plan.update_step(failed_step.step_id, updated_step)

            events.append(AutoFixCompletedEvent(
                step_id=failed_step.step_id,
                result="Recovery action prepared - will retry step",
            ))

            return {
                "plan": updated_plan,
                "error": None,  # Clear error for retry
                "events": events,
            }

        elif recovery.should_propose:
            # MEDIUM CONFIDENCE: Propose for approval
            logger.info(
                f"Proposing recovery for step '{failed_step.step_id}' "
                f"with {recovery.confidence:.0%} confidence"
            )
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
            logger.info(
                f"Low confidence ({recovery.confidence:.0%}) for step "
                f"'{failed_step.step_id}', asking user"
            )
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
