"""
Shared utilities for converting execution steps to progress dictionaries.

Provides a common interface for step-to-dict conversion used by both
SkillExecutorService and StatefulManagedAgent for progress streaming.

Uses DSPy TrackedStep types for step representation.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from ..reasoning.modules.step_tracker import StepType, TrackedStep

# Type for step progress type field
StepProgressType = Literal["planning", "action", "final"]


class ProgressMetadata(TypedDict, total=False):
    """Metadata for progress steps.

    Supports both agent and skill contexts via optional fields.
    """

    agent_name: str
    agent_status: str
    skill_name: str
    skill_status: str
    tool: str
    arguments: str


class RawProgressDict(TypedDict):
    """Internal progress dict format (pre-wire conversion).

    This is the format returned by step_to_progress_dict.
    Gets converted to StepProgressDict (wire format) in chat_processing_service.py.
    """

    type: StepProgressType
    step_name: str
    content: str
    metadata: ProgressMetadata
    step_index: int


def step_to_progress_dict(
    step: Any,
    index: int,
    name: str = "agent",
    name_key: Literal["agent_name", "skill_name"] = "agent_name",
) -> RawProgressDict | None:
    """
    Convert step to progress dict for callback emission.

    Uses DSPy TrackedStep types.

    Returns dict with standardized fields:
    - type: step type ('planning', 'action', 'final')
    - step_name: human-readable step name (e.g., "schema_builder: create_table")
    - content: step content (plan text, observations, output)
    - metadata: additional context (name, status, tool info)
    - step_index: position in execution sequence

    Args:
        step: TrackedStep or dict-like step object
        index: Step index in execution sequence
        name: Name of the executing agent/skill (for display in step_name)
        name_key: Metadata key for the name ('agent_name' or 'skill_name')

    Returns:
        Progress dict or None if step type not recognized
    """
    status_key = "agent_status" if name_key == "agent_name" else "skill_status"

    # Handle DSPy TrackedStep
    if isinstance(step, TrackedStep):
        if step.step_type == StepType.PLANNING:
            return {
                "type": "planning",
                "step_name": f"{name}: Planning",
                "content": step.content[:500] if step.content else "",
                "metadata": {name_key: name, status_key: "planning"},
                "step_index": index,
            }
        elif step.step_type in (StepType.ACTION, StepType.TOOL_CALL):
            tool_name = "unknown"
            tool_args = ""

            if step.tool_calls:
                tc = step.tool_calls[0]
                tool_name = tc.tool_name
                tool_args = str(tc.arguments)[:300]

            return {
                "type": "action",
                "step_name": f"{name}: {tool_name}",
                "content": step.content[:500] if step.content else "",
                "metadata": {
                    name_key: name,
                    status_key: "executing",
                    "tool": tool_name,
                    "arguments": tool_args,
                },
                "step_index": index,
            }
        elif step.step_type == StepType.FINAL:
            return {
                "type": "final",
                "step_name": f"{name}: Complete",
                "content": step.content[:500] if step.content else "",
                "metadata": {name_key: name, status_key: "completed"},
                "step_index": index,
            }
        # Other step types (THINKING, TOOL_RESULT, ERROR) map to action
        return {
            "type": "action",
            "step_name": f"{name}: {step.step_type.value}",
            "content": step.content[:500] if step.content else "",
            "metadata": {name_key: name, status_key: "executing"},
            "step_index": index,
        }

    # Handle dict-like steps (e.g., from progress callbacks)
    if isinstance(step, dict):
        step_type = step.get("step_type", step.get("type", "action"))
        content = step.get("content", "")

        if step_type in ("planning", StepType.PLANNING.value):
            return {
                "type": "planning",
                "step_name": f"{name}: Planning",
                "content": str(content)[:500],
                "metadata": {name_key: name, status_key: "planning"},
                "step_index": index,
            }
        elif step_type in ("final", StepType.FINAL.value):
            return {
                "type": "final",
                "step_name": f"{name}: Complete",
                "content": str(content)[:500],
                "metadata": {name_key: name, status_key: "completed"},
                "step_index": index,
            }
        else:
            return {
                "type": "action",
                "step_name": f"{name}: {step_type}",
                "content": str(content)[:500],
                "metadata": {name_key: name, status_key: "executing"},
                "step_index": index,
            }

    # Handle generic objects with step-like attributes
    if hasattr(step, "step_type"):
        step_type_val = getattr(step.step_type, "value", str(step.step_type))
        content = getattr(step, "content", "") or ""

        if step_type_val in ("planning", "PLANNING"):
            return {
                "type": "planning",
                "step_name": f"{name}: Planning",
                "content": str(content)[:500],
                "metadata": {name_key: name, status_key: "planning"},
                "step_index": index,
            }
        elif step_type_val in ("final", "FINAL"):
            return {
                "type": "final",
                "step_name": f"{name}: Complete",
                "content": str(content)[:500],
                "metadata": {name_key: name, status_key: "completed"},
                "step_index": index,
            }
        else:
            return {
                "type": "action",
                "step_name": f"{name}: {step_type_val}",
                "content": str(content)[:500],
                "metadata": {name_key: name, status_key: "executing"},
                "step_index": index,
            }

    return None
