"""
Row CRUD operations as DSPy-compatible functions.

Ported from tools/row_tools.py.
"""

from __future__ import annotations

from typing import Any

import dspy

from emery_agents.api.http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_row_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create row_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the row_crud function
    """

    def row_crud(
        method: str,
        table_id: str | None = None,
        row_id: str | None = None,
        data: dict[str, Any] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        order_by: str | None = None,
        order_direction: str | None = None,
        filters: list[dict[str, Any]] | None = None,
    ) -> str:
        """Row management: create_row, get_rows, update_row, delete_row.

        Args:
            method: Operation - create_row, get_rows, update_row, delete_row
            table_id: Table ID (required for all operations)
            row_id: Row ID (required for update_row, delete_row)
            data: Field values for create/update: {field_name: value, ...}
            limit: Max rows to return for get_rows (default: 100)
            offset: Pagination offset for get_rows (default: 0)
            order_by: Field to sort by for get_rows
            order_direction: Sort direction: ASC or DESC
            filters: Filter criteria: [{field, operator, value}]

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        if method == "create_row":
            if not table_id:
                return "ERROR: table_id is required for create_row operation"
            if not data:
                return "ERROR: Row data is required for create_row. Provide {field_name: value, ...}"
            return make_request(
                endpoint="rows",
                method="POST",
                data={"tableId": int(table_id), "data": data},
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "get_rows":
            if not table_id:
                return "ERROR: table_id is required for get_rows operation"

            query_params = [f"tableId={table_id}"]
            query_params.append(f"limit={limit or 100}")
            query_params.append(f"offset={offset or 0}")

            if order_by:
                query_params.append(f"orderBy={order_by}")
            if order_direction:
                query_params.append(f"orderDirection={order_direction}")

            endpoint = "rows?" + "&".join(query_params)
            return make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update_row":
            if not table_id:
                return "ERROR: table_id is required for update_row operation"
            if not row_id:
                return "ERROR: row_id is required for update_row operation"
            if not data:
                return "ERROR: Row data is required for update_row"
            return make_request(
                endpoint="rows",
                method="PUT",
                data={"tableId": int(table_id), "rowId": row_id, "data": data},
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete_row":
            if not table_id:
                return "ERROR: table_id is required for delete_row operation"
            if not row_id:
                return "ERROR: row_id is required for delete_row operation"
            return make_request(
                endpoint=f"rows?tableId={table_id}&rowId={row_id}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: create_row, get_rows, update_row, delete_row"

    return dspy.Tool(
        func=row_crud,
        name="row_crud",
        desc="Row/record management: create_row, get_rows, update_row, delete_row.",
        arg_desc={
            "method": "Operation: create_row, get_rows, update_row, delete_row",
            "table_id": "Table ID (required for all operations)",
            "row_id": "Row ID (required for update_row, delete_row)",
            "data": "Field values for create/update: {field_name: value, ...}",
            "limit": "Max rows to return for get_rows (default: 100)",
            "offset": "Pagination offset for get_rows (default: 0)",
            "order_by": "Field to sort by for get_rows",
            "order_direction": "Sort direction: ASC or DESC",
            "filters": "Filter criteria: [{field, operator, value}]",
        },
    )
