"""
File CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_file_crud).
"""

from __future__ import annotations

from typing import Any

import dspy

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def create_file_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create file_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the file_crud function
    """

    def file_crud(
        method: str,
        file_id: str | None = None,
        table_id: str | None = None,
        row_id: str | None = None,
        field_id: str | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """File management: create, read, update, delete.

        Files are stored in table row fields, so context params (table_id, row_id, field_id)
        are required for read/update/delete.

        Args:
            method: Operation - create, read, update, delete
            file_id: File ID for read, update, delete operations
            table_id: Table ID containing the file field (required for read/update/delete)
            row_id: Row ID containing the file (required for read/update/delete)
            field_id: Field ID of the file column (required for read/update/delete)
            data: File data for create and update operations

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        if method == "create":
            if not data:
                return "ERROR: File data is required for create operation"
            return make_request(
                endpoint="files/upload",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not file_id:
                return "ERROR: file_id is required for read operation"
            if not table_id or not row_id or not field_id:
                return "ERROR: Context params (table_id, row_id, field_id) required for read operation"
            endpoint = f"files/{file_id}?tableId={table_id}&rowId={row_id}&fieldId={field_id}"
            return make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not file_id:
                return "ERROR: file_id is required for update operation"
            if not data:
                return "ERROR: File data is required for update operation"
            if not table_id or not row_id or not field_id:
                return "ERROR: Context params (table_id, row_id, field_id) required for update operation"
            endpoint = f"files/{file_id}?tableId={table_id}&rowId={row_id}&fieldId={field_id}"
            return make_request(
                endpoint=endpoint,
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not file_id:
                return "ERROR: file_id is required for delete operation"
            if not table_id or not row_id or not field_id:
                return "ERROR: Context params (table_id, row_id, field_id) required for delete operation"
            endpoint = f"files/{file_id}?tableId={table_id}&rowId={row_id}&fieldId={field_id}"
            return make_request(
                endpoint=endpoint,
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: create, read, update, delete"

    return dspy.Tool(
        func=file_crud,
        name="file_crud",
        desc="File management: create, read, update, delete. Files are stored in table row fields.",
        arg_desc={
            "method": "Operation: create, read, update, delete",
            "file_id": "File ID (required for read, update, delete)",
            "table_id": "Table ID containing the file field (required for read/update/delete)",
            "row_id": "Row ID containing the file (required for read/update/delete)",
            "field_id": "Field ID of the file column (required for read/update/delete)",
            "data": "File data for create/update operations",
        },
    )
