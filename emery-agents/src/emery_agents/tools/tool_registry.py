"""
Tool Registry Module

AIDEV-NOTE: Central tool registration and loading for all emery-agents tools.
Replaces the massive tool_loader.py with a clean, modular approach.
Now includes Pipedream tools for OAuth-backed integrations.
"""

import os
from typing import Any, Dict, List

from smolagents import Tool

from ..grpc.generated.agent_worker_pb2 import ToolConfig
from .base_tools import BASE_TOOLS
from .mock_email_tools import EMAIL_TOOLS
from .mock_data_tools import DATA_TOOLS
from .organizational_tools import ORGANIZATIONAL_TOOLS
from .api_tools import API_TOOLS
from .crud_tools import CRUD_TOOLS

# Conditionally import Pipedream tools based on environment
USE_PIPEDREAM_TOOLS = os.getenv("USE_PIPEDREAM_TOOLS", "false").lower() == "true"
if USE_PIPEDREAM_TOOLS:
    try:
        from .pipedream_tools import PIPEDREAM_TOOLS
        print("[TOOL-REGISTRY] Pipedream tools enabled")
    except ImportError as e:
        print(f"[TOOL-REGISTRY] Warning: Failed to import Pipedream tools: {e}")
        PIPEDREAM_TOOLS = {}
else:
    PIPEDREAM_TOOLS = {}
    print("[TOOL-REGISTRY] Pipedream tools disabled (set USE_PIPEDREAM_TOOLS=true to enable)")


class ToolRegistry:
    """Central registry for all emery-agents tools."""
    
    def __init__(self):
        """Initialize tool registry with all tool modules."""
        # AIDEV-NOTE: Combine all tool registries into single mapping
        # Pipedream tools are added when USE_PIPEDREAM_TOOLS=true
        # CRUD tools provide internal organization data management
        self._tool_registry = {
            **BASE_TOOLS,
            **EMAIL_TOOLS,
            **DATA_TOOLS,
            **ORGANIZATIONAL_TOOLS,
            **API_TOOLS,
            **CRUD_TOOLS,  # Internal CRUD operations (agents, documents, files, tables, teams)
            **PIPEDREAM_TOOLS,  # OAuth-backed integrations (Gmail, Slack, etc.)
        }
        
        # Log registry statistics
        tool_counts = {
            "base": len(BASE_TOOLS),
            "email": len(EMAIL_TOOLS),
            "data": len(DATA_TOOLS),
            "organizational": len(ORGANIZATIONAL_TOOLS),
            "api": len(API_TOOLS),
            "crud": len(CRUD_TOOLS),
            "pipedream": len(PIPEDREAM_TOOLS),
        }
        total_tools = sum(tool_counts.values())
        print(f"[TOOL-REGISTRY] Initialized with {total_tools} tools")
        if PIPEDREAM_TOOLS:
            print(f"[TOOL-REGISTRY] Including {len(PIPEDREAM_TOOLS)} Pipedream OAuth tools")
    
    def load_tool(self, tool_config: ToolConfig) -> Tool:
        """
        Load a tool instance from ToolConfig with CRUD routing support.

        Supports method-specific routing for CRUD tools:
        - agent_create -> agent_crud with method="create"
        - document_read -> document_crud with method="read"
        - file_update -> file_crud with method="update"
        - table_delete -> table_crud with method="delete"
        - team_list -> team_crud with method="list"

        Args:
            tool_config: Tool configuration from protobuf

        Returns:
            Tool instance for smolagents

        Raises:
            ValueError: If tool not found or cannot be loaded
        """
        tool_name = tool_config.name.lower()

        # AIDEV-NOTE: Handle CRUD routing - convert method-specific names to base CRUD tools
        crud_routing = self._get_crud_routing(tool_name)
        if crud_routing:
            actual_tool_name, method = crud_routing
            if actual_tool_name in self._tool_registry:
                loader_func = self._tool_registry[actual_tool_name]
                tool_instance = loader_func(tool_config)
                # AIDEV-NOTE: Set the specific method for this CRUD operation
                if hasattr(tool_instance, 'method'):
                    tool_instance.method = method
                return tool_instance

        # Standard tool loading for non-CRUD tools
        if tool_name not in self._tool_registry:
            raise ValueError(f"Unknown tool: {tool_config.name}")

        loader_func = self._tool_registry[tool_name]
        return loader_func(tool_config)

    def _get_crud_routing(self, tool_name: str) -> tuple[str, str] | None:
        """
        Get CRUD routing for method-specific tool names.

        Args:
            tool_name: Tool name from frontend (e.g., "emery-create-agent")

        Returns:
            Tuple of (base_tool_name, method) or None if not a CRUD tool
        """
        # AIDEV-NOTE: Explicit mapping - clear and maintainable
        TOOL_ROUTING = {
            # Agent operations
            "emery-create-agent": ("agent_crud", "create"),
            "emery-read-agent": ("agent_crud", "read"),
            "emery-update-agent": ("agent_crud", "update"),
            "emery-delete-agent": ("agent_crud", "delete"),
            "emery-list-agents": ("agent_crud", "list"),

            # Document operations
            "emery-create-document": ("document_crud", "create"),
            "emery-read-document": ("document_crud", "read"),
            "emery-update-document": ("document_crud", "update"),
            "emery-delete-document": ("document_crud", "delete"),
            "emery-list-documents": ("document_crud", "list"),

            # File operations
            "emery-create-file": ("file_crud", "create"),
            "emery-read-file": ("file_crud", "read"),
            "emery-update-file": ("file_crud", "update"),
            "emery-delete-file": ("file_crud", "delete"),
            "emery-list-files": ("file_crud", "list"),

            # Table operations
            "emery-create-table": ("table_crud", "create_table"),
            "emery-read-table": ("table_crud", "read_table"),
            "emery-update-table": ("table_crud", "update_table"),
            "emery-delete-table": ("table_crud", "delete_table"),
            "emery-list-tables": ("table_crud", "list_tables"),

            # Row operations (use row_crud)
            "emery-create-row": ("row_crud", "create_row"),
            "emery-get-rows": ("row_crud", "get_rows"),
            "emery-update-row": ("row_crud", "update_row"),
            "emery-delete-row": ("row_crud", "delete_row"),

            # Field/column operations (use field_crud)
            "emery-create-field": ("field_crud", "create_field"),
            "emery-list-fields": ("field_crud", "list_fields"),
            "emery-delete-field": ("field_crud", "delete_field"),

            # Team operations
            "emery-create-team": ("team_crud", "create"),
            "emery-read-team": ("team_crud", "read"),
            "emery-update-team": ("team_crud", "update"),
            "emery-delete-team": ("team_crud", "delete"),
            "emery-list-teams": ("team_crud", "list"),

            # Database operations
            "emery-create-database": ("database_crud", "create"),
            "emery-read-database": ("database_crud", "read"),
            "emery-update-database": ("database_crud", "update"),
            "emery-delete-database": ("database_crud", "delete"),
            "emery-list-databases": ("database_crud", "list"),
        }

        return TOOL_ROUTING.get(tool_name)
    
    def load_tools(self, tool_configs: List[ToolConfig]) -> List[Any]:
        """Load multiple tools from configurations."""
        return [self.load_tool(config) for config in tool_configs]
    
    def list_available_tools(self) -> List[str]:
        """List all available tool names."""
        return list(self._tool_registry.keys())
    
    def get_tool_info(self, tool_name: str) -> Dict[str, str]:
        """Get information about a specific tool."""
        tool_name_lower = tool_name.lower()
        
        if tool_name_lower not in self._tool_registry:
            return {"error": f"Tool {tool_name} not found"}
        
        # Determine tool category
        category = "unknown"
        if tool_name_lower in BASE_TOOLS:
            category = "base"
        elif tool_name_lower in EMAIL_TOOLS:
            category = "email"
        elif tool_name_lower in DATA_TOOLS:
            category = "data"
        elif tool_name_lower in ORGANIZATIONAL_TOOLS:
            category = "organizational"
        elif tool_name_lower in API_TOOLS:
            category = "api"
        elif tool_name_lower in CRUD_TOOLS:
            category = "crud"
        elif tool_name_lower in PIPEDREAM_TOOLS:
            category = "pipedream"

        return {
            "name": tool_name,
            "category": category,
            "available": True
        }

