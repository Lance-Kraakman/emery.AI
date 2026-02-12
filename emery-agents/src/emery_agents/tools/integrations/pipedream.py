"""
Pipedream Tools - Integration with Pipedream via proxy.

Ported from tools/pipedream_tools.py - removes smolagents.Tool dependency.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import dspy
import requests

from emery_agents.entities.tool_config import ToolConfig

logger = logging.getLogger(__name__)

# Shared thread pool for HTTP requests to prevent blocking gRPC event loop
_http_thread_pool = ThreadPoolExecutor(
    max_workers=10, thread_name_prefix="pipedream-http"
)

# Load metadata once from unified_metadata.json
METADATA_PATH = (
    Path(__file__).parent.parent.parent
    / "execution"
    / "tools"
    / "unified_metadata.json"
)
try:
    with open(METADATA_PATH) as f:
        _unified = json.load(f)
        PIPEDREAM_METADATA = _unified.get("pipedream_tools", {})
    logger.info(
        f"[PIPEDREAM-TOOLS] Loaded {len(PIPEDREAM_METADATA)} tools from unified metadata"
    )
except FileNotFoundError:
    logger.warning(f"Pipedream metadata not found at {METADATA_PATH}")
    PIPEDREAM_METADATA = {}


class PipedreamTool:
    """Universal Pipedream tool with smart routing.

    This class can be used as a callable for DSPy ReAct:
        tool = PipedreamTool(...)
        result = tool(**kwargs)

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type ("object")
    """

    def __init__(self, tool_id: str, config: ToolConfig):
        metadata = PIPEDREAM_METADATA.get(tool_id)
        if not metadata:
            raise ValueError(f"Unknown tool: {tool_id}")

        # Basic tool properties
        self.tool_id = tool_id
        self.name = tool_id.replace("-", "_")
        self.description = metadata["description"]
        self.tool_type = metadata.get("type", "action")
        self.app_name = metadata["app"]
        self.inputs = self._create_inputs(metadata["inputs"])
        self.output_type = "object"

        # Store API key
        api_key = config.config.get("api_key") if config and config.config else None
        if not api_key:
            raise ValueError("api_key required")

        self.agent_api_key = api_key
        self.base_url = config.config.get("base_url") or os.getenv(
            "NEXTJS_BASE_URL", "http://localhost:3000"
        )
        # Determine api_key_mode: explicit config > auto-detect from key prefix > default "user"
        configured_mode = config.config.get("api_key_mode")
        if configured_mode:
            self.api_key_mode = configured_mode
        elif isinstance(api_key, str) and api_key.startswith("key_"):
            self.api_key_mode = "agent"
        else:
            self.api_key_mode = "user"

    def __call__(self, **kwargs: Any) -> dict[str, Any]:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def _create_inputs(self, inputs: dict[str, Any]) -> dict[str, Any]:
        """Create input schema with nullable for optional parameters."""
        result = {}
        for key, spec in inputs.items():
            is_required = spec.get("required", True)
            pipedream_type = spec["type"]
            mapped_type = self._map_type(pipedream_type)

            result[key] = {"type": mapped_type, "description": spec["description"]}
            if not is_required:
                result[key]["nullable"] = True
        return result

    def _map_type(self, pipedream_type: str) -> str:
        """Map Pipedream types to DSPy-compatible types."""
        type_mappings = {
            "string[]": "array",
            "string": "string",
            "integer": "integer",
            "number": "number",
            "boolean": "boolean",
            "object": "object",
            "array": "array",
        }
        return type_mappings.get(pipedream_type, "string")

    def forward(self, **kwargs: Any) -> dict[str, Any]:
        """Execute Pipedream action or MCP call via proxy with smart routing."""
        api_key_value = self.agent_api_key

        try:
            if self.tool_type == "mcp":
                return self._execute_mcp_call(api_key_value, **kwargs)
            else:
                return self._execute_action_call(api_key_value, **kwargs)

        except requests.RequestException as e:
            return {"success": False, "error": f"Request error: {str(e)}"}

    def _execute_action_call(self, api_key_value: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a specific Pipedream action."""
        parts = self.tool_id.split("-", 1)
        service = parts[0]
        action = parts[1].replace("-", "_") if len(parts) > 1 else "default"

        def _http_call() -> requests.Response:
            return requests.post(
                f"{self.base_url}/api/connections/proxy",
                headers={
                    "Authorization": f"Bearer {api_key_value}",
                    "Content-Type": "application/json",
                },
                json={
                    "service": service,
                    "action": action,
                    "params": kwargs,
                    "api_key_mode": self.api_key_mode,
                },
                timeout=30,
            )

        try:
            future = _http_thread_pool.submit(_http_call)
            response = future.result(timeout=35.0)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                return {"success": False, "error": "Authentication failed"}
            else:
                return {
                    "success": False,
                    "error": f"Request failed: {response.status_code}",
                }
        except TimeoutError:
            return {"success": False, "error": "Request timeout after 35 seconds"}
        except Exception as e:
            return {"success": False, "error": f"Request error: {str(e)}"}

    def _execute_mcp_call(self, api_key_value: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a generic MCP API call."""
        method = kwargs.get("method", "GET").upper()
        endpoint = kwargs.get("endpoint", "")
        body = kwargs.get("body", {})
        headers = kwargs.get("headers", {})

        if not endpoint:
            return {"success": False, "error": "MCP calls require 'endpoint' parameter"}

        mcp_payload = {
            "service": self.app_name,
            "action": "mcp_call",
            "params": {
                "method": method,
                "endpoint": endpoint,
                "body": body if method in ["POST", "PUT", "PATCH"] else None,
                "headers": headers,
            },
        }

        def _http_call() -> requests.Response:
            return requests.post(
                f"{self.base_url}/api/agents/proxy",
                headers={
                    "Authorization": f"Bearer {api_key_value}",
                    "Content-Type": "application/json",
                },
                json=mcp_payload,
                timeout=30,
            )

        try:
            future = _http_thread_pool.submit(_http_call)
            response = future.result(timeout=35.0)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401:
                return {"success": False, "error": "Authentication failed"}
            else:
                return {
                    "success": False,
                    "error": f"MCP request failed: {response.status_code}",
                }
        except TimeoutError:
            return {"success": False, "error": "Request timeout after 35 seconds"}
        except Exception as e:
            return {"success": False, "error": f"Request error: {str(e)}"}

    def to_dspy_tool(self) -> dspy.Tool:
        """Convert to dspy.Tool with proper metadata.

        DSPy ReAct auto-wraps callables but loses custom attributes.
        This method creates a proper dspy.Tool with explicit metadata.
        """
        return dspy.Tool(
            func=self.forward,
            name=self.name,
            desc=self.description,
            args={name: {"type": info["type"]} for name, info in self.inputs.items()},
            arg_desc={
                name: info.get("description", name)
                for name, info in self.inputs.items()
            },
        )


# Tool registry
PIPEDREAM_TOOLS: dict[str, Callable[[ToolConfig], PipedreamTool]] = {}


def _create_loader(tool_id: str) -> Callable[[ToolConfig], PipedreamTool]:
    """Create tool loader function."""

    def loader(config: ToolConfig) -> PipedreamTool:
        return PipedreamTool(tool_id, config)

    loader.__name__ = f"load_{tool_id.replace('-', '_')}"
    return loader


# Build registry
for tool_id in PIPEDREAM_METADATA.keys():
    tool_name = tool_id.replace("-", "_")
    PIPEDREAM_TOOLS[tool_name] = _create_loader(tool_id)

if PIPEDREAM_TOOLS:
    logger.info(f"[PIPEDREAM-TOOLS] Loaded {len(PIPEDREAM_TOOLS)} tools")
else:
    logger.warning("[PIPEDREAM-TOOLS] No tools loaded")


def get_pipedream_tool_info(tool_name: str) -> dict[str, Any] | None:
    """Get tool metadata by name."""
    tool_id = tool_name.replace("_", "-")
    return PIPEDREAM_METADATA.get(tool_id)


def list_pipedream_tools_by_app() -> dict[str, list[str]]:
    """List tools by app."""
    tools_by_app: dict[str, list[str]] = {}
    for tool_id, metadata in PIPEDREAM_METADATA.items():
        app = metadata["app"]
        tool_name = tool_id.replace("-", "_")
        tools_by_app.setdefault(app, []).append(tool_name)
    return tools_by_app
