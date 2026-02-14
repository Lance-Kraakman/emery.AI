"""Replanning signatures: GeneratePlanDiff, ReflectOnPlan."""

from __future__ import annotations

import dspy

from .models import PlanDiffResult, PlanReflection


class GeneratePlanDiff(dspy.Signature):  # type: ignore[misc]
    """Generate a minimal diff to fix or adjust the remaining plan after a replan trigger.

    PRINCIPLES:
    - Preserve completed work: never re-do steps that already succeeded.
    - Minimal changes: skip or modify existing steps rather than replacing the entire plan.
    - Append new steps only when the failure reveals missing work.
    - If the failure is transient (e.g., timeout), retry the same step rather than restructuring.
    - If clarification is needed from the user, set needs_clarification=true and provide questions.
    """

    goal: str = dspy.InputField(desc="The plan's overall goal (same as original plan)")
    reason: str = dspy.InputField(
        desc="Why replanning was triggered: step failure, goal not fully achieved, "
        "or replan_after flag on a completed step."
    )
    failed_step_info: str = dspy.InputField(
        desc="Details about the failed step: step_id, description, error message, "
        "and tool evidence. Empty string if replan was triggered by replan_after flag."
    )
    completed_context: str = dspy.InputField(
        desc="Summary of all completed step results so far. "
        "Use to understand what has already been accomplished."
    )
    pending_steps_json: str = dspy.InputField(
        desc="JSON array of remaining pending steps. These can be skipped, modified, or kept as-is."
    )

    diff: PlanDiffResult = dspy.OutputField()


class ReflectOnPlan(dspy.Signature):  # type: ignore[misc]
    """Reflect on a draft plan - like Claude's extended thinking.

    REFLECTION PROCESS:
    1. Read the draft plan critically
    2. Ask: Is this plan complete and well-informed?
    3. Identify gaps that need more research
    4. Suggest improvements

    WHAT TO CHECK:
    - Are step descriptions specific (exact names, types) or vague?
    - Was enough research done to inform the plan?
    - Does it address the full scope of the user's request?
    - Are there assumptions that should be validated?
    """

    request: str = dspy.InputField(desc="Original user request")
    draft_plan: str = dspy.InputField(desc="JSON of the draft plan")
    research_done: str = dspy.InputField(
        desc="Summary of research already performed during planning"
    )
    workspace_context: str = dspy.InputField(desc="Existing resources")

    reflection: PlanReflection = dspy.OutputField()
