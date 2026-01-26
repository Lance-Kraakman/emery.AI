"""
Step Converter Utilities

Handles conversion of step objects to frontend event dicts.
Uses DSPy TrackedStep types.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from ..reasoning.modules.step_tracker import TrackedStep, StepType as DSPyStepType
from .response_types import StepType, StepMetadata, StepProgressDict

logger = logging.getLogger(__name__)

# Truncation limits for step content
MAX_METADATA_LENGTH = 500
MAX_MESSAGE_PREVIEW_LENGTH = 100


def extract_tracked_step(step: TrackedStep, index: int) -> StepProgressDict:
    """
    Extract typed data from DSPy TrackedStep.

    Converts DSPy step types to frontend event format.
    """
    # Map DSPy step types to frontend types
    step_type_map: dict[DSPyStepType, StepType] = {
        DSPyStepType.PLANNING: "PLANNING",
        DSPyStepType.ACTION: "ACTION",
        DSPyStepType.TOOL_CALL: "ACTION",
        DSPyStepType.TOOL_RESULT: "ACTION",
        DSPyStepType.THINKING: "REASONING",
        DSPyStepType.FINAL: "FINAL",
        DSPyStepType.ERROR: "ERROR",
    }

    step_type = step_type_map.get(step.step_type, "ACTION")

    # Build step name
    if step.step_type == DSPyStepType.PLANNING:
        step_name = "Planning"
    elif step.step_type == DSPyStepType.FINAL:
        step_name = "Final Answer"
    elif step.tool_calls:
        tool_name = step.tool_calls[0].tool_name
        step_name = f"Tool: {tool_name}"
    else:
        step_name = f"Step: {step.step_type.value}"

    # Build metadata
    metadata_dict: dict[str, str] = {}
    if step.tool_calls:
        tc = step.tool_calls[0]
        metadata_dict["tool"] = tc.tool_name
        metadata_dict["arguments"] = str(tc.arguments)[:MAX_METADATA_LENGTH]
        if tc.result:
            metadata_dict["observations"] = str(tc.result)[:MAX_METADATA_LENGTH]
    if step.reasoning:
        metadata_dict["reasoning"] = step.reasoning[:MAX_METADATA_LENGTH]

    return StepProgressDict(
        type="step_progress",
        step_type=step_type,
        step_name=step_name,
        content=step.content[:MAX_METADATA_LENGTH] if step.content else "",
        metadata=metadata_dict,
        step_index=index,
    )


def extract_planning_step(step: Any, index: int) -> StepProgressDict:
    """
    Extract typed data from TrackedStep for planning steps.
    """
    # Handle DSPy TrackedStep
    if isinstance(step, TrackedStep):
        return extract_tracked_step(step, index)

    # Handle generic step with plan attribute
    return StepProgressDict(
        type="step_progress",
        step_type="PLANNING",
        step_name="Planning",
        content=getattr(step, 'plan', str(step)) if hasattr(step, "plan") else str(step),
        metadata=StepMetadata(),
        step_index=index,
    )


def extract_action_step(step: Any, index: int) -> StepProgressDict:
    """
    Extract typed data from TrackedStep for action steps.
    """
    # Handle DSPy TrackedStep
    if isinstance(step, TrackedStep):
        return extract_tracked_step(step, index)

    # Handle generic step
    step_type: StepType = "ACTION"
    step_name = "Action"
    content = ""
    metadata_dict: Dict[str, str] = {}

    # Try to extract tool information
    if hasattr(step, 'tool_calls') and step.tool_calls:
        tool_call = step.tool_calls[0]
        tool_name = getattr(tool_call, 'name', getattr(tool_call, 'tool_name', 'unknown'))
        tool_args = str(getattr(tool_call, 'arguments', {}))
        step_name = f"Tool: {tool_name}"
        metadata_dict["tool"] = tool_name
        metadata_dict["arguments"] = tool_args[:MAX_METADATA_LENGTH]

    # Try to extract observations
    if hasattr(step, 'observations') and step.observations:
        obs = str(step.observations)
        MAX_LENGTH = 500
        content = obs[:MAX_LENGTH] + "..." if len(obs) > MAX_LENGTH else obs
        metadata_dict["observations"] = content

    # Try to extract content
    if hasattr(step, 'content') and step.content:
        content = step.content[:MAX_METADATA_LENGTH]

    # Add skill metadata for managed agents and skill-related tools
    if metadata_dict.get("tool"):
        tool_name = metadata_dict["tool"]
        is_managed_agent = (
            tool_name.endswith("_builder") or
            tool_name.endswith("_agent") or
            tool_name == "tool_executor" or
            tool_name == "system_designer" or
            tool_name.startswith("skill-")
        )

        if is_managed_agent:
            metadata_dict["skill_name"] = tool_name
            metadata_dict["skill_status"] = "completed" if content else "executing"
            skill_message = build_skill_message(tool_name, metadata_dict.get("arguments", "{}"), content)
            if skill_message:
                metadata_dict["skill_message"] = skill_message

    return StepProgressDict(
        type="step_progress",
        step_type=step_type,
        step_name=step_name,
        content=content,
        metadata=metadata_dict,
        step_index=index
    )


def build_skill_message(tool_name: str, tool_args: str, observations: str) -> str:
    """
    Build a descriptive message for skill execution.

    Extracts meaningful information from tool arguments and observations
    to provide user-friendly progress messages.
    """
    messages = []

    # Try to parse tool_args as JSON for structured extraction
    try:
        args = json.loads(tool_args) if tool_args and tool_args != "{}" else {}
    except json.JSONDecodeError:
        args = {}

    # Build message based on tool type
    if tool_name == "tool_executor":
        # Extract task description from tool_executor args
        task = args.get("task", "")
        tool = args.get("tool", "")
        if task:
            messages.append(f"Running: {task[:MAX_MESSAGE_PREVIEW_LENGTH]}{'...' if len(task) > MAX_MESSAGE_PREVIEW_LENGTH else ''}")
        if tool:
            messages.append(f"Using tool: {tool}")

    elif tool_name.endswith("_builder") or tool_name.endswith("_agent") or tool_name == "system_designer":
        # Generic handler for all managed agents (*_builder, *_agent, system_designer)
        task = args.get("task", args.get("request", ""))
        if task:
            # Format agent name for display: schema_builder -> Schema
            display_name = tool_name.replace("_builder", "").replace("_agent", "").replace("_", " ").title()
            messages.append(f"{display_name}: {task[:MAX_MESSAGE_PREVIEW_LENGTH]}{'...' if len(task) > MAX_MESSAGE_PREVIEW_LENGTH else ''}")

    elif tool_name.startswith("skill-"):
        # Generic skill call
        skill_id = tool_name.replace("skill-", "")
        messages.append(f"Executing skill: {skill_id}")

    # Add observation summary if available
    if observations:
        # Check for success/failure indicators
        obs_lower = observations.lower()
        if "success" in obs_lower or "created" in obs_lower:
            # Extract key success info
            lines = observations.split('\n')
            for line in lines[:3]:  # First 3 lines
                if line.strip():
                    messages.append(f"Done: {line.strip()[:80]}")
                    break
        elif "error" in obs_lower or "failed" in obs_lower:
            messages.append(f"Failed: {observations[:MAX_MESSAGE_PREVIEW_LENGTH]}{'...' if len(observations) > MAX_MESSAGE_PREVIEW_LENGTH else ''}")

    return "\n".join(messages) if messages else ""


def extract_final_step(index: int) -> StepProgressDict:
    """
    Extract typed data for final step.

    Final step is just a marker indicating response generation.
    """
    return StepProgressDict(
        type="step_progress",
        step_type="FINAL",
        step_name="Final Answer",
        content="Generating final response...",
        metadata=StepMetadata(),
        step_index=index
    )
