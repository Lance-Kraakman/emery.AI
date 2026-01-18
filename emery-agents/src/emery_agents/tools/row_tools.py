"""Row CRUD operations - create, get, update, delete rows."""

import logging
from typing import Any, Dict, Optional
from smolagents import Tool
from .crud_tools import BaseCrudTool
from ..grpc.generated.agent_worker_pb2 import ToolConfig

logger = logging.getLogger(__name__)


def load_row_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
    """
    Load Row CRUD tool for row-level operations.

    AIDEV-NOTE: Supports 4 row operations: create_row, get_rows, update_row, delete_row
    Table operations are in table_tools.py (load_table_crud).
    Field operations are in field_tools.py (load_field_crud).

    For reference tools (e.g., emery-get-rows from @ mentions), config.config may contain
    pre-configured table_id from the frontend ToolDTO.

    Auth is captured in closure variables (_auth_token, _org_id) - NOT exposed in inputs.
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    # Extract pre-configured table_id from config if present (for reference tools)
    _preconfigured_table_id = config.config.get("table_id") if config and config.config else None

    class RowCrudTool(BaseCrudTool):
        """CRUD operations for Emery table rows."""

        name = "row_crud"
        description = "Row management: create_row (add row), get_rows (query with pagination/filters), update_row (modify row), delete_row (remove row)."
        inputs = {
            "method": {"type": "string", "description": "Operation: create_row, get_rows, update_row, delete_row"},
            "table_id": {"type": "string", "description": "Table ID (required for all operations)", "nullable": True},
            "row_id": {"type": "string", "description": "Row ID (required for update_row, delete_row)", "nullable": True},
            "data": {"type": "object", "description": "Field values for create/update: {field_name: value, ...}", "nullable": True},
            "limit": {"type": "integer", "description": "Max rows to return for get_rows (default: 100)", "nullable": True},
            "offset": {"type": "integer", "description": "Pagination offset for get_rows (default: 0)", "nullable": True},
            "order_by": {"type": "string", "description": "Field to sort by for get_rows", "nullable": True},
            "order_direction": {"type": "string", "description": "Sort direction: ASC or DESC", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria: [{field, operator, value}]. Operators: equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty", "nullable": True}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("row", "crud")

        def forward(self, method: str, table_id: Optional[str] = None, row_id: Optional[str] = None,
                   data: Optional[Dict] = None, limit: Optional[int] = None,
                   offset: Optional[int] = None, order_by: Optional[str] = None,
                   order_direction: Optional[str] = None, filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute row CRUD operation."""

            # Check if mutation is allowed during planning phase
            blocked = self._check_mutation_allowed(method)
            if blocked:
                return blocked

            # Pre-configured table_id takes priority over LLM-provided (for reference tools)
            effective_table_id = _preconfigured_table_id or table_id

            if method == "create_row":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for create_row operation"}
                if not data:
                    return {"success": False, "error": "Row data is required for create_row. Provide field values {field_1: value1, field_2: value2}"}

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint="rows?format=llm",
                    method="POST",
                    data={"tableId": int(effective_table_id), "data": data},
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "get_rows":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for get_rows operation"}

                # Build query parameters with TOON format for minimal tokens
                query_params = [f"tableId={effective_table_id}", "format=llm"]

                # Add pagination parameters
                if limit is not None:
                    query_params.append(f"limit={limit}")
                else:
                    query_params.append("limit=100")  # Default to 100

                if offset is not None:
                    query_params.append(f"offset={offset}")
                else:
                    query_params.append("offset=0")  # Default to 0

                # Add sorting parameters
                if order_by:
                    query_params.append(f"orderBy={order_by}")
                if order_direction:
                    query_params.append(f"orderDirection={order_direction}")

                endpoint = "rows?" + "&".join(query_params)

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "update_row":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for update_row operation"}
                if not row_id:
                    return {"success": False, "error": "Row ID is required for update_row operation"}
                if not data:
                    return {"success": False, "error": "Row data is required for update_row. Provide updated field values"}

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint="rows?format=llm",
                    method="PUT",
                    data={"tableId": int(effective_table_id), "rowId": row_id, "data": data},
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "delete_row":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for delete_row operation"}
                if not row_id:
                    return {"success": False, "error": "Row ID is required for delete_row operation"}

                # Request TOON format for minimal token usage
                endpoint = f"rows?tableId={effective_table_id}&rowId={row_id}&format=llm"

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {
                    "success": False,
                    "error": f"Unknown method: {method}. Supported: create_row, get_rows, update_row, delete_row"
                }

    return RowCrudTool()
