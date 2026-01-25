"""
Tool Provider - Centralized tool creation with consistent auth.

AIDEV-NOTE: Creates tools lazily with auth captured in closures.
Tools are cached for reuse. Works with ToolMode filtering system.

The ToolProvider is configured once at request start with api_key and org_id.
All managed agents and the coordinator get tools from this provider,
ensuring consistent auth configuration across the entire request.

SECURITY: The ToolProvider exposes an http_client property for authenticated
requests, NOT the raw api_key. This prevents credential exposure to skills/agents.

AIDEV-NOTE: DSPy Migration (Jan 2026)
- Now uses DSPy tool factories from dspy_modules/tools/crud/
- DSPyToolWrapper provides smolagents-like attributes for backward compatibility
"""

import warnings
from typing import Dict, List, Optional, Any, TYPE_CHECKING
import logging

from ..types import ToolProtocol
from ..dspy_modules.tools import (
    create_database_crud,
    create_skill_crud,
    create_document_crud,
    create_agent_crud,
    create_table_crud,
    create_field_crud,
    create_row_crud,
    create_app_crud,
    create_page_crud,
    create_view_crud,
    DSPyToolWrapper,
)
from ..tools.security_report_tool import load_security_report_tool
from .authenticated_http_client import AuthenticatedHttpClient

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
        schema_tools = provider.get_schema_builder_tools()
    """

    # Supported tool names
    TOOL_NAMES = [
        "database_crud", "table_crud", "field_crud", "row_crud",
        "skill_crud", "document_crud", "app_crud", "page_crud",
        "agent_crud", "view_crud", "security_report",
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
        self._org_id_str = str(organization_id) if organization_id else ""
        self._cache: Dict[str, ToolProtocol] = {}
        self._http_client = AuthenticatedHttpClient(api_key, organization_id)
        logger.info(f"[TOOL-PROVIDER] Initialized (api_key present: {bool(api_key)}, org_id: {organization_id})")

    @property
    def http_client(self) -> AuthenticatedHttpClient:
        """
        Get authenticated HTTP client for making API requests.

        SECURITY: Use this instead of accessing api_key directly.
        The http_client provides authenticated requests without
        exposing raw credentials.
        """
        return self._http_client

    @property
    def api_key(self) -> str:
        """
        Get the API key.

        DEPRECATED: Use http_client for authenticated requests instead.
        This property will be removed in a future version.
        """
        # TODO: Add deprecation warning once all usages are migrated
        # warnings.warn(
        #     "api_key property is deprecated. Use http_client for authenticated requests.",
        #     DeprecationWarning,
        #     stacklevel=2
        # )
        return self._api_key

    @property
    def organization_id(self) -> int:
        """Get the organization ID (for passing to ExecutionContext)."""
        return self._organization_id

    def get(self, name: str) -> ToolProtocol:
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

    def get_all(self) -> Dict[str, ToolProtocol]:
        """Get all tools (creates any not yet cached)."""
        for name in self.TOOL_NAMES:
            self.get(name)
        return self._cache.copy()

    # -------------------------
    # Category Helpers
    # -------------------------

    def get_schema_builder_tools(self) -> List[ToolProtocol]:
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

    def get_table_builder_tools(self) -> List[ToolProtocol]:
        """
        Get tools for table builder agent.

        For single-table operations (quick additions/modifications).
        """
        return [self.get("table_crud"), self.get("field_crud")]

    def get_skill_builder_tools(self) -> List[ToolProtocol]:
        """Get tools for skill builder agent."""
        return [self.get("skill_crud")]

    def get_document_builder_tools(self) -> List[ToolProtocol]:
        """Get tools for document builder agent."""
        return [self.get("document_crud")]

    def get_app_builder_tools(self) -> List[ToolProtocol]:
        """Get tools for app builder agent."""
        return [self.get("app_crud"), self.get("page_crud"), self.get("view_crud")]

    def get_agent_builder_tools(self) -> List[ToolProtocol]:
        """Get tools for agent builder agent."""
        return [self.get("agent_crud"), self.get("skill_crud")]

    def get_view_builder_tools(self) -> List[ToolProtocol]:
        """Get tools for view builder agent."""
        return [
            self.get("database_crud"),  # Understand database structure
            self.get("table_crud"),      # List/read tables
            self.get("field_crud"),      # Understand field types
            self.get("view_crud"),       # Create/manage views
        ]

    def get_system_designer_tools(self) -> List[ToolProtocol]:
        """
        Get tools for system designer agent.

        System designer is READ-ONLY - it doesn't have CRUD tools directly.
        It uses:
        - research_emery (as managed agent) for system introspection
        - research tools (web_search, visit_webpage) added separately in factory
        - security_report tool for security analysis

        AIDEV-NOTE: System designer delegates mutations to specialized builders
        (schema_builder, app_builder, agent_builder, skill_builder) via
        managed agents. It only needs research capability and security analysis.

        Returns security_report tool - other tools added in ManagedAgentsFactory.
        """
        return [self.get("security_report")]

    def get_security_tools(self) -> List[ToolProtocol]:
        """
        Get security-related tools.

        Currently includes security_report for generating security analysis.
        Can be used by system_designer and via tool_executor.
        """
        return [self.get("security_report")]

    # -------------------------
    # Tool Factory
    # -------------------------

    def _create_tool(self, name: str) -> Any:
        """
        Create tool with auth credentials captured in closure.

        Uses DSPy tool factories with DSPyToolWrapper for backward compatibility.

        Args:
            name: Tool name to create

        Returns:
            Tool instance (DSPyToolWrapper)

        Raises:
            ValueError: If tool name is not supported
        """
        # DSPy tool factories - return plain callables, wrap with DSPyToolWrapper
        dspy_factories = {
            "database_crud": create_database_crud,
            "table_crud": create_table_crud,
            "field_crud": create_field_crud,
            "row_crud": create_row_crud,
            "skill_crud": create_skill_crud,
            "document_crud": create_document_crud,
            "app_crud": create_app_crud,
            "page_crud": create_page_crud,
            "agent_crud": create_agent_crud,
            "view_crud": create_view_crud,
        }

        # Legacy smolagents tools (not yet ported to DSPy)
        legacy_loaders = {
            "security_report": lambda: load_security_report_tool(None, self._api_key, self._organization_id),
        }

        if name in dspy_factories:
            # Create DSPy tool with factory, wrap for backward compatibility
            func = dspy_factories[name](self._api_key, self._org_id_str)
            return DSPyToolWrapper(func, name=name)
        elif name in legacy_loaders:
            # Use legacy smolagents loader - these still use smolagents.Tool
            # which satisfies ToolProtocol (has name, description, __call__)
            tool: Any = legacy_loaders[name]()
            return tool
        else:
            raise ValueError(f"Unknown tool: {name}. Supported: {list(dspy_factories.keys()) + list(legacy_loaders.keys())}")
