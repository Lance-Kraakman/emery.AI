"""
Skill Invoker Tool - Wraps user-defined skills as callable tools.

Ported from tools/skill_invoker_tool.py as DSPy-compatible function.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from ....entities.workspace import WorkspaceSkill as SkillData
from ....services.skills.validator import SkillPermissionValidator

logger = logging.getLogger(__name__)


def create_skill_invoker_tool(
    skill: SkillData,
    api_key: str | None = None,
    organization_id: int | None = None,
    skill_executor_callback: Any | None = None,
    permission_validator: SkillPermissionValidator | None = None,
) -> Callable[..., dict[str, Any]]:
    """
    Factory: Create a skill invoker function for a specific skill.

    The function wraps skill execution with HITL input gathering:
    - If all required inputs provided, executes the skill
    - If inputs missing, returns a prompt for the user to provide them

    Args:
        skill: Typed SkillData with id, name, description, inputs
        api_key: API key for skill execution
        organization_id: Organization ID for RLS context
        skill_executor_callback: Callback to execute skill (from SkillExecutorService)
        permission_validator: Optional validator to enforce skill whitelist

    Returns:
        Callable for skill invocation that DSPy ReAct can use
    """
    # Extract typed fields into closure
    _auth_token = api_key or ""
    _org_id = organization_id
    _skill_id = int(skill.id)
    _skill_name = skill.name
    _skill_description = skill.description
    _skill_inputs = skill.inputs or []
    _executor = skill_executor_callback
    _validator = permission_validator

    # Build description with input details
    input_details = []
    for inp in _skill_inputs:
        req = " (required)" if inp.get("required", False) else ""
        inp_type = inp.get("type", "text")
        input_details.append(f"  - {inp['name']}{req}: {inp_type}")

    inputs_doc = "\n".join(input_details) if input_details else "  No inputs required"

    # Create normalized tool name
    tool_name = f"skill_{_skill_name.lower().replace(' ', '_').replace('-', '_')}"

    def invoke_skill(
        inputs: dict[str, Any] | None = None,
        gather_missing: bool = True,
    ) -> dict[str, Any]:
        """Invoke a user-defined skill with HITL input gathering.

        Args:
            inputs: Input values for the skill as a dict
            gather_missing: If true and inputs are missing, return questions
                instead of failing. Default: true

        Returns:
            Dict with success status, result or error, and any missing inputs
        """
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
                questions.append(
                    {"name": inp_name, "type": inp_type, "question": f"What is the {inp_name}?"}
                )

            return {
                "success": False,
                "status": "missing_inputs",
                "message": f"I need some information to execute {_skill_name}.",
                "missing_inputs": questions,
                "hint": "Please provide the missing information.",
            }

        # If missing inputs and gather_missing=False, return error
        if missing_inputs:
            missing_names = [inp["name"] for inp in missing_inputs]
            return {"success": False, "error": f"Missing required inputs: {', '.join(missing_names)}"}

        # Execute the skill
        logger.info(
            f"[SKILL-INVOKER] Invoking skill {_skill_name} (id={_skill_id}) "
            f"with inputs: {list(provided_inputs.keys())}"
        )

        # SECURITY: Validate permission before execution
        if _validator is not None:
            try:
                _validator.validate_execution(_skill_id, _skill_name)
            except PermissionError as e:
                logger.warning(f"[SECURITY] Skill execution blocked: {e}")
                return {"success": False, "error": str(e), "blocked_by": "skill_permission_validator"}

        if _executor is None:
            return {"success": False, "error": "Skill executor not configured"}

        try:
            # The executor callback should return skill result
            result = _executor(
                skill_id=_skill_id,
                runtime_inputs=provided_inputs,
                api_key=_auth_token,
                organization_id=_org_id,
            )

            logger.info(f"[SKILL-INVOKER] Skill {_skill_name} completed successfully")
            return {"success": True, "result": result}

        except Exception as e:
            logger.error(f"[SKILL-INVOKER] Skill {_skill_name} failed: {e}")
            return {"success": False, "error": str(e)}

    # Set function metadata for DSPy introspection
    invoke_skill.__name__ = tool_name
    invoke_skill.__doc__ = f"""{_skill_description}

Inputs:
{inputs_doc}

To invoke: {tool_name}(inputs={{"input_name": "value"}})
If unsure about inputs, call with gather_missing=True to get prompts.

Args:
    inputs: Input values for the skill as a dict
    gather_missing: If true and inputs are missing, return questions instead of failing
"""

    return invoke_skill


def create_skill_invoker_tools(
    skills: list[SkillData],
    api_key: str | None = None,
    organization_id: int | None = None,
    skill_executor_callback: Any | None = None,
    permission_validator: SkillPermissionValidator | None = None,
) -> list[Callable[..., dict[str, Any]]]:
    """
    Create skill invoker functions for a list of skills.

    Args:
        skills: List of typed SkillData from API
        api_key: API key for skill execution
        organization_id: Organization ID for RLS context
        skill_executor_callback: Callback to execute skills
        permission_validator: Optional validator to enforce skill whitelist

    Returns:
        List of callable functions
    """
    tools = []

    for skill in skills:
        tool = create_skill_invoker_tool(
            skill=skill,
            api_key=api_key,
            organization_id=organization_id,
            skill_executor_callback=skill_executor_callback,
            permission_validator=permission_validator,
        )
        tools.append(tool)
        logger.debug(f"[SKILL-INVOKER] Created skill invoker: {tool.__name__}")

    return tools
