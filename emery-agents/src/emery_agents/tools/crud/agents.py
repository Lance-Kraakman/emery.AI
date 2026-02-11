"""
Agent CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_agent_crud).
Includes dynamic execution via execute method.
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.api.http_client import make_request

from ..execution.dynamic_execution import execute_agent_by_id
from ..mutation_guard import check_mutation_allowed


def create_agent_crud(
    api_key: str, org_id: str, extra_headers: dict[str, str] | None = None
) -> dspy.Tool:
    """
    Factory: Create agent_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the agent_crud function
    """

    def agent_crud(
        method: str,
        agent_id: str | None = None,
        data: dict[str, Any] | None = None,
        filters: dict[str, Any] | None = None,
        task: str | None = None,
    ) -> str:
        """Agent management: create, read, update, delete, list, execute.

        Args:
            method: Operation - create, read, update, delete, list, execute
            agent_id: Agent ID for read, update, delete, execute operations
            data: Agent data for create and update operations
            filters: Filter criteria for list operation
            task: Task instructions for execute operation

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        if method == "create":
            if not data:
                return "ERROR: Agent data is required for create operation"
            return make_request(
                endpoint="agents",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "read":
            if not agent_id:
                return "ERROR: agent_id is required for read operation"
            return make_request(
                endpoint=f"agents/{agent_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "update":
            if not agent_id:
                return "ERROR: agent_id is required for update operation"
            if not data:
                return "ERROR: Agent data is required for update operation"
            return make_request(
                endpoint=f"agents/{agent_id}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "delete":
            if not agent_id:
                return "ERROR: agent_id is required for delete operation"
            return make_request(
                endpoint=f"agents/{agent_id}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "list":
            endpoint = "agents"
            if filters:
                query_params = [f"{k}={v}" for k, v in filters.items()]
                if query_params:
                    endpoint += "?" + "&".join(query_params)
            return make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        elif method == "execute":
            if not agent_id:
                return "ERROR: agent_id is required for execute operation"
            if not task:
                return "ERROR: task is required for execute operation"

            # Validate agent_id is numeric
            try:
                agent_id_int = int(agent_id)
            except ValueError:
                return (
                    f"ERROR: agent_id must be a NUMBER, not '{agent_id}'. "
                    f"First call agent_crud(method='list') to find agent IDs."
                )

            # Execute agent with dynamic credential resolution
            return execute_agent_by_id(
                agent_id=agent_id_int,
                task=task,
                api_key=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: create, read, update, delete, list, execute"

    return dspy.Tool(
        func=agent_crud,
        name="agent_crud",
        desc="Agent management: create, read, update, delete, list, execute agents.",
        arg_desc={
            "method": "Operation: create, read, update, delete, list, execute",
            "agent_id": "Agent ID (required for read, update, delete, execute)",
            "data": "Agent data for create/update operations",
            "filters": "Filter criteria for list operation",
            "task": "Task instructions for execute operation",
        },
    )
