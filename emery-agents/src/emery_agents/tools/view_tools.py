"""
View CRUD tools for App/Page Builder agents.

AIDEV-NOTE: These tools provide CRUD operations for data views.
Views are filtered/sorted views of database tables used by Puck components.

AIDEV-NOTE: Uses format=llm for TOON responses to minimize token usage.
"""

import logging
from typing import Any, Dict, Optional, Union

from smolagents import Tool

from .crud_tools import BaseCrudTool

logger = logging.getLogger(__name__)


def load_view_crud(
    config: Any = None,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Load View CRUD tool with auth context in closure.

    Methods:
    - list: List all views (optionally filter by table_id)
    - read: Get view by ID
    - create: Create new view
    - update: Update view configuration
    - delete: Delete view
    - execute: Run view query to get rows
    """
    # CRITICAL: Capture auth in closure - NOT exposed in inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class ViewCrudTool(BaseCrudTool):
        """CRUD operations for data views."""

        name = "view_crud"
        description = """Manage data views (filtered views of database tables).

Data views connect your database tables to Puck visual components.

Methods:
- list: List views (filter by table_id optional)
- read: Get view details by ID
- create: Create view (requires tableId, name, viewType)
- update: Update view configuration (filters, sorting, fieldMappings)
- delete: Remove view
- execute: Run view to get rows

View Types:
- grid: Table display (for DataBlock, TableBlock)
- metric: Single aggregated value (for MetricBlock)
- chart: Data visualization (for ChartBlock)
- form: Create/edit rows (for FormBlock)

Examples:
- view_crud(method="list")
- view_crud(method="list", table_id=5)
- view_crud(method="read", view_id=10)
- view_crud(method="create", data={"tableId": 5, "name": "Active Customers", "viewType": "grid"})
- view_crud(method="update", view_id=10, data={"filters": [{"fieldId": 1, "operator": "eq", "value": "active"}]})
- view_crud(method="execute", view_id=10)
- view_crud(method="delete", view_id=10)
"""

        inputs = {
            "method": {
                "type": "string",
                "description": "Operation: list, read, create, update, delete, execute"
            },
            "view_id": {
                "type": ["string", "integer"],
                "description": "View ID for read/update/delete/execute",
                "nullable": True
            },
            "table_id": {
                "type": ["string", "integer"],
                "description": "Table ID filter for list operation",
                "nullable": True
            },
            "data": {
                "type": "object",
                "description": "Data for create/update: {tableId, name, viewType, filters?, sorting?, fieldMappings?, viewConfig?}",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("view", "crud")

        def forward(
            self,
            method: str,
            view_id: Optional[Union[str, int]] = None,
            table_id: Optional[Union[str, int]] = None,
            data: Optional[Dict] = None
        ) -> Dict[str, Any]:
            """Execute View CRUD operation."""

            # CRITICAL: Check mutation allowed during planning phase
            blocked = self._check_mutation_allowed(method)
            if blocked:
                return blocked

            method = method.lower()

            if method == "list":
                endpoint = "views?format=llm"
                if table_id:
                    endpoint += f"&table_id={table_id}"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "read":
                if not view_id:
                    return {"success": False, "error": "view_id required for read"}
                return self._make_api_request(
                    endpoint=f"views/{view_id}?format=llm",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "create":
                if not data:
                    return {"success": False, "error": "data required for create"}
                if not data.get("tableId"):
                    return {"success": False, "error": "data.tableId required for create"}
                if not data.get("name"):
                    return {"success": False, "error": "data.name required for create"}
                if not data.get("viewType"):
                    data["viewType"] = "grid"  # Default to grid
                return self._make_api_request(
                    endpoint="views?format=llm",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "update":
                if not view_id:
                    return {"success": False, "error": "view_id required for update"}
                return self._make_api_request(
                    endpoint=f"views/{view_id}?format=llm",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "delete":
                if not view_id:
                    return {"success": False, "error": "view_id required for delete"}
                return self._make_api_request(
                    endpoint=f"views/{view_id}?format=llm",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "execute":
                if not view_id:
                    return {"success": False, "error": "view_id required for execute"}
                # Execute uses POST with optional body for pagination/filters
                execute_data = {}
                if data:
                    if "pagination" in data:
                        execute_data["pagination"] = data["pagination"]
                    if "additionalFilters" in data:
                        execute_data["additionalFilters"] = data["additionalFilters"]
                return self._make_api_request(
                    endpoint=f"views/{view_id}/execute?format=llm",
                    method="POST",
                    data=execute_data if execute_data else None,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                return {"success": False, "error": f"Unknown method: {method}. Valid methods: list, read, create, update, delete, execute"}

    return ViewCrudTool()
