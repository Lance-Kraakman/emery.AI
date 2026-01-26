"""Table CRUD tool - thin wrapper on TableAPI.

Ported from tools/table_tools.py.
Refactored to use shared typed API layer.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any, Callable

from ..api import TableAPI
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
    api = TableAPI(api_key, org_id)

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

        if method == "list_tables":
            database_id = None
            if filters and "databaseId" in filters:
                database_id = int(filters["databaseId"])
            tables = api.list(database_id=database_id, filters=filters)
            return json.dumps({"data": [asdict(t) for t in tables]})

        elif method == "read_table":
            if not table_id:
                return "ERROR: table_id is required for read_table operation"
            table = api.get(int(table_id))
            if table is None:
                return "ERROR: Table not found"
            return json.dumps(asdict(table))

        elif method == "create_table":
            if not data:
                return "ERROR: Table data is required for create_table. Provide {name, databaseId, description}"
            if "databaseId" not in data:
                return "ERROR: databaseId is required for create_table"
            table = api.create(
                name=data.get("name", ""),
                database_id=int(data["databaseId"]),
                description=data.get("description", ""),
            )
            if table is None:
                return "ERROR: Failed to create table"
            return json.dumps(asdict(table))

        elif method == "update_table":
            if not table_id:
                return "ERROR: table_id is required for update_table operation"
            if not data:
                return "ERROR: Table data is required for update_table. Provide {name, description, metadata}"
            table = api.update(int(table_id), data)
            if table is None:
                return "ERROR: Failed to update table"
            return json.dumps(asdict(table))

        elif method == "delete_table":
            if not table_id:
                return "ERROR: table_id is required for delete_table operation"
            success = api.delete(int(table_id))
            if not success:
                return "ERROR: Failed to delete table"
            return json.dumps({"success": True, "deleted_id": table_id})

        else:
            return f"ERROR: Unknown method: {method}. Supported: create_table, read_table, update_table, delete_table, list_tables"

    return table_crud
