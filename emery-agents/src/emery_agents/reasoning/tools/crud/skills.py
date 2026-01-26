"""
Skill CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_skill_crud).
"""

from __future__ import annotations

from typing import Any, Callable

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_skill_crud(api_key: str, org_id: str) -> Callable[..., str]:
    """
    Factory: Create skill_crud function with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        skill_crud function that DSPy ReAct can use
    """

    def skill_crud(
        method: str,
        skill_id: str | int | None = None,
        agent_id: str | int | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """Skill management: read, update, list.

        Skills have: name, description, instructions, inputs, outputs, tools, model.
        In instructions, reference inputs using {input_name} syntax.

        Args:
            method: Operation - read, update, list
            skill_id: Skill ID (required for read/update)
            agent_id: Agent ID to filter skills (optional for list)
            data: Skill data for update (name, description, instructions, inputs, outputs, tools, model)

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

        if method == "read":
            if not skill_id_str:
                return "ERROR: skill_id is required for read operation"
            return make_request(
                endpoint=f"skills/{skill_id_str}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
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
            )
            # Check for system skill in response
            if '"isSystem":true' in read_result or '"isSystem": true' in read_result:
                return "ERROR: System skills cannot be edited. Duplicate to create your own version."

            return make_request(
                endpoint=f"skills/{skill_id_str}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
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
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: read, update, list"

    return skill_crud
