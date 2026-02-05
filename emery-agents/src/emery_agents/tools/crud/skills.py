"""
Skill CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_skill_crud).
Includes dynamic execution via execute method.
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.api.http_client import make_request
from ..mutation_guard import check_mutation_allowed
from ..execution.dynamic_execution import execute_skill_by_id


def create_skill_crud(api_key: str, org_id: str, extra_headers: dict[str, str] | None = None) -> dspy.Tool:
    """
    Factory: Create skill_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the skill_crud function
    """

    def skill_crud(
        method: str,
        skill_id: str | int | None = None,
        agent_id: str | int | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """Skill management: create, read, update, list, execute.

        Skills have: name, description, instructions, inputs, outputs, tools, model.
        In instructions, reference inputs using {input_name} syntax.

        Args:
            method: Operation - create, read, update, list, execute
            skill_id: Skill ID (required for read/update/execute)
            agent_id: Agent ID (required for create, optional for list)
            data: Skill data for create/update, or inputs for execute

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        # Coerce IDs to strings
        skill_id_str = str(skill_id) if skill_id is not None else None
        agent_id_str = str(agent_id) if agent_id is not None else None

        # Validate skill_id is numeric for methods that require it
        if method in ("read", "update") and skill_id_str:
            if not skill_id_str.isdigit():
                return (
                    f"ERROR: skill_id must be a NUMBER, not '{skill_id_str}'. "
                    f"First call skill_crud(method='list') to find skill IDs."
                )

        if method == "create":
            if not data:
                return "ERROR: Skill data is required for create operation"
            if not agent_id_str:
                return "ERROR: agent_id is required for create operation"
            if "name" not in data or not data["name"]:
                return "ERROR: 'name' is required in data for create operation"

            # Normalize tools to proper object format before sending
            if "tools" in data:
                data["tools"] = [
                    t if isinstance(t, dict) else {"name": t}
                    for t in data["tools"]
                ]

            data["agentId"] = int(agent_id_str)

            return make_request(
                endpoint="skills",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "read":
            if not skill_id_str:
                return "ERROR: skill_id is required for read operation"
            return make_request(
                endpoint=f"skills/{skill_id_str}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "update":
            if not skill_id_str:
                return "ERROR: skill_id is required for update operation"
            if not data:
                return "ERROR: Skill data is required for update"

            # Check if skill is a system skill (cannot be edited)
            read_result = make_request(
                endpoint=f"skills/{skill_id_str}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )
            # Check for system skill in response
            if '"isSystem":true' in read_result or '"isSystem": true' in read_result:
                return "ERROR: System skills cannot be edited. Duplicate to create your own version."

            # Normalize tools to proper object format before sending
            if "tools" in data:
                data["tools"] = [
                    t if isinstance(t, dict) else {"name": t}
                    for t in data["tools"]
                ]

            return make_request(
                endpoint=f"skills/{skill_id_str}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "list":
            endpoint = "skills"
            if agent_id_str:
                endpoint += f"?agent_id={agent_id_str}"
            return make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "execute":
            if not skill_id_str:
                return "ERROR: skill_id is required for execute operation"
            if not skill_id_str.isdigit():
                return (
                    f"ERROR: skill_id must be a NUMBER, not '{skill_id_str}'. "
                    f"First call skill_crud(method='list') to find skill IDs."
                )

            # Execute skill with dynamic credential resolution
            inputs = data or {}
            return execute_skill_by_id(
                skill_id=int(skill_id_str),
                inputs=inputs,
                api_key=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: create, read, update, list, execute"

    return dspy.Tool(
        func=skill_crud,
        name="skill_crud",
        desc=(
            "Skill management: create, read, update, list, execute. "
            "To CREATE a new skill, use method='create' with agent_id and data containing at least 'name'. "
            "To RUN an existing skill, use method='execute' with the skill's numeric ID "
            "and optional input data. To find a skill's ID, use method='list' first. "
            "Skills have name, description, instructions, inputs, outputs, tools, model."
        ),
        arg_desc={
            "method": "Operation: create (new skill), read (get config), update (modify), list (find skills and IDs), execute (RUN a skill by ID)",
            "skill_id": "Skill ID (required for read, update, execute). Must be a number.",
            "agent_id": "Agent ID (required for create, optional for list)",
            "data": "For create: must include 'name', optional: description, instructions, inputs, outputs, tools, model, executionType. For update: skill config fields. tools format: [{\"name\": \"tool_name\"}] (objects, not bare strings). For execute: input values as {input_name: value} dict (pass {} if no inputs needed)",
        },
    )
