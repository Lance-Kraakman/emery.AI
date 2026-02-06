"""
Plan Differ - DSPy-based plan diff generation.

Generates minimal diffs for incremental plan updates using DSPy
ChainOfThought with GeneratePlanDiff signature.
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import dspy

from ..protocols import ModelProviderProtocol
from emery_agents.services.analysis.llm_usage import LlmUsageTracker, record_from_lm
from emery_agents.entities.models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus, create_step
from emery_agents.reasoning.signatures.planning import GeneratePlanDiff, PlanDiffResult

logger = logging.getLogger(__name__)


@dataclass
class PlanDiff:
    """
    Represents changes to apply to a plan.

    A diff contains minimal changes needed to address a replan reason
    while preserving as much of the original plan as possible.
    """

    steps_to_skip: List[str] = field(default_factory=list)
    """Step IDs to mark as SKIPPED."""

    steps_to_modify: List[Tuple[str, Dict[str, Any]]] = field(default_factory=list)
    """(step_id, modifications) - Update existing steps."""

    steps_to_insert: List[Tuple[int, PlanStep]] = field(default_factory=list)
    """(position, new_step) - Insert new steps at specific positions."""

    steps_to_append: List[PlanStep] = field(default_factory=list)
    """New steps to add at the end."""

    reasoning: str = ""
    """Explanation of why these changes were made."""

    clarifying_questions: List[Dict[str, Any]] = field(default_factory=list)
    """Questions to ask user when missing information detected."""

    def is_empty(self) -> bool:
        """Check if the diff has no changes."""
        return (
            not self.steps_to_skip
            and not self.steps_to_modify
            and not self.steps_to_insert
            and not self.steps_to_append
            and not self.clarifying_questions
        )

    @property
    def needs_clarification(self) -> bool:
        """Check if diff requires user clarification before proceeding."""
        return len(self.clarifying_questions) > 0

    def summary(self) -> str:
        """Get a human-readable summary of the diff."""
        parts = []
        if self.steps_to_skip:
            parts.append(f"skip {len(self.steps_to_skip)} steps")
        if self.steps_to_modify:
            parts.append(f"modify {len(self.steps_to_modify)} steps")
        if self.steps_to_insert:
            parts.append(f"insert {len(self.steps_to_insert)} steps")
        if self.steps_to_append:
            parts.append(f"append {len(self.steps_to_append)} steps")
        return ", ".join(parts) if parts else "no changes"

    @classmethod
    def from_result(cls, result: PlanDiffResult) -> "PlanDiff":
        """Convert from DSPy result model."""
        # Build PlanStep objects for append (typed access)
        append_steps = []
        for s in result.steps_to_append:
            step = create_step(
                description=s.description,
                phase_name=s.phase_name,
                phase_order=s.phase_order,
            )
            append_steps.append(step)

        # Build modify tuples (typed access)
        modify_tuples: List[Tuple[str, Dict[str, Any]]] = []
        for m in result.steps_to_modify:
            mods = {"description": m.new_description}
            modify_tuples.append((m.step_id, mods))

        # Convert clarifying questions to dicts for runtime representation
        questions = [
            {
                "question": q.question,
                "question_type": q.question_type.value,
                "options": q.options,
                "reason": q.reason,
            }
            for q in result.clarifying_questions
        ] if result.needs_clarification else []

        return cls(
            steps_to_skip=result.steps_to_skip,
            steps_to_modify=modify_tuples,
            steps_to_insert=[],  # DSPy doesn't handle insert positions well
            steps_to_append=append_steps,
            reasoning=result.reasoning,
            clarifying_questions=questions,
        )


class PlanDifferModule(dspy.Module):
    """DSPy module for plan diff generation."""

    def __init__(self) -> None:
        super().__init__()
        self.differ = dspy.ChainOfThought(GeneratePlanDiff)

    def forward(
        self,
        goal: str,
        reason: str,
        failed_step_info: str,
        completed_context: str,
        pending_steps_json: str,
    ) -> PlanDiffResult:
        """Generate minimal diff to address replan reason."""
        result = self.differ(
            goal=goal,
            reason=reason,
            failed_step_info=failed_step_info,
            completed_context=completed_context,
            pending_steps_json=pending_steps_json,
        )
        return result.diff


class PlanDiffer:
    """
    DSPy-based plan diff generation.

    Generates minimal diffs for incremental plan updates using
    ChainOfThought with GeneratePlanDiff signature.
    """

    def __init__(
        self,
        lm: Optional[dspy.LM] = None,
        model_provider: Optional["ModelProviderProtocol"] = None,
    ):
        """
        Initialize differ.

        Args:
            lm: DSPy language model (uses global settings if not provided)
            model_provider: Model provider for LM resolution (alternative to lm)
        """
        self.lm = lm
        self.model_provider = model_provider
        self._module = PlanDifferModule()

    async def generate_diff(
        self,
        current_plan: Plan,
        reason: str,
        failed_step: Optional[PlanStep] = None,
        completed_context: Optional[str] = None,
        org_model: Optional[str] = None,
        llm_tracker: Optional[LlmUsageTracker] = None,
    ) -> PlanDiff:
        """
        Generate minimal diff to address the replan reason.

        Args:
            current_plan: The current plan being executed
            reason: Why replanning was triggered
            failed_step: The step that triggered replanning (if any)
            completed_context: Summary of completed step results
            org_model: Organization model ID (unused in DSPy version)
            llm_tracker: Optional tracker for LLM usage

        Returns:
            PlanDiff with minimal changes needed
        """
        # Get pending steps
        pending_steps = [
            s for s in current_plan.steps
            if s.status == PlanStepStatus.PENDING.value
        ]

        if not pending_steps:
            logger.info("No pending steps to diff")
            return PlanDiff(reasoning="No pending steps remain")

        # Serialize pending steps to JSON
        pending_data = [
            {
                "step_id": s.step_id,
                "description": s.description,
                "target_agent": s.target_agent,
                "phase_name": s.phase_name,
            }
            for s in pending_steps
        ]
        pending_steps_json = json.dumps(pending_data)

        # Build failed step info
        failed_step_info = ""
        if failed_step:
            failed_step_info = f"Step '{failed_step.step_id}': {failed_step.description}"
            if failed_step.error:
                failed_step_info += f"\nError: {failed_step.error}"

        context_str = completed_context or "No completed step context available."

        logger.info(f"📋 Generating plan diff for reason: {reason[:100]}...")

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(
                        goal=current_plan.goal,
                        reason=reason,
                        failed_step_info=failed_step_info,
                        completed_context=context_str,
                        pending_steps_json=pending_steps_json,
                    )
            else:
                result = self._module(
                    goal=current_plan.goal,
                    reason=reason,
                    failed_step_info=failed_step_info,
                    completed_context=context_str,
                    pending_steps_json=pending_steps_json,
                )
            if self.lm and llm_tracker:
                record_from_lm(self.lm, llm_tracker)

            diff = PlanDiff.from_result(result)

            # Check for clarifying questions
            if diff.needs_clarification:
                logger.info(f"❓ Replan needs clarification: {len(diff.clarifying_questions)} question(s)")
                return diff

            # If failed_step provided, ensure it's in steps_to_skip
            if failed_step and failed_step.step_id not in diff.steps_to_skip:
                diff.steps_to_skip.append(failed_step.step_id)
                logger.info(f"Added failed step {failed_step.step_id} to skip list")

            logger.info(f"✅ Generated diff: {diff.summary()}")
            return diff

        except Exception as e:
            logger.error(f"Diff generation failed: {e}")
            # Fallback: skip failed step and keep pending
            return PlanDiff(
                steps_to_skip=[failed_step.step_id] if failed_step else [],
                reasoning=f"Diff generation failed: {e}",
            )

    def apply_diff(self, plan: Plan, diff: PlanDiff) -> Plan:
        """
        Apply diff to create updated plan.

        Args:
            plan: Original plan
            diff: Diff to apply

        Returns:
            New Plan with diff applied
        """
        new_steps: List[PlanStep] = []

        for step in plan.steps:
            step_id = step.step_id

            # Check if step should be skipped
            if step_id in diff.steps_to_skip:
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
                    error=f"Skipped during replan: {diff.reasoning[:100]}",
                )
                new_steps.append(skipped)
                continue

            # Check if step should be modified
            modified = False
            for mod_step_id, modifications in diff.steps_to_modify:
                if step_id == mod_step_id:
                    # Create modified step
                    modified_step = PlanStep(
                        step_id=step.step_id,
                        description=modifications.get("description", step.description),
                        tool_call=step.tool_call,
                        parameters=step.parameters,
                        target_agent=step.target_agent,
                        context_tables=step.context_tables,
                        prompt_template=step.prompt_template,
                        required_context=step.required_context,
                        phase_name=step.phase_name,
                        phase_order=step.phase_order,
                        replan_after=step.replan_after,
                        status=step.status,
                        result=step.result,
                        error=step.error,
                    )
                    new_steps.append(modified_step)
                    modified = True
                    break

            if not modified:
                # Keep step as-is
                new_steps.append(step)

        # Handle insertions at specific positions (reverse order to maintain indices)
        for position, new_step in sorted(diff.steps_to_insert, key=lambda x: x[0], reverse=True):
            if 0 <= position <= len(new_steps):
                new_steps.insert(position, new_step)
            else:
                # Invalid position, append instead
                new_steps.append(new_step)

        # Append new steps
        new_steps.extend(diff.steps_to_append)

        # Create updated plan with incremented version
        updated_plan = Plan(
            id=plan.id,
            goal=plan.goal,
            basic_instructions=plan.basic_instructions,
            steps=new_steps,
            status=PlanStatus.EXECUTING.value,
            generated_at=plan.generated_at,
            approved_at=plan.approved_at,
            version=plan.version + 1,
            context=plan.context,
            analysis=f"{plan.analysis}\n\n[Replan v{plan.version + 1}] {diff.reasoning}",
        )

        logger.info(
            f"Applied diff to plan {plan.id}: {diff.summary()} -> v{updated_plan.version}"
        )

        return updated_plan
