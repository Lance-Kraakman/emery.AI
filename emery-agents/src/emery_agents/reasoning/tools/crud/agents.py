"""
Agent CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_agent_crud).
"""

from __future__ import annotations

from typing import Any

import dspy

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_agent_crud(api_key: str, org_id: str) -> dspy.Tool:
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
    ) -> str:
        """Agent management: create, read, update, delete, list.

        Args:
            method: Operation - create, read, update, delete, list
            agent_id: Agent ID for read, update, delete operations
            data: Agent data for create and update operations
            filters: Filter criteria for list operation

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
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: create, read, update, delete, list"

    return dspy.Tool(
        func=agent_crud,
        name="agent_crud",
        desc="Agent management: create, read, update, delete, list agents.",
        arg_desc={
            "method": "Operation: create, read, update, delete, list",
            "agent_id": "Agent ID (required for read, update, delete)",
            "data": "Agent data for create/update operations",
            "filters": "Filter criteria for list operation",
        },
    )
