"""
Team CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_team_crud).
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.api.http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_team_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create team_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the team_crud function
    """

    def team_crud(
        method: str,
        team_id: str | None = None,
        data: dict[str, Any] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> str:
        """Team management: create, read, update, delete, list.

        Args:
            method: Operation - create, read, update, delete, list
            team_id: Team ID for read, update, delete operations
            data: Team data for create and update operations
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
                return "ERROR: Team data is required for create operation"
            return make_request(
                endpoint="teams",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not team_id:
                return "ERROR: team_id is required for read operation"
            return make_request(
                endpoint=f"teams/{team_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not team_id:
                return "ERROR: team_id is required for update operation"
            if not data:
                return "ERROR: Team data is required for update operation"
            return make_request(
                endpoint=f"teams/{team_id}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not team_id:
                return "ERROR: team_id is required for delete operation"
            return make_request(
                endpoint=f"teams/{team_id}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "list":
            endpoint = "teams"
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
        func=team_crud,
        name="team_crud",
        desc="Team management: create, read, update, delete, list teams.",
        arg_desc={
            "method": "Operation: create, read, update, delete, list",
            "team_id": "Team ID (required for read, update, delete)",
            "data": "Team data for create/update operations",
            "filters": "Filter criteria for list operation",
        },
    )
