"""
Database CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_database_crud).
"""

from __future__ import annotations

from typing import Any, Callable

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_database_crud(api_key: str, org_id: str) -> Callable[..., str]:
    """
    Factory: Create database_crud function with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        database_crud function that DSPy ReAct can use
    """

    def database_crud(
        method: str,
        database_id: str | None = None,
        data: dict[str, Any] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> str:
        """Database management: list, read, create, update, delete.

        Args:
            method: Operation - list, read, create, update, delete
            database_id: Database ID for read, update, delete operations
            data: Database data for create/update: {name, description}
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
                return "ERROR: Database data is required for create. Provide {name, description}"
            return make_request(
                endpoint="databases?format=llm",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not database_id:
                return "ERROR: database_id is required for read operation"
            return make_request(
                endpoint=f"databases/{database_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not database_id:
                return "ERROR: database_id is required for update operation"
            if not data:
                return "ERROR: Database data is required for update"
            return make_request(
                endpoint=f"databases/{database_id}?format=llm",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not database_id:
                return "ERROR: database_id is required for delete operation"
            return make_request(
                endpoint=f"databases/{database_id}?format=llm",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "list":
            endpoint = "databases?format=llm"
            if filters:
                for key, value in filters.items():
                    endpoint += f"&{key}={value}"
            return make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: list, read, create, update, delete"

    return database_crud
