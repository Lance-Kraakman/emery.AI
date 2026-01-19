"""
Integration Discovery Tools for discover_tools managed agent.

READ-ONLY tools for discovering available Pipedream integrations
and checking user's OAuth connections.

AIDEV-NOTE: This module provides tools for the discover_tools managed agent
to help users find and understand available integrations. All operations
are read-only and safe for planning phase.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from smolagents import Tool

from .crud_tools import BaseCrudTool

logger = logging.getLogger(__name__)

# Load Pipedream metadata for tool discovery
METADATA_PATH = Path(__file__).parent / "pipedream_metadata.json"
try:
    with open(METADATA_PATH) as f:
        PIPEDREAM_METADATA = json.load(f)
    logger.info(f"[INTEGRATION-DISCOVERY] Loaded {len(PIPEDREAM_METADATA)} tools from metadata")
except FileNotFoundError:
    logger.warning(f"[INTEGRATION-DISCOVERY] Metadata not found at {METADATA_PATH}")
    PIPEDREAM_METADATA = {}


def create_list_integrations_tool(
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Create tool for listing available integrations (apps).

    Returns apps that support OAuth connections, grouped by category.

    Args:
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS

    Returns:
        Configured ListIntegrationsTool instance
    """
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class ListIntegrationsTool(BaseCrudTool):
        """
        List available integrations (apps) that can be connected.

        Returns apps grouped by category with connection status.
        """

        name = "list_integrations"
        description = """List available apps/integrations that can be connected via OAuth.

Returns apps grouped by category (communication, productivity, development, etc.).
Useful for discovering what services are available for automation.

Examples:
- list_integrations() - List all available apps
- list_integrations(category="communication") - List communication apps (Slack, Gmail, etc.)
- list_integrations(search="email") - Search for email-related apps
"""

        inputs = {
            "category": {
                "type": "string",
                "description": "Filter by category: communication, productivity, development, storage, crm, finance, social, analytics, other",
                "nullable": True
            },
            "search": {
                "type": "string",
                "description": "Search term to filter apps by name or description",
                "nullable": True
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of apps to return (default: 50)",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("integration", "list")

        def forward(
            self,
            category: Optional[str] = None,
            search: Optional[str] = None,
            limit: Optional[int] = None
        ) -> Dict[str, Any]:
            """List available integrations."""
            logger.info(f"[LIST_INTEGRATIONS] category={category}, search={search}, limit={limit}")

            # Build query params
            endpoint = "integrations/apps"
            params = []

            if category:
                params.append(f"category={category}")
            if search:
                params.append(f"search={search}")
            if limit:
                params.append(f"limit={limit}")
            else:
                params.append("limit=50")

            if params:
                endpoint += "?" + "&".join(params)

            return self._make_api_request(
                endpoint=endpoint,
                method="GET",
                auth_token=_auth_token,
                organization_id=_org_id
            )

    return ListIntegrationsTool()


def create_search_tools_tool(
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Create tool for searching Pipedream tools/actions.

    Searches the local metadata for matching tools by keyword.
    Uses in-memory search of pipedream_metadata.json.

    Args:
        api_key: API key (not used for local search)
        organization_id: Organization context (not used for local search)

    Returns:
        Configured SearchToolsTool instance
    """

    class SearchToolsTool(Tool):
        """
        Search for available Pipedream tools/actions.

        Searches tool metadata by keyword, app, or category.
        """

        name = "search_tools"
        description = """Search for Pipedream tools/actions by keyword, app, or type.

Returns matching tools with their descriptions and required inputs.
Useful for finding the right tool for a specific task.

Examples:
- search_tools(query="send email") - Find tools for sending emails
- search_tools(app="slack") - Find all Slack tools
- search_tools(query="message", app="slack") - Find Slack message tools
- search_tools(tool_type="action") - Find action tools only
"""

        inputs = {
            "query": {
                "type": "string",
                "description": "Search keyword to find tools by name or description",
                "nullable": True
            },
            "app": {
                "type": "string",
                "description": "Filter by app name (e.g., 'slack', 'gmail', 'notion')",
                "nullable": True
            },
            "tool_type": {
                "type": "string",
                "description": "Filter by tool type: 'action' or 'mcp'",
                "nullable": True
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of tools to return (default: 20)",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            self.is_initialized = True

        def forward(
            self,
            query: Optional[str] = None,
            app: Optional[str] = None,
            tool_type: Optional[str] = None,
            limit: Optional[int] = None
        ) -> Dict[str, Any]:
            """Search for tools in local metadata."""
            logger.info(f"[SEARCH_TOOLS] query={query}, app={app}, tool_type={tool_type}, limit={limit}")

            if not PIPEDREAM_METADATA:
                return {
                    "success": False,
                    "error": "Tool metadata not available"
                }

            limit = limit or 20
            results = []

            # Normalize search inputs
            query_lower = query.lower() if query else None
            app_lower = app.lower() if app else None

            for tool_id, metadata in PIPEDREAM_METADATA.items():
                # Filter by app
                if app_lower:
                    tool_app = metadata.get("app", "").lower()
                    if tool_app != app_lower and not tool_id.lower().startswith(app_lower):
                        continue

                # Filter by tool type
                if tool_type:
                    if metadata.get("type", "action") != tool_type:
                        continue

                # Filter by query (search name and description)
                if query_lower:
                    name_match = query_lower in tool_id.lower()
                    desc_match = query_lower in metadata.get("description", "").lower()
                    if not name_match and not desc_match:
                        continue

                # Add to results
                results.append({
                    "tool_id": tool_id,
                    "name": tool_id.replace("-", "_"),
                    "description": metadata.get("description", ""),
                    "app": metadata.get("app", ""),
                    "type": metadata.get("type", "action"),
                    "input_count": len(metadata.get("inputs", {})),
                    "required_inputs": [
                        name for name, spec in metadata.get("inputs", {}).items()
                        if spec.get("required", True)
                    ]
                })

                if len(results) >= limit:
                    break

            # Sort by relevance (exact app match first, then alphabetically)
            if app_lower:
                results.sort(key=lambda x: (x["app"].lower() != app_lower, x["tool_id"]))
            else:
                results.sort(key=lambda x: x["tool_id"])

            return {
                "success": True,
                "tools": results,
                "total_found": len(results),
                "total_available": len(PIPEDREAM_METADATA)
            }

    return SearchToolsTool()


def create_check_connections_tool(
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Create tool for checking user's OAuth connections.

    Returns list of connected apps and missing connections for required apps.

    Args:
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS

    Returns:
        Configured CheckConnectionsTool instance
    """
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class CheckConnectionsTool(BaseCrudTool):
        """
        Check user's OAuth connections.

        Returns which apps the user has connected and their status.
        Can also check if specific apps are connected.
        """

        name = "check_connections"
        description = """Check user's OAuth connections to external apps.

Returns connected apps with their status, or checks if specific apps are connected.
Useful for determining which tools can be used without additional setup.

Examples:
- check_connections() - List all connected apps
- check_connections(required_apps=["slack", "gmail"]) - Check if Slack and Gmail are connected
- check_connections(include_summary=True) - Get connection statistics
"""

        inputs = {
            "required_apps": {
                "type": "array",
                "description": "List of app names to check if connected (e.g., ['slack', 'gmail'])",
                "nullable": True
            },
            "include_summary": {
                "type": "boolean",
                "description": "Include connection statistics (default: False)",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("integration", "connections")

        def forward(
            self,
            required_apps: Optional[List[str]] = None,
            include_summary: Optional[bool] = None
        ) -> Dict[str, Any]:
            """Check user's OAuth connections."""
            logger.info(f"[CHECK_CONNECTIONS] required_apps={required_apps}, include_summary={include_summary}")

            # Get user's connections
            connections_result = self._make_api_request(
                endpoint="integrations/connections",
                method="GET",
                auth_token=_auth_token,
                organization_id=_org_id
            )

            if not connections_result.get("success", False):
                return connections_result

            connections = connections_result.get("data", {}).get("connections", [])
            connected_apps = [conn.get("appName", "").lower() for conn in connections]

            result = {
                "success": True,
                "connected_apps": list(set(connected_apps)),
                "connection_count": len(connections)
            }

            # Check required apps if specified
            if required_apps:
                required_lower = [app.lower() for app in required_apps]
                missing = [app for app in required_lower if app not in connected_apps]
                result["required_apps_check"] = {
                    "required": required_apps,
                    "connected": [app for app in required_lower if app in connected_apps],
                    "missing": missing,
                    "all_connected": len(missing) == 0
                }

            # Include summary if requested
            if include_summary:
                summary_result = self._make_api_request(
                    endpoint="integrations/connections/summary",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
                if summary_result.get("success", False):
                    result["summary"] = summary_result.get("data", {})

            return result

    return CheckConnectionsTool()


def create_get_tool_schema_tool(
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Create tool for getting detailed schema of a specific tool.

    Returns input/output definitions for a Pipedream tool.

    Args:
        api_key: API key (not used for local lookup)
        organization_id: Organization context (not used for local lookup)

    Returns:
        Configured GetToolSchemaTool instance
    """

    class GetToolSchemaTool(Tool):
        """
        Get detailed schema for a specific Pipedream tool.

        Returns input parameters, their types, and descriptions.
        """

        name = "get_tool_schema"
        description = """Get the detailed input/output schema for a specific tool.

Returns the tool's parameters, their types, whether they're required,
and descriptions. Use this to understand how to call a tool correctly.

Examples:
- get_tool_schema(tool_id="slack-send-message") - Get Slack send message schema
- get_tool_schema(tool_id="gmail-send-email") - Get Gmail send email schema
"""

        inputs = {
            "tool_id": {
                "type": "string",
                "description": "Tool ID (e.g., 'slack-send-message', 'gmail-send-email')"
            }
        }
        output_type = "object"

        def __init__(self):
            self.is_initialized = True

        def forward(self, tool_id: str) -> Dict[str, Any]:
            """Get tool schema from local metadata."""
            logger.info(f"[GET_TOOL_SCHEMA] tool_id={tool_id}")

            # Normalize tool ID (support both formats)
            normalized_id = tool_id.replace("_", "-")

            metadata = PIPEDREAM_METADATA.get(normalized_id)
            if not metadata:
                # Try with underscore format
                underscore_id = tool_id.replace("-", "_")
                for tid, meta in PIPEDREAM_METADATA.items():
                    if tid.replace("-", "_") == underscore_id:
                        metadata = meta
                        normalized_id = tid
                        break

            if not metadata:
                return {
                    "success": False,
                    "error": f"Tool '{tool_id}' not found. Use search_tools to find available tools."
                }

            # Build detailed schema
            inputs_schema = {}
            required_inputs = []
            optional_inputs = []

            for name, spec in metadata.get("inputs", {}).items():
                input_info = {
                    "type": spec.get("type", "string"),
                    "description": spec.get("description", ""),
                    "required": spec.get("required", True)
                }
                inputs_schema[name] = input_info

                if spec.get("required", True):
                    required_inputs.append(name)
                else:
                    optional_inputs.append(name)

            return {
                "success": True,
                "tool": {
                    "id": normalized_id,
                    "name": normalized_id.replace("-", "_"),
                    "app": metadata.get("app", ""),
                    "description": metadata.get("description", ""),
                    "type": metadata.get("type", "action")
                },
                "inputs": inputs_schema,
                "required_inputs": required_inputs,
                "optional_inputs": optional_inputs,
                "example_call": f"{normalized_id.replace('-', '_')}({', '.join(f'{name}=...' for name in required_inputs)})"
            }

    return GetToolSchemaTool()


def get_integration_discovery_tools(
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> List[Tool]:
    """
    Get all integration discovery tools.

    Convenience function that creates all tools with shared auth context.

    Args:
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS

    Returns:
        List of configured integration discovery tools
    """
    return [
        create_list_integrations_tool(api_key, organization_id),
        create_search_tools_tool(api_key, organization_id),
        create_check_connections_tool(api_key, organization_id),
        create_get_tool_schema_tool(api_key, organization_id),
    ]
