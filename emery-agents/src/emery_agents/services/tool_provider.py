"""
Tool Provider - Centralized tool creation with consistent auth.

AIDEV-NOTE: Creates tools lazily with auth captured in closures.
Tools are cached for reuse. Works with ToolMode filtering system.

The ToolProvider is configured once at request start with api_key and org_id.
All managed agents and the coordinator get tools from this provider,
ensuring consistent auth configuration across the entire request.
"""

from typing import Dict, List, Optional, Any
import logging

from smolagents import Tool

from ..tools.crud_tools import (
    load_database_crud,
    load_skill_crud,
    load_document_crud,
)
from ..tools.table_tools import load_table_crud
from ..tools.field_tools import load_field_crud
from ..tools.row_tools import load_row_crud

logger = logging.getLogger(__name__)


class ToolProvider:
    """
    Centralized tool creation with consistent auth.

    Configured once at request start with api_key and org_id.
    Creates tools lazily on first access and caches them.

    Usage:
        provider = ToolProvider(api_key="...", organization_id=123)

        # Get individual tool
        db_tool = provider.get("database_crud")

        # Get category of tools
        context_tools = provider.get_context_tools()
        schema_tools = provider.get_schema_builder_tools()
    """

    # Supported tool names
    TOOL_NAMES = [
        "database_crud", "table_crud", "field_crud", "row_crud",
        "skill_crud", "document_crud",
    ]

    def __init__(self, api_key: str, organization_id: int):
        """
        Initialize tool provider with auth credentials.

        Args:
            api_key: API key for authenticating tool requests
            organization_id: Organization ID for RLS context
        """
        self._api_key = api_key
        self._organization_id = organization_id
        self._cache: Dict[str, Tool] = {}
        logger.info(f"🔧 ToolProvider initialized (api_key present: {bool(api_key)}, org_id: {organization_id})")

    @property
    def api_key(self) -> str:
        """Get the API key (for passing to ExecutionContext)."""
        return self._api_key

    @property
    def organization_id(self) -> int:
        """Get the organization ID (for passing to ExecutionContext)."""
        return self._organization_id

    def get(self, name: str) -> Tool:
        """
        Get tool by name (lazy creation, cached).

        Args:
            name: Tool name (e.g., "database_crud", "table_crud")

        Returns:
            Tool instance with auth credentials baked in

        Raises:
            ValueError: If tool name is not supported
        """
        if name not in self._cache:
            self._cache[name] = self._create_tool(name)
            logger.debug(f"🔧 Created and cached tool: {name}")
        return self._cache[name]

    def get_all(self) -> Dict[str, Tool]:
        """Get all tools (creates any not yet cached)."""
        for name in self.TOOL_NAMES:
            self.get(name)
        return self._cache.copy()

    # -------------------------
    # Category Helpers
    # -------------------------

    def get_context_tools(self) -> List[Tool]:
        """
        Get read-only tools for planning/context gathering.

        These are used by the planner to understand what exists
        before generating a plan. The tools support read operations
        (list, get) but mutations are blocked by ToolMode.PLANNING.
        """
        return [self.get("database_crud"), self.get("table_crud")]

    def get_schema_builder_tools(self) -> List[Tool]:
        """
        Get tools for schema builder agent.

        Includes database, table, and field CRUD for:
        - Listing existing databases (context)
        - Creating/modifying tables
        - Creating/modifying fields
        """
        return [
            self.get("database_crud"),
            self.get("table_crud"),
            self.get("field_crud"),
        ]

    def get_table_builder_tools(self) -> List[Tool]:
        """
        Get tools for table builder agent.

        For single-table operations (quick additions/modifications).
        """
        return [self.get("table_crud"), self.get("field_crud")]

    def get_skill_builder_tools(self) -> List[Tool]:
        """Get tools for skill builder agent."""
        return [self.get("skill_crud")]

    def get_document_builder_tools(self) -> List[Tool]:
        """Get tools for document builder agent."""
        return [self.get("document_crud")]

    # -------------------------
    # Tool Factory
    # -------------------------

    def _create_tool(self, name: str) -> Tool:
        """
        Create tool with auth credentials captured in closure.

        Args:
            name: Tool name to create

        Returns:
            Tool instance

        Raises:
            ValueError: If tool name is not supported
        """
        loaders = {
            "database_crud": load_database_crud,
            "table_crud": load_table_crud,
            "field_crud": load_field_crud,
            "row_crud": load_row_crud,
            "skill_crud": load_skill_crud,
            "document_crud": load_document_crud,
        }

        if name not in loaders:
            raise ValueError(f"Unknown tool: {name}. Supported: {list(loaders.keys())}")

        # All loaders have same signature: (config, api_key, org_id)
        # config=None is fine - tools use env vars for base URL
        return loaders[name](None, self._api_key, self._organization_id)
