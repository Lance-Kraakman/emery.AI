"""
Shared utilities for converting smolagents steps to progress dictionaries.

AIDEV-NOTE: This module provides a common interface for step-to-dict conversion
used by both SkillExecutorService and StatefulManagedAgent for progress streaming.
"""

from typing import Any, Literal, Optional, TypedDict

from smolagents.memory import ActionStep, PlanningStep, FinalAnswerStep


# Type for step progress type field
StepProgressType = Literal['planning', 'action', 'final']


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
    name_key: Literal["agent_name", "skill_name"] = "agent_name"
) -> Optional[RawProgressDict]:
    """
    Convert smolagents step to progress dict for callback emission.

    Returns dict with standardized fields:
    - type: step type ('planning', 'action', 'final')
    - step_name: human-readable step name (e.g., "schema_builder: create_table")
    - content: step content (plan text, observations, output)
    - metadata: additional context (name, status, tool info)
    - step_index: position in execution sequence

    Args:
        step: smolagents step object (PlanningStep, ActionStep, FinalAnswerStep)
        index: Step index in execution sequence
        name: Name of the executing agent/skill (for display in step_name)
        name_key: Metadata key for the name ('agent_name' or 'skill_name')

    Returns:
        Progress dict or None if step type not recognized
    """
    status_key = "agent_status" if name_key == "agent_name" else "skill_status"

    if isinstance(step, PlanningStep):
        return {
            'type': 'planning',
            'step_name': f'{name}: Planning',
            'content': step.plan[:500] if step.plan else '',
            'metadata': {name_key: name, status_key: 'planning'},
            'step_index': index
        }
    elif isinstance(step, ActionStep):
        tool_name = 'unknown'
        tool_args = ''
        observations = ''

        if step.tool_calls and len(step.tool_calls) > 0:
            tool_call = step.tool_calls[0]
            tool_name = tool_call.name
            tool_args = str(tool_call.arguments)[:300]

        if step.observations:
            observations = str(step.observations)[:500]

        return {
            'type': 'action',
            'step_name': f'{name}: {tool_name}',
            'content': observations,
            'metadata': {
                name_key: name,
                status_key: 'executing',
                'tool': tool_name,
                'arguments': tool_args
            },
            'step_index': index
        }
    elif isinstance(step, FinalAnswerStep):
        return {
            'type': 'final',
            'step_name': f'{name}: Complete',
            'content': str(step.output)[:500] if step.output else '',
            'metadata': {name_key: name, status_key: 'completed'},
            'step_index': index
        }

    return None
