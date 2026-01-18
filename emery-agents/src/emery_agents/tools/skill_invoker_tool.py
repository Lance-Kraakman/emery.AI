"""
Skill Invoker Tool - Wraps user-defined skills as callable tools.

AIDEV-NOTE: This tool enables AgentExecutor to invoke skills in chat mode.
Features:
- Wraps skills from an agent's skill list as callable tools
- Validates required inputs before execution
- Returns HITL prompts for missing inputs
- Delegates actual execution to SkillExecutorService
"""

import json
import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

from ..services.context_manager import get_current_context
from .tool_modes import ToolMode, MUTATION_METHODS

logger = logging.getLogger(__name__)


def create_skill_invoker_tool(
    skill_id: int,
    skill_name: str,
    skill_description: str,
    skill_inputs: List[Dict[str, Any]],
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
    skill_executor_callback: Optional[Any] = None,
) -> Tool:
    """
    Create a SkillInvokerTool for a specific skill.

    The tool wraps skill execution with HITL input gathering:
    - If all required inputs provided, executes the skill
    - If inputs missing, returns a prompt for the user to provide them

    Args:
        skill_id: Database ID of the skill
        skill_name: Display name of the skill
        skill_description: Description for routing/help text
        skill_inputs: List of InputDefinition dicts from skill config
        api_key: API key for skill execution
        organization_id: Organization ID for RLS context
        skill_executor_callback: Callback to execute skill (from SkillExecutorService)

    Returns:
        Configured Tool for skill invocation
    """
    # Capture auth in closure
    _auth_token = api_key or ""
    _org_id = organization_id
    _skill_id = skill_id
    _skill_inputs = skill_inputs or []
    _executor = skill_executor_callback

    # Build inputs schema from skill inputs
    tool_inputs_schema = {
        "inputs": {
            "type": "object",
            "description": f"Input values for the skill. Available inputs: {', '.join(i['name'] for i in _skill_inputs) if _skill_inputs else 'none'}",
            "nullable": True
        },
        "gather_missing": {
            "type": "boolean",
            "description": "If true and inputs are missing, return questions instead of failing. Default: true",
            "nullable": True
        }
    }

    # Build description with input details
    input_details = []
    for inp in _skill_inputs:
        req = " (required)" if inp.get("required", False) else ""
        inp_type = inp.get("type", "text")
        input_details.append(f"  - {inp['name']}{req}: {inp_type}")

    inputs_doc = "\n".join(input_details) if input_details else "  No inputs required"

    class SkillInvokerTool(Tool):
        """Invokes a user-defined skill with HITL input gathering."""

        name = f"skill_{skill_name.lower().replace(' ', '_').replace('-', '_')}"
        description = f"""{skill_description}

Inputs:
{inputs_doc}

To invoke: {name}(inputs={{"input_name": "value"}})
If unsure about inputs, call with gather_missing=True to get prompts.
"""

        inputs = tool_inputs_schema
        output_type = "object"

        def forward(
            self,
            inputs: Optional[Dict[str, Any]] = None,
            gather_missing: bool = True
        ) -> Dict[str, Any]:
            """Execute skill or return HITL prompts for missing inputs."""

            provided_inputs = inputs or {}

            # Validate required inputs
            missing_inputs = []
            for inp_def in _skill_inputs:
                if inp_def.get("required", False):
                    inp_name = inp_def["name"]
                    # Check if input has inputMapping (auto-populated from table)
                    has_mapping = inp_def.get("inputMapping") is not None
                    if not has_mapping and inp_name not in provided_inputs:
                        missing_inputs.append(inp_def)

            # If missing inputs and gather_missing=True, return HITL prompt
            if missing_inputs and gather_missing:
                questions = []
                for inp_def in missing_inputs:
                    inp_name = inp_def["name"]
                    inp_type = inp_def.get("type", "text")
                    questions.append({
                        "name": inp_name,
                        "type": inp_type,
                        "question": f"What is the {inp_name}?"
                    })

                return {
                    "success": False,
                    "status": "missing_inputs",
                    "message": f"I need some information to execute {skill_name}.",
                    "missing_inputs": questions,
                    "hint": "Please provide the missing information."
                }

            # If missing inputs and gather_missing=False, return error
            if missing_inputs:
                missing_names = [inp["name"] for inp in missing_inputs]
                return {
                    "success": False,
                    "error": f"Missing required inputs: {', '.join(missing_names)}"
                }

            # Execute the skill
            logger.info(f"🎯 Invoking skill {skill_name} (id={_skill_id}) with inputs: {list(provided_inputs.keys())}")

            if _executor is None:
                return {
                    "success": False,
                    "error": "Skill executor not configured"
                }

            try:
                # The executor callback should return skill result
                result = _executor(
                    skill_id=_skill_id,
                    runtime_inputs=provided_inputs,
                    api_key=_auth_token,
                    organization_id=_org_id
                )

                logger.info(f"✅ Skill {skill_name} completed successfully")
                return {
                    "success": True,
                    "result": result
                }

            except Exception as e:
                logger.error(f"❌ Skill {skill_name} failed: {e}")
                return {
                    "success": False,
                    "error": str(e)
                }

    return SkillInvokerTool()


def create_skill_invoker_tools(
    skills: List[Dict[str, Any]],
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
    skill_executor_callback: Optional[Any] = None,
) -> List[Tool]:
    """
    Create SkillInvokerTools for a list of skills.

    Args:
        skills: List of skill definitions (from API/database)
        api_key: API key for skill execution
        organization_id: Organization ID for RLS context
        skill_executor_callback: Callback to execute skills

    Returns:
        List of configured Tools
    """
    tools = []

    for skill in skills:
        tool = create_skill_invoker_tool(
            skill_id=skill["id"],
            skill_name=skill["name"],
            skill_description=skill.get("description", ""),
            skill_inputs=skill.get("inputs", []),
            api_key=api_key,
            organization_id=organization_id,
            skill_executor_callback=skill_executor_callback,
        )
        tools.append(tool)
        logger.debug(f"Created SkillInvokerTool: {tool.name}")

    return tools
