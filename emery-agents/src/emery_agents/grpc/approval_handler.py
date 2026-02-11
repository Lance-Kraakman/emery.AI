"""
Approval Handler

Handles plan approval, rejection, and related UI formatting.

Extracted from ChatProcessingService for maintainability.
"""

import json

from ..entities.models.plan import Plan
from .response_types import (
    AwaitingInputResponseDict,
)


def is_approval_response(task: str) -> bool:
    return task.lower().strip() == "approve"


def create_awaiting_input_for_plan(plan: Plan) -> AwaitingInputResponseDict:
    """
    Create awaiting_input event for plan approval.

    Formats the plan as markdown for display with approve button.

    Args:
        plan: The plan to present for approval

    Returns:
        AwaitingInputResponseDict ready for streaming to client
    """
    # Format plan steps as markdown
    plan_content = f"## Plan: {plan.goal}\n\n"

    # Include context section if available
    if plan.context:
        plan_content += f"### Current State\n{plan.context}\n\n"

    # Include analysis section if available
    if plan.analysis:
        plan_content += f"### Analysis\n{plan.analysis}\n\n"

    # Add steps
    plan_content += "### Steps\n"
    for i, step in enumerate(plan.steps, 1):
        plan_content += f"{i}. {step.description}\n"
        if step.tool_call:
            plan_content += f"   - Tool: `{step.tool_call}`\n"

    return {
        "type": "awaiting_input",
        "data": {
            "input_type": "plan_approval",
            "title": "Review Plan",
            "content": plan_content,
            "options": [
                {"id": "approve", "label": "Approve", "description": "Execute the plan"}
            ],
            "plan_json": json.dumps(
                {
                    "id": plan.id,
                    "goal": plan.goal,
                    "context": plan.context,
                    "analysis": plan.analysis,
                    "steps": [
                        {
                            "step_id": s.step_id,
                            "description": s.description,
                            "tool_call": s.tool_call,
                            "prompt_template": s.prompt_template,
                            "required_context": s.required_context or [],
                        }
                        for s in plan.steps
                    ],
                }
            ),
        },
    }
