"""
Tool CRUD operations as DSPy-compatible functions.

Provides tool discovery and dynamic execution.
Tools are executed via the existing /api/connections/proxy endpoint.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import dspy
import requests

from emery_agents.api.http_client import get_base_url

logger = logging.getLogger(__name__)


def create_tool_crud(api_key: str, org_id: str, extra_headers: dict[str, str] | None = None) -> dspy.Tool:
    """
    Factory: Create tool_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication (used for tool execution)
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the tool_crud function
    """

    def tool_crud(
        method: str,
        tool_id: str | None = None,
        service: str | None = None,
        action: str | None = None,
        params: Dict[str, Any] | None = None,
    ) -> str:
        """Tool discovery and execution.

        Discover available tools and execute them dynamically.
        Tools include Pipedream integrations (gmail, slack, etc.) and CRUD tools.

        Args:
            method: Operation - list, read, execute
            tool_id: Tool ID for read (e.g., "gmail_send_email")
            service: Service name for execute (e.g., "gmail", "slack")
            action: Action name for execute (e.g., "send_email", "post_message")
            params: Parameters for execute operation

        Returns:
            JSON string with result or error message
        """
        if method == "list":
            # List available tools from unified metadata
            return _list_tools()

        elif method == "read":
            if not tool_id:
                return "ERROR: tool_id is required for read operation"
            return _get_tool_info(tool_id)

        elif method == "execute":
            if not service:
                return "ERROR: service is required for execute operation"
            if not action:
                return "ERROR: action is required for execute operation"

            # Execute via proxy - credentials are resolved from api_key
            return _execute_tool(
                service=service,
                action=action,
                params=params or {},
                api_key=api_key,
                org_id=org_id,
                extra_headers=extra_headers,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: list, read, execute"

    return dspy.Tool(
        func=tool_crud,
        name="tool_crud",
        desc="Tool discovery and execution. List available tools, get tool info, or execute tools like gmail, slack, github integrations.",
        arg_desc={
            "method": "Operation: list, read, execute",
            "tool_id": "Tool ID for read (e.g., 'gmail_send_email')",
            "service": "Service name for execute (e.g., 'gmail', 'slack', 'github')",
            "action": "Action name for execute (e.g., 'send_email', 'post_message')",
            "params": "Parameters for execute operation as a dict",
        },
    )


def _list_tools() -> str:
    """List available tools grouped by category."""
    # Common Pipedream services and their actions
    tools = {
        "gmail": {
            "description": "Gmail email operations",
            "actions": ["send_email", "get_messages", "create_draft"],
        },
        "slack": {
            "description": "Slack messaging",
            "actions": ["post_message", "send_direct_message"],
        },
        "github": {
            "description": "GitHub operations",
            "actions": ["create_issue", "create_repo", "list_repos"],
        },
        "google_sheets": {
            "description": "Google Sheets operations",
            "actions": ["read_sheet", "write_sheet", "append_row"],
        },
        "notion": {
            "description": "Notion operations",
            "actions": ["create_page", "update_page", "query_database"],
        },
        "crud_tools": {
            "description": "Database CRUD operations (use specific CRUD tools instead)",
            "actions": ["row_crud", "table_crud", "field_crud", "agent_crud", "skill_crud"],
        },
    }

    return json.dumps({
        "status": "success",
        "message": "Available tools. Use tool_crud(method='execute', service='...', action='...', params={...}) to execute.",
        "tools": tools,
    })


def _get_tool_info(tool_id: str) -> str:
    """Get info about a specific tool."""
    # Parse tool_id format: "service_action" (e.g., "gmail_send_email")
    parts = tool_id.split("_", 1)
    if len(parts) < 2:
        return json.dumps({
            "status": "error",
            "error": f"Invalid tool_id format: {tool_id}. Expected: service_action (e.g., 'gmail_send_email')",
        })

    service, action = parts[0], parts[1]

    # Return basic tool info
    return json.dumps({
        "status": "success",
        "tool_id": tool_id,
        "service": service,
        "action": action,
        "usage": f"tool_crud(method='execute', service='{service}', action='{action}', params={{...}})",
    })


def _execute_tool(
    service: str,
    action: str,
    params: Dict[str, Any],
    api_key: str,
    org_id: str,
    extra_headers: dict[str, str] | None = None,
) -> str:
    """Execute a tool via the proxy endpoint."""
    base_url = get_base_url()
    url = f"{base_url}/api/connections/proxy"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-Organization-Id": org_id,
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    payload = {
        "service": service,
        "action": action,
        "params": params,
    }

    logger.info(f"[TOOL-CRUD] Executing {service}.{action} with {len(params)} params")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)

        if response.status_code == 401:
            return json.dumps({
                "status": "error",
                "error": "Authentication failed. Check API key.",
            })
        elif response.status_code == 403:
            return json.dumps({
                "status": "error",
                "error": f"Permission denied. You may not have access to {service}.",
            })
        elif response.status_code >= 400:
            return json.dumps({
                "status": "error",
                "error": f"Proxy error: {response.status_code}",
                "details": response.text[:500],
            })

        result = response.json()
        logger.info(f"[TOOL-CRUD] {service}.{action} completed successfully")

        return json.dumps({
            "status": "success",
            "service": service,
            "action": action,
            "result": result,
        })

    except requests.exceptions.Timeout:
        return json.dumps({
            "status": "error",
            "error": "Tool execution timed out",
        })
    except Exception as e:
        logger.error(f"[TOOL-CRUD] Execution failed: {e}")
        return json.dumps({
            "status": "error",
            "error": str(e),
        })
