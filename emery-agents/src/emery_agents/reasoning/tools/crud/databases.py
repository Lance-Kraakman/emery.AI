"""Database CRUD tool - thin wrapper on DatabaseAPI.

Ported from tools/crud_tools.py (load_database_crud).
Refactored to use shared typed API layer.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any

import dspy

from emery_agents.api import DatabaseAPI
from ..mutation_guard import check_mutation_allowed


def create_database_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create database_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the database_crud function
    """
    api = DatabaseAPI(api_key, org_id)

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

        if method == "list":
            databases = api.list(filters=filters)
            return json.dumps({"data": [asdict(db) for db in databases]})

        elif method == "read":
            if not database_id:
                return "ERROR: database_id is required for read operation"
            db = api.get(int(database_id))
            if db is None:
                return "ERROR: Database not found"
            return json.dumps(asdict(db))

        elif method == "create":
            if not data:
                return "ERROR: Database data is required for create. Provide {name, description}"
            db = api.create(
                name=data.get("name", ""),
                description=data.get("description", ""),
            )
            if db is None:
                return "ERROR: Failed to create database"
            return json.dumps(asdict(db))

        elif method == "update":
            if not database_id:
                return "ERROR: database_id is required for update operation"
            if not data:
                return "ERROR: Database data is required for update"
            db = api.update(int(database_id), data)
            if db is None:
                return "ERROR: Failed to update database"
            return json.dumps(asdict(db))

        elif method == "delete":
            if not database_id:
                return "ERROR: database_id is required for delete operation"
            success = api.delete(int(database_id))
            if not success:
                return "ERROR: Failed to delete database"
            return json.dumps({"success": True, "deleted_id": database_id})

        else:
            return f"ERROR: Unknown method: {method}. Supported: list, read, create, update, delete"

    return dspy.Tool(
        func=database_crud,
        name="database_crud",
        desc="Database management: list, read, create, update, delete databases.",
        arg_desc={
            "method": "Operation: list, read, create, update, delete",
            "database_id": "Database ID (required for read, update, delete)",
            "data": "Database data for create/update: {name: str, description?: str}",
            "filters": "Filter criteria for list operation",
        },
    )
