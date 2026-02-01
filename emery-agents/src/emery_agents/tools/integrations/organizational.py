"""
Organizational Tools - Context tools for organizational analysis.

Ported from tools/organizational_tools.py - removes smolagents.Tool dependency.
"""

from __future__ import annotations

from typing import Any, Callable

from emery_agents.entities.tool_config import ToolConfig


class EmeryDatabaseTool:
    """Mock Emery database tool providing organizational CRUD operations.

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type
    """

    name = "emery_database"
    description = "Mock Emery database tool for organizational context management. Supports actions: list_tables, create_organization, get_organization, update_organization, save_analysis_capabilities."
    inputs = {
        "action": {
            "type": "string",
            "description": "Action to perform: list_tables, create_organization, get_organization, update_organization, save_analysis_capabilities",
        },
        "organization_data": {
            "type": "object",
            "description": "Organization data for create_organization",
            "nullable": True,
        },
        "organization_id": {
            "type": "integer",
            "description": "Organization ID for get/update operations",
            "nullable": True,
        },
        "updates": {"type": "object", "description": "Updates for update_organization", "nullable": True},
        "capabilities": {
            "type": "object",
            "description": "Capabilities data for save_analysis_capabilities",
            "nullable": True,
        },
    }
    output_type = "object"

    def __init__(self) -> None:
        self.organizations: dict[int, dict[str, Any]] = {}
        self.tables = {
            1: {"id": 1, "name": "Customers", "organization_id": 1, "field_count": 15},
            2: {"id": 2, "name": "Orders", "organization_id": 1, "field_count": 8},
            3: {"id": 3, "name": "Products", "organization_id": 1, "field_count": 12},
            4: {"id": 4, "name": "Analysis_Results", "organization_id": 1, "field_count": 20},
        }

    def __call__(self, **kwargs: Any) -> dict[str, Any]:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(
        self,
        action: str,
        organization_data: dict[str, Any] | None = None,
        organization_id: int | None = None,
        updates: dict[str, Any] | None = None,
        capabilities: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute database operations."""
        if action == "list_tables":
            return {"success": True, "tables": list(self.tables.values()), "count": len(self.tables)}

        elif action == "create_organization":
            org_data = organization_data or {}
            org_id = len(self.organizations) + 1

            organization = {
                "id": org_id,
                "name": org_data.get("name", f"Organization_{org_id}"),
                "industry": org_data.get("industry"),
                "company_size": org_data.get("company_size"),
                "business_model": org_data.get("business_model"),
                "website": org_data.get("website"),
                "created_at": "2024-01-15T10:00:00Z",
                "analysis_status": "initialized",
                "capabilities": {},
            }

            self.organizations[org_id] = organization
            return {"success": True, "organization": organization, "organization_id": org_id}

        elif action == "get_organization":
            org_id = organization_id
            if org_id in self.organizations:
                return {"success": True, "organization": self.organizations[org_id]}
            return {"success": False, "error": f"Organization {org_id} not found"}

        elif action == "update_organization":
            org_id = organization_id
            updates_data = updates or {}

            if org_id not in self.organizations:
                return {"success": False, "error": f"Organization {org_id} not found"}

            self.organizations[org_id].update(updates_data)
            return {"success": True, "organization": self.organizations[org_id]}

        elif action == "save_analysis_capabilities":
            org_id = organization_id
            capabilities_data = capabilities or {}

            if org_id not in self.organizations:
                return {"success": False, "error": f"Organization {org_id} not found"}

            self.organizations[org_id]["capabilities"] = capabilities_data
            self.organizations[org_id]["analysis_status"] = "completed"

            return {"success": True, "organization": self.organizations[org_id], "capabilities_saved": True}

        else:
            return {"success": False, "error": f"Unknown action: {action}"}


class TableSchemaTool:
    """Mock table schema tool providing field definitions.

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type
    """

    name = "table_schema"
    description = "Mock table schema tool for field information. Supports action: list_fields with tableId parameter."
    inputs = {
        "action": {"type": "string", "description": "Action to perform: list_fields"},
        "tableId": {"type": "integer", "description": "Table ID to get schema for"},
    }
    output_type = "object"

    def __init__(self) -> None:
        self.field_definitions = {
            1: {  # Customers table
                "fields": [
                    {"id": 10, "name": "customer_name", "type": "text", "required": True},
                    {"id": 11, "name": "email", "type": "email", "required": True},
                    {"id": 12, "name": "company", "type": "text", "required": False},
                    {"id": 13, "name": "industry", "type": "text", "required": False},
                    {"id": 14, "name": "annual_revenue", "type": "number", "required": False},
                    {"id": 15, "name": "employee_count", "type": "number", "required": False},
                ],
                "count": 6,
            },
            4: {  # Analysis_Results table
                "fields": [
                    {"id": 40, "name": "analysis_type", "type": "text", "required": True},
                    {"id": 41, "name": "website_url", "type": "url", "required": False},
                    {"id": 42, "name": "industry_classification", "type": "text", "required": False},
                    {"id": 43, "name": "business_model", "type": "text", "required": False},
                    {"id": 44, "name": "key_insights", "type": "text", "required": False},
                    {"id": 45, "name": "confidence_score", "type": "number", "required": False},
                    {"id": 46, "name": "recommendations", "type": "text", "required": False},
                    {"id": 47, "name": "measurement_framework", "type": "text", "required": False},
                    {"id": 48, "name": "kpi_definitions", "type": "text", "required": False},
                    {"id": 49, "name": "process_definitions", "type": "text", "required": False},
                ],
                "count": 10,
            },
        }

    def __call__(self, **kwargs: Any) -> dict[str, Any]:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(self, action: str, tableId: int) -> dict[str, Any]:
        """Get table schema information."""
        if action == "list_fields":
            if tableId in self.field_definitions:
                return {
                    "success": True,
                    "fields": self.field_definitions[tableId]["fields"],
                    "count": self.field_definitions[tableId]["count"],
                    "table_id": tableId,
                }
            return {"success": False, "error": f"Table {tableId} not found"}

        return {"success": False, "error": f"Unknown action: {action}"}


class TableDataTool:
    """Mock table data tool for organizational analysis context storage.

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type
    """

    name = "table_data"
    description = "Mock table data tool for storing/retrieving organizational context. Supports actions: get_rows, create_row, update_row, search_rows with tableId parameter."
    inputs = {
        "action": {"type": "string", "description": "Action to perform: get_rows, create_row, update_row, search_rows"},
        "tableId": {"type": "integer", "description": "Table ID to operate on"},
        "limit": {"type": "integer", "description": "Limit for get_rows", "nullable": True},
        "offset": {"type": "integer", "description": "Offset for get_rows", "nullable": True},
        "row_data": {"type": "object", "description": "Row data for create_row/update_row", "nullable": True},
        "row_id": {"type": "integer", "description": "Row ID for update_row", "nullable": True},
        "criteria": {"type": "object", "description": "Search criteria for search_rows", "nullable": True},
    }
    output_type = "object"

    def __init__(self) -> None:
        # Context-specific data storage for organizational analysis
        # Uses numeric field IDs as column keys for immutability
        self.table_data: dict[int, dict[int, dict[int, Any]]] = {
            1: {  # Customers table data
                1: {10: "Acme Corp", 11: "contact@acme.com", 12: "Technology Solutions", 13: "software", 14: 5000000, 15: 50},
                2: {10: "Beta Industries", 11: "info@beta.com", 12: "Manufacturing", 13: "manufacturing", 14: 15000000, 15: 200},
                3: {10: "Gamma Services", 11: "hello@gamma.com", 12: "Consulting", 13: "consulting", 14: 2000000, 15: 25},
            },
            4: {},  # Analysis_Results table - empty initially
        }
        self.row_counter: dict[int, int] = {1: 3, 4: 0}

    def __call__(self, **kwargs: Any) -> dict[str, Any]:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(
        self,
        action: str,
        tableId: int,
        limit: int = 10,
        offset: int = 0,
        row_data: dict[str, Any] | None = None,
        row_id: int | None = None,
        criteria: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute table data operations."""
        if action == "get_rows":
            if tableId not in self.table_data:
                return {"success": False, "error": f"Table {tableId} not found"}

            rows = list(self.table_data[tableId].values())
            total_count = len(rows)

            paginated_rows = rows[offset : offset + limit]

            return {
                "success": True,
                "rows": paginated_rows,
                "count": len(paginated_rows),
                "totalCount": total_count,
                "table_id": tableId,
            }

        elif action == "create_row":
            row_data = row_data or {}

            if tableId not in self.table_data:
                return {"success": False, "error": f"Table {tableId} not found"}

            self.row_counter[tableId] = self.row_counter.get(tableId, 0) + 1
            new_row_id = self.row_counter[tableId]

            self.table_data[tableId][new_row_id] = row_data

            return {"success": True, "row_id": new_row_id, "row_data": row_data, "table_id": tableId}

        elif action == "update_row":
            row_data = row_data or {}

            if tableId not in self.table_data:
                return {"success": False, "error": f"Table {tableId} not found"}

            if row_id not in self.table_data[tableId]:
                return {"success": False, "error": f"Row {row_id} not found in table {tableId}"}

            self.table_data[tableId][row_id].update(row_data)

            return {"success": True, "row_id": row_id, "row_data": self.table_data[tableId][row_id], "table_id": tableId}

        elif action == "search_rows":
            search_criteria = criteria or {}

            if tableId not in self.table_data:
                return {"success": False, "error": f"Table {tableId} not found"}

            matching_rows = []
            for rid, rdata in self.table_data[tableId].items():
                match = True
                for field, value in search_criteria.items():
                    if field not in rdata or str(rdata[field]).lower() != str(value).lower():
                        match = False
                        break
                if match:
                    matching_rows.append({"row_id": rid, **rdata})

            return {
                "success": True,
                "rows": matching_rows,
                "count": len(matching_rows),
                "table_id": tableId,
                "search_criteria": search_criteria,
            }

        else:
            return {"success": False, "error": f"Unknown action: {action}"}


def load_emery_database(config: ToolConfig) -> EmeryDatabaseTool:
    """Load mock Emery database tool for organizational context."""
    return EmeryDatabaseTool()


def load_table_schema(config: ToolConfig) -> TableSchemaTool:
    """Load mock table schema tool for field information."""
    return TableSchemaTool()


def load_table_data(config: ToolConfig) -> TableDataTool:
    """Load mock table data tool for storing/retrieving organizational context."""
    return TableDataTool()


# Registry of organizational tools
ORGANIZATIONAL_TOOLS = {
    "emery_database": load_emery_database,
    "table_schema": load_table_schema,
    "table_data": load_table_data,
}
