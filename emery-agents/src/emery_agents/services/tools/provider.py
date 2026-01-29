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
- Uses DSPy tool factories from reasoning/tools/crud/
- Returns plain callables for DSPy ReAct (no wrapper needed)
"""

import warnings
from typing import Dict, List, Optional, Any, Callable, TYPE_CHECKING
import logging

from ...reasoning.tools import (
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
)
from ...reasoning.tools.analysis import create_security_report_tool
from ..http import AuthenticatedHttpClient

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

    # Registry of DSPy tool factories
    DSPY_FACTORIES: Dict[str, Callable[[str, str], Callable[..., str]]] = {
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
        self._cache: Dict[str, Any] = {}
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

    def get(self, name: str) -> Any:
        """
        Get tool by name (lazy creation, cached).

        Args:
            name: Tool name (e.g., "database_crud", "table_crud")

        Returns:
            Callable tool function for DSPy ReAct

        Raises:
            ValueError: If tool name is not supported
        """
        if name not in self._cache:
            self._cache[name] = self._create_tool(name)
            logger.debug(f"🔧 Created and cached tool: {name}")
        return self._cache[name]

    def get_all(self) -> Dict[str, Any]:
        """Get all tools (creates any not yet cached)."""
        for name in list(self.DSPY_FACTORIES.keys()) + ["security_report"]:
            self.get(name)
        return self._cache.copy()

    # -------------------------
    # Category Helpers
    # -------------------------

    def get_schema_builder_tools(self) -> List[Any]:
        """Get tools for schema builder agent."""
        return [
            self.get("database_crud"),
            self.get("table_crud"),
            self.get("field_crud"),
        ]

    def get_table_builder_tools(self) -> List[Any]:
        """Get tools for table builder agent."""
        return [self.get("table_crud"), self.get("field_crud")]

    def get_skill_builder_tools(self) -> List[Any]:
        """Get tools for skill builder agent."""
        return [self.get("skill_crud")]

    def get_document_builder_tools(self) -> List[Any]:
        """Get tools for document builder agent."""
        return [self.get("document_crud")]

    def get_app_builder_tools(self) -> List[Any]:
        """Get tools for app builder agent."""
        return [self.get("app_crud"), self.get("page_crud"), self.get("view_crud")]

    def get_agent_builder_tools(self) -> List[Any]:
        """Get tools for agent builder agent."""
        return [self.get("agent_crud"), self.get("skill_crud")]

    def get_view_builder_tools(self) -> List[Any]:
        """Get tools for view builder agent."""
        return [
            self.get("database_crud"),
            self.get("table_crud"),
            self.get("field_crud"),
            self.get("view_crud"),
        ]

    def get_system_designer_tools(self) -> List[Any]:
        """Get tools for system designer agent (security analysis)."""
        return [self.get("security_report")]

    def get_security_tools(self) -> List[Any]:
        """Get security-related tools."""
        return [self.get("security_report")]

    # -------------------------
    # Tool Factory
    # -------------------------

    def _create_tool(self, name: str) -> Any:
        """
        Create tool with auth credentials captured in closure.

        Returns plain callable for DSPy - no wrapper needed.
        """
        # Check DSPy factories first
        if name in self.DSPY_FACTORIES:
            return self.DSPY_FACTORIES[name](self._api_key, self._org_id_str)

        # Security report tool
        if name == "security_report":
            return create_security_report_tool(self._api_key, self._organization_id)

        raise ValueError(f"Unknown tool: {name}. Supported: {list(self.DSPY_FACTORIES.keys()) + ['security_report']}")
