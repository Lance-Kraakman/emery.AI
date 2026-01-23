"""
Replan Handler

Handles diff-based replanning when the evaluator indicates plan adjustment is needed.

Extracted from ExecutionCoordinator for maintainability.
"""

import logging
from typing import Any, List, Optional

from ...models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus
from ..planning.plan_differ import PlanDiffer
from ..protocols import ModelProvider
from ...utils.session_logger import get_session_logger

logger = logging.getLogger(__name__)


class ReplanHandler:
    """
    Handles replanning when evaluator indicates plan needs adjustment.

    Uses diff-based approach to generate minimal changes instead of
    regenerating all pending steps from scratch.
    """

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        org_model: Optional[str] = None,
    ):
        """
        Initialize replan handler.

        Args:
            model_provider: Provider for getting LLM models
            org_model: Organization model ID for model resolution
        """
        self.model_provider = model_provider
        self.org_model = org_model

    async def handle_replan(
        self,
        current_plan: Plan,
        failed_step: Optional[PlanStep],
        reason: str,
        tools: List[Any],
    ) -> Plan:
        """
        Handle replanning using diff-based approach.

        Preserves continuity by modifying existing steps rather than
        discarding them. Only adds/skips/modifies as needed.

        Args:
            current_plan: The current plan being executed
            failed_step: The step that triggered replanning (if any)
            reason: Why replanning was triggered
            tools: Available tools for recovery planning

        Returns:
            Updated plan with recovery steps applied via diff
        """
        logger.info(f"📋 Handling replan for plan {current_plan.id}: {reason}")

        # Build completed context for the differ
        completed_steps = [
            s for s in current_plan.steps
            if s.status == PlanStepStatus.COMPLETED.value
        ]
        completed_context = "\n".join([
            f"- {s.description}: {s.result[:200] if s.result else 'completed'}"
            for s in completed_steps
        ]) if completed_steps else None

        # Use PlanDiffer for minimal changes
        if self.model_provider is None:
            raise ValueError("Cannot replan without model_provider")
        differ = PlanDiffer(model_provider=self.model_provider)

        try:
            diff = await differ.generate_diff(
                current_plan=current_plan,
                reason=reason,
                failed_step=failed_step,
                completed_context=completed_context,
                org_model=self.org_model,
            )

            # Log the diff for debugging
            session_logger = get_session_logger()
            if session_logger:
                session_logger.log_event("plan_diff_generated", {
                    "plan_id": current_plan.id,
                    "reason": reason,
                    "diff_summary": diff.summary(),
                    "steps_to_skip": diff.steps_to_skip,
                    "steps_to_modify": len(diff.steps_to_modify),
                    "steps_to_append": len(diff.steps_to_append),
                    "reasoning": diff.reasoning[:200] if diff.reasoning else "",
                })

            # Apply the diff
            updated_plan = differ.apply_diff(current_plan, diff)

            logger.info(
                f"📋 Replan complete via diff: {diff.summary()} -> v{updated_plan.version}"
            )

            return updated_plan

        except Exception as e:
            # Fallback to simple skip-and-continue if diff generation fails
            logger.warning(f"Diff generation failed, using fallback: {e}")
            return self._fallback_replan(current_plan, failed_step, reason)

    def _fallback_replan(
        self,
        current_plan: Plan,
        failed_step: Optional[PlanStep],
        reason: str,
    ) -> Plan:
        """
        Fallback replan strategy when diff generation fails.

        Simply skips the failed step and keeps pending steps as-is.

        Args:
            current_plan: The current plan
            failed_step: The step that failed
            reason: Why replanning was triggered

        Returns:
            Updated plan with failed step skipped
        """
        new_steps = []
        for step in current_plan.steps:
            if step.status == PlanStepStatus.COMPLETED.value:
                new_steps.append(step)
            elif failed_step and step.step_id == failed_step.step_id:
                # Skip the failed step
                skipped = PlanStep(
                    step_id=step.step_id,
                    description=step.description,
                    tool_call=step.tool_call,
                    parameters=step.parameters,
                    target_agent=step.target_agent,
                    context_tables=step.context_tables,
                    prompt_template=step.prompt_template,
                    required_context=step.required_context,
                    phase_name=step.phase_name,
                    phase_order=step.phase_order,
                    replan_after=step.replan_after,
                    status=PlanStepStatus.SKIPPED.value,
                    result=step.result,
                    error=f"Skipped during replan (fallback): {reason[:100]}",
                )
                new_steps.append(skipped)
            else:
                # Keep pending steps as-is
                new_steps.append(step)

        updated_plan = Plan(
            id=current_plan.id,
            goal=current_plan.goal,
            basic_instructions=current_plan.basic_instructions,
            steps=new_steps,
            status=PlanStatus.EXECUTING.value,
            generated_at=current_plan.generated_at,
            approved_at=current_plan.approved_at,
            version=current_plan.version + 1,
            context=current_plan.context,
            analysis=f"{current_plan.analysis}\n\n[Replan v{current_plan.version + 1}] Fallback: {reason}",
        )

        logger.info(f"📋 Replan complete (fallback): skipped failed step -> v{updated_plan.version}")
        return updated_plan
