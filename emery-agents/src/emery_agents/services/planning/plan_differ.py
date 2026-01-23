"""
Plan Differ - Generates diffs for incremental plan updates.

Instead of regenerating all pending steps from scratch, this module
generates minimal diffs that preserve continuity and avoid duplicating work.

AIDEV-NOTE: This addresses the issue where _handle_replan() would discard
all pending steps and regenerate them, losing context and potentially
duplicating already-planned work.

Diff operations:
- SKIP: Mark step as skipped (failed or no longer needed)
- MODIFY: Update a step's description/parameters
- INSERT: Add new step at a specific position
- APPEND: Add new steps at the end
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from smolagents import Tool, ToolCallingAgent

from emery_agents.models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus, create_step
from emery_agents.prompts import render_template
from emery_agents.services.protocols import ModelProvider

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

    def is_empty(self) -> bool:
        """Check if the diff has no changes."""
        return (
            not self.steps_to_skip
            and not self.steps_to_modify
            and not self.steps_to_insert
            and not self.steps_to_append
        )

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


class DiffOutputTool(Tool):  # type: ignore[misc]
    """Tool for LLM to output plan diff operations."""

    skip_forward_signature_validation = True

    name = "output_plan_diff"
    description = """Output the plan diff operations.

Specify minimal changes to address the replan reason:
- steps_to_skip: List of step IDs to mark as skipped
- steps_to_modify: List of {step_id, new_description} to update existing steps
- steps_to_append: List of new steps to add at the end
- reasoning: Why these changes are needed

Only include changes that are necessary. Preserve existing steps when possible.
"""

    inputs = {
        "steps_to_skip": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Step IDs to mark as SKIPPED",
        },
        "steps_to_modify": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step_id": {"type": "string"},
                    "new_description": {"type": "string"},
                },
            },
            "description": "Steps to modify with new descriptions",
        },
        "steps_to_append": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "target_agent": {"type": "string"},
                    "phase_name": {"type": "string"},
                    "phase_order": {"type": "integer"},
                },
            },
            "description": "New steps to add at the end",
        },
        "reasoning": {
            "type": "string",
            "description": "Explanation of why these changes are needed",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self._diff: Optional[PlanDiff] = None

    def forward(
        self,
        steps_to_skip: Optional[List[str]] = None,
        steps_to_modify: Optional[List[Dict[str, str]]] = None,
        steps_to_append: Optional[List[Dict[str, Any]]] = None,
        reasoning: str = "",
    ) -> str:
        """Capture the diff operations."""
        # Build PlanStep objects for append
        append_steps = []
        if steps_to_append:
            for s in steps_to_append:
                step = create_step(
                    description=s.get("description", ""),
                    target_agent=s.get("target_agent"),
                    phase_name=s.get("phase_name"),
                    phase_order=s.get("phase_order"),
                )
                append_steps.append(step)

        # Build modify tuples
        modify_tuples: List[Tuple[str, Dict[str, Any]]] = []
        if steps_to_modify:
            for m in steps_to_modify:
                step_id = m.get("step_id", "")
                mods = {"description": m.get("new_description", "")}
                modify_tuples.append((step_id, mods))

        self._diff = PlanDiff(
            steps_to_skip=steps_to_skip or [],
            steps_to_modify=modify_tuples,
            steps_to_insert=[],  # LLM doesn't handle insert positions well, use append
            steps_to_append=append_steps,
            reasoning=reasoning,
        )

        summary = self._diff.summary()
        logger.info(f"📋 Plan diff captured: {summary}")
        return f"Diff captured: {summary}"

    def get_diff(self) -> Optional[PlanDiff]:
        """Get the captured diff."""
        return self._diff


class PlanDiffer:
    """
    Generates and applies diffs to plans.

    Instead of regenerating all pending steps, this generates minimal
    diffs that preserve continuity and avoid duplicating work.
    """

    def __init__(self, model_provider: ModelProvider):
        """
        Initialize differ.

        Args:
            model_provider: Model provider for LLM access
        """
        if model_provider is None:
            raise ValueError("PlanDiffer requires model_provider")
        self.model_provider = model_provider

    async def generate_diff(
        self,
        current_plan: Plan,
        reason: str,
        failed_step: Optional[PlanStep] = None,
        completed_context: Optional[str] = None,
        org_model: Optional[str] = None,
    ) -> PlanDiff:
        """
        Generate minimal diff to address the replan reason.

        Args:
            current_plan: The current plan being executed
            reason: Why replanning was triggered
            failed_step: The step that triggered replanning (if any)
            completed_context: Summary of completed step results
            org_model: Organization model ID for model resolution

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

        # Build prompt
        prompt = render_template(
            "planning/plan_diff.j2",
            goal=current_plan.goal,
            reason=reason,
            failed_step=failed_step,
            completed_context=completed_context,
            pending_steps=pending_steps,
        )

        # Use DiffOutputTool for structured output
        diff_tool = DiffOutputTool()
        model_id = self.model_provider.resolve_model_selection(org_model=org_model)
        model = self.model_provider.get_model(model_id=model_id)

        agent = ToolCallingAgent(
            tools=[diff_tool],
            model=model,
            max_steps=3,
        )

        try:
            agent.run(prompt)
            diff = diff_tool.get_diff()

            if diff is None:
                logger.warning("LLM did not call diff tool, returning empty diff")
                return PlanDiff(reasoning="LLM did not generate diff")

            # If failed_step provided, ensure it's in steps_to_skip
            if failed_step and failed_step.step_id not in diff.steps_to_skip:
                diff.steps_to_skip.append(failed_step.step_id)
                logger.info(f"Added failed step {failed_step.step_id} to skip list")

            logger.info(f"Generated diff: {diff.summary()}")
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
