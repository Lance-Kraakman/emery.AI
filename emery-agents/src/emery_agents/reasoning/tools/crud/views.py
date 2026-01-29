"""
View CRUD operations as DSPy-compatible functions.

Ported from tools/view_tools.py.
"""

from __future__ import annotations

from typing import Any

import dspy

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_view_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create view_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the view_crud function
    """

    def view_crud(
        method: str,
        view_id: str | int | None = None,
        table_id: str | int | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """Manage data views (filtered views of database tables).

        Data views connect database tables to Puck visual components.

        View Types:
        - grid: Table display (for DataBlock, TableBlock)
        - metric: Single aggregated value (for MetricBlock)
        - chart: Data visualization (for ChartBlock)
        - form: Create/edit rows (for FormBlock)

        Args:
            method: Operation - list, read, create, update, delete, execute
            view_id: View ID for read/update/delete/execute
            table_id: Table ID filter for list operation
            data: Data for create/update: {tableId, name, viewType, filters?, sorting?, fieldMappings?}

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        method = method.lower()

        if method == "list":
            endpoint = "views"
            if table_id:
                endpoint += f"&table_id={table_id}"
            return make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not view_id:
                return "ERROR: view_id required for read"
            return make_request(
                endpoint=f"views/{view_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "create":
            if not data:
                return "ERROR: data required for create"
            if not data.get("tableId"):
                return "ERROR: data.tableId required for create"
            if not data.get("name"):
                return "ERROR: data.name required for create"
            if not data.get("viewType"):
                data["viewType"] = "grid"  # Default to grid
            return make_request(
                endpoint="views",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not view_id:
                return "ERROR: view_id required for update"
            return make_request(
                endpoint=f"views/{view_id}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not view_id:
                return "ERROR: view_id required for delete"
            return make_request(
                endpoint=f"views/{view_id}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "execute":
            if not view_id:
                return "ERROR: view_id required for execute"
            execute_data: dict[str, Any] = {}
            if data:
                if "pagination" in data:
                    execute_data["pagination"] = data["pagination"]
                if "additionalFilters" in data:
                    execute_data["additionalFilters"] = data["additionalFilters"]
            return make_request(
                endpoint=f"views/{view_id}/execute",
                method="POST",
                data=execute_data if execute_data else None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Valid: list, read, create, update, delete, execute"

    return dspy.Tool(
        func=view_crud,
        name="view_crud",
        desc="Data view management: list, read, create, update, delete, execute. View types: grid, metric, chart, form.",
        arg_desc={
            "method": "Operation: list, read, create, update, delete, execute",
            "view_id": "View ID (required for read, update, delete, execute)",
            "table_id": "Table ID filter for list operation",
            "data": "View data: {tableId, name, viewType, filters?, sorting?, fieldMappings?}",
        },
    )
