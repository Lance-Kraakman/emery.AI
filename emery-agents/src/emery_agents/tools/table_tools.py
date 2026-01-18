"""Table CRUD operations - create, read, update, delete, list tables."""

import logging
from typing import Any, Dict, Optional
from smolagents import Tool
from .crud_tools import BaseCrudTool
from ..grpc.generated.agent_worker_pb2 import ToolConfig

logger = logging.getLogger(__name__)


def load_table_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
    """
    Load Table CRUD tool for table-level operations only.

    AIDEV-NOTE: Supports 5 table operations: create_table, read_table, update_table, delete_table, list_tables
    Row operations have been moved to row_tools.py (load_row_crud).
    Field operations are in field_tools.py (load_field_crud).

    For reference tools (e.g., emery-read-table from @ mentions), config.config may contain
    pre-configured table_id from the frontend ToolDTO.

    Auth is captured in closure variables (_auth_token, _org_id) - NOT exposed in inputs.
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    # Extract pre-configured table_id from config if present (for reference tools)
    _preconfigured_table_id = config.config.get("table_id") if config and config.config else None

    class TableCrudTool(BaseCrudTool):
        """CRUD operations for Emery tables."""

        name = "table_crud"
        description = "Table management: create_table (create new table), read_table (get table details and schema), update_table (modify metadata), delete_table (remove table), list_tables (list all tables)."
        inputs = {
            "method": {"type": "string", "description": "Operation: create_table, read_table, update_table, delete_table, list_tables"},
            "table_id": {"type": "string", "description": "Table ID (required for read, update, delete)", "nullable": True},
            "data": {"type": "object", "description": "For create: {name, databaseId, description}. For update: {name, description}", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list_tables (e.g., {databaseId: 5})", "nullable": True}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("table", "crud")

        def forward(self, method: str, table_id: Optional[str] = None,
                   data: Optional[Dict] = None, filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute table CRUD operation."""

            # Check if mutation is allowed during planning phase
            blocked = self._check_mutation_allowed(method)
            if blocked:
                return blocked

            # Pre-configured table_id takes priority over LLM-provided (for reference tools)
            effective_table_id = _preconfigured_table_id or table_id

            if method == "create_table":
                if not data:
                    return {"success": False, "error": "Table data is required for create_table. Provide {name, databaseId, description}"}

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint="tables?format=llm",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "read_table":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for read_table operation"}

                return self._make_api_request_with_deadline(
                    endpoint=f"tables/{effective_table_id}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "update_table":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for update_table operation"}
                if not data:
                    return {"success": False, "error": "Table data is required for update_table. Provide {name, description, metadata}"}

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint=f"tables/{effective_table_id}?format=llm",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "delete_table":
                if not effective_table_id:
                    return {"success": False, "error": "Table ID is required for delete_table operation"}

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint=f"tables/{effective_table_id}?format=llm",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "list_tables":
                # Request TOON format for minimal token usage
                endpoint = "tables?format=llm"
                if filters:
                    for key, value in filters.items():
                        endpoint += f"&{key}={value}"

                return self._make_api_request_with_deadline(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {
                    "success": False,
                    "error": f"Unknown method: {method}. Supported: create_table, read_table, update_table, delete_table, list_tables"
                }

    return TableCrudTool()
