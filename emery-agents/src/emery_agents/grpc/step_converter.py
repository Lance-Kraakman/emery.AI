"""
Step Converter Utilities

Extracted from chat_processing_service.py for single responsibility.
Handles conversion of smolagents step objects to frontend event dicts.
"""

import json
import logging
from typing import Dict

from smolagents.memory import ActionStep, PlanningStep

from .response_types import StepType, StepMetadata, StepProgressDict

logger = logging.getLogger(__name__)


def extract_planning_step(step: PlanningStep, index: int) -> StepProgressDict:
    """
    Extract typed data from PlanningStep.

    PlanningStep has 'plan' attribute containing the planning text.
    No hasattr checks needed - smolagents guarantees this structure.
    """
    return StepProgressDict(
        type="step_progress",
        step_type="PLANNING",
        step_name="Planning",
        content=step.plan,
        metadata=StepMetadata(),
        step_index=index
    )


def extract_action_step(step: ActionStep, index: int) -> StepProgressDict:
    """
    Extract typed data from ActionStep.

    ActionStep has 'tool_calls' (list of ToolCall objects), 'code_action' (for CodeAgent),
    and 'observations'. When tool_calls is empty/None, checks for code_action (CodeAgent),
    then falls back to model_output for raw LLM response.

    AIDEV-NOTE: CodeAgent populates step.code_action with Python code, not tool_calls.
    We now handle this as a CODE_EXECUTION step type for proper UI display.
    """
    # Extract tool info from tool_calls
    tool_name = "unknown"
    tool_args = "{}"
    step_type: StepType = "ACTION"
    step_name = "Tool: unknown"
    content = ""

    if step.tool_calls and len(step.tool_calls) > 0:
        # Has valid tool calls (ToolCallingAgent)
        tool_call = step.tool_calls[0]
        tool_name = tool_call.name
        tool_args = str(tool_call.arguments)
        step_name = f"Tool: {tool_name}"

        # Format observations (truncate if too long)
        if step.observations:
            obs = str(step.observations)
            MAX_LENGTH = 500
            content = obs[:MAX_LENGTH] + "..." if len(obs) > MAX_LENGTH else obs

    elif step.code_action:
        # CodeAgent: has Python code execution instead of tool_calls
        # AIDEV-NOTE: code_action contains the Python code that was executed
        step_type = "CODE_EXECUTION"
        step_name = "Code Execution"
        tool_name = "python_interpreter"

        # Format the code (truncate if too long)
        code = str(step.code_action)
        MAX_CODE_LENGTH = 1000
        content = code[:MAX_CODE_LENGTH] + "..." if len(code) > MAX_CODE_LENGTH else code
        tool_args = code[:500]  # Store truncated code in args

        # Append observations/output if available
        if step.observations:
            obs = str(step.observations)
            MAX_OUTPUT_LENGTH = 500
            output_truncated = obs[:MAX_OUTPUT_LENGTH] + "..." if len(obs) > MAX_OUTPUT_LENGTH else obs
            content += f"\n\n--- Output ---\n{output_truncated}"

        logger.info(f"CodeAgent step: code_action detected, {len(code)} chars")

    else:
        # No tool calls or code - check for raw model output
        logger.debug(f"ActionStep without tool_calls/code_action: model_output={'exists' if step.model_output else 'None'}")

        if step.model_output:
            # Use model's raw output as reasoning step
            step_type = "REASONING"
            step_name = "Model Reasoning (No Tool Call)"
            raw_output = str(step.model_output)
            MAX_LENGTH = 500
            content = raw_output[:MAX_LENGTH] + "..." if len(raw_output) > MAX_LENGTH else raw_output
        else:
            # Fallback: use observations if available
            step_name = "Agent Step"
            if step.observations:
                obs = str(step.observations)
                MAX_LENGTH = 500
                content = obs[:MAX_LENGTH] + "..." if len(obs) > MAX_LENGTH else obs

    # Build metadata dict with only non-None string values (protobuf requires map<string, string>)
    metadata_dict: Dict[str, str] = {}
    if tool_name != "unknown":
        metadata_dict["tool"] = tool_name
    if tool_args != "{}":
        metadata_dict["arguments"] = tool_args
    if content:
        metadata_dict["observations"] = content

    # Add skill metadata for managed agents and skill-related tools
    # This enables UI to show skill execution progress
    # Pattern-based detection: *_builder, *_agent, tool_executor, skill-*
    is_managed_agent = (
        tool_name.endswith("_builder") or
        tool_name.endswith("_agent") or
        tool_name == "tool_executor" or
        tool_name == "system_designer" or
        tool_name.startswith("skill-")
    )

    if is_managed_agent:
        metadata_dict["skill_name"] = tool_name
        # Determine status based on observations (completed if we have output)
        metadata_dict["skill_status"] = "completed" if content else "executing"

        # Build descriptive message from tool arguments and observations
        skill_message = build_skill_message(tool_name, tool_args, content)
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
            messages.append(f"Running: {task[:100]}{'...' if len(task) > 100 else ''}")
        if tool:
            messages.append(f"Using tool: {tool}")

    elif tool_name.endswith("_builder") or tool_name.endswith("_agent") or tool_name == "system_designer":
        # Generic handler for all managed agents (*_builder, *_agent, system_designer)
        task = args.get("task", args.get("request", ""))
        if task:
            # Format agent name for display: schema_builder -> Schema
            display_name = tool_name.replace("_builder", "").replace("_agent", "").replace("_", " ").title()
            messages.append(f"{display_name}: {task[:100]}{'...' if len(task) > 100 else ''}")

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
            messages.append(f"Failed: {observations[:100]}{'...' if len(observations) > 100 else ''}")

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
