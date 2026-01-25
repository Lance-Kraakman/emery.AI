"""
Table CRUD operations as DSPy-compatible functions.

Ported from tools/table_tools.py.
"""

from __future__ import annotations

import json
from typing import Any, Callable

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_table_crud(api_key: str, org_id: str) -> Callable[..., str]:
    """
    Factory: Create table_crud function with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        table_crud function that DSPy ReAct can use
    """

    def table_crud(
        method: str,
        table_id: str | None = None,
        data: dict[str, Any] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> str:
        """Table management: create_table, read_table, update_table, delete_table, list_tables.

        Args:
            method: Operation - create_table, read_table, update_table, delete_table, list_tables
            table_id: Table ID (required for read, update, delete)
            data: For create: {name, databaseId, description}. For update: {name, description}
            filters: Filter criteria for list_tables (e.g., {databaseId: 5})

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        if method == "create_table":
            if not data:
                return "ERROR: Table data is required for create_table. Provide {name, databaseId, description}"
            return make_request(
                endpoint="tables?format=llm",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read_table":
            if not table_id:
                return "ERROR: table_id is required for read_table operation"
            return make_request(
                endpoint=f"tables/{table_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update_table":
            if not table_id:
                return "ERROR: table_id is required for update_table operation"
            if not data:
                return "ERROR: Table data is required for update_table. Provide {name, description, metadata}"
            return make_request(
                endpoint=f"tables/{table_id}?format=llm",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete_table":
            if not table_id:
                return "ERROR: table_id is required for delete_table operation"
            return make_request(
                endpoint=f"tables/{table_id}?format=llm",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "list_tables":
            endpoint = "tables?format=llm"
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
            return f"ERROR: Unknown method: {method}. Supported: create_table, read_table, update_table, delete_table, list_tables"

    return table_crud
