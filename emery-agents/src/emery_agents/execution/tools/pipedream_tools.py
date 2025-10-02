"""
Minimal Pipedream Tools Implementation

AIDEV-NOTE: Simplified integration with Pipedream via proxy.
Uses Value Objects for type safety and static metadata for simplicity.
"""

import json
import requests
import inspect
from pathlib import Path
from typing import Any, Dict, List, Optional
from smolagents import Tool
from ...core.entities import ToolConfig
from ...domain.agents.value_objects.agent_value_objects import ApiKey

# Load metadata once
METADATA_PATH = Path(__file__).parent / "pipedream_metadata.json"
try:
    with open(METADATA_PATH) as f:
        PIPEDREAM_METADATA = json.load(f)
except FileNotFoundError:
    print(f"Warning: Metadata not found at {METADATA_PATH}")
    PIPEDREAM_METADATA = {}


class PipedreamTool(Tool):
    """Universal Pipedream tool with smart routing and Value Object integration."""
    
    def __init__(self, tool_id: str, config: ToolConfig):
        metadata = PIPEDREAM_METADATA.get(tool_id)
        if not metadata:
            raise ValueError(f"Unknown tool: {tool_id}")
        
        # Basic tool properties
        self.tool_id = tool_id
        self.name = tool_id.replace("-", "_")
        self.description = metadata["description"]
        self.tool_type = metadata.get("type", "action")  # 'action' or 'mcp'
        self.app_name = metadata["app"]
        self.inputs = self._create_inputs(metadata["inputs"])
        self.output_type = "object"
        
        # Use ApiKey Value Object for type safety
        api_key = config.config.get("api_key") if config and config.config else None
        if not api_key:
            raise ValueError("api_key required")

        self.agent_api_key = ApiKey(api_key) if isinstance(api_key, str) else api_key
        self.base_url = config.config.get("base_url", "http://localhost:3000")
        
        # Create forward method with proper signature for smolagents
        self._setup_forward_method(metadata["inputs"])
    
    def _create_inputs(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Create input schema with nullable for optional parameters."""
        result = {}
        for key, spec in inputs.items():
            is_required = spec.get("required", True)
            
            # Map Pipedream types to smolagents types
            pipedream_type = spec["type"]
            smolagents_type = self._map_type(pipedream_type)
            
            result[key] = {
                "type": smolagents_type,
                "description": spec["description"]
            }
            # Add nullable for optional parameters (to match default=None in signature)
            if not is_required:
                result[key]["nullable"] = True
        return result
    
    def _map_type(self, pipedream_type: str) -> str:
        """Map Pipedream types to smolagents-compatible types."""
        type_mappings = {
            "string[]": "array",
            "string": "string",
            "integer": "integer", 
            "number": "number",
            "boolean": "boolean",
            "object": "object",
            "array": "array"
        }
        return type_mappings.get(pipedream_type, "string")  # Default to string
    
    def _setup_forward_method(self, inputs: Dict[str, Any]):
        """Create forward method with proper signature for smolagents validation."""
        params = [inspect.Parameter('self', inspect.Parameter.POSITIONAL_OR_KEYWORD)]
        
        # Sort parameters: required first, then optional (to avoid default arg order issues)
        required_params = []
        optional_params = []
        
        for param_name, spec in inputs.items():
            is_required = spec.get("required", True)
            if is_required:
                required_params.append(param_name)
            else:
                optional_params.append(param_name)
        
        # Add required parameters (no default)
        for param_name in required_params:
            params.append(inspect.Parameter(param_name, inspect.Parameter.POSITIONAL_OR_KEYWORD))
        
        # Add optional parameters (with default=None)
        for param_name in optional_params:
            params.append(inspect.Parameter(param_name, inspect.Parameter.POSITIONAL_OR_KEYWORD, default=None))
        
        self.forward.__func__.__signature__ = inspect.Signature(params)
    
    def forward(self, **kwargs) -> Dict[str, Any]:
        """Execute Pipedream action or MCP call via proxy with smart routing."""
        # Use Value Object for API key
        api_key_value = getattr(self.agent_api_key, 'value', str(self.agent_api_key))
        
        try:
            if self.tool_type == "mcp":
                # Generic MCP call - expect method, endpoint, body, headers
                return self._execute_mcp_call(api_key_value, **kwargs)
            else:
                # Specific action call - use existing logic
                return self._execute_action_call(api_key_value, **kwargs)
                
        except requests.RequestException as e:
            return {"success": False, "error": f"Request error: {str(e)}"}
    
    def _execute_action_call(self, api_key_value: str, **kwargs) -> Dict[str, Any]:
        """Execute a specific Pipedream action."""
        # Parse tool_id: "gmail-send-email" -> service="gmail", action="send_email"
        parts = self.tool_id.split("-", 1)
        service = parts[0]
        action = parts[1].replace("-", "_") if len(parts) > 1 else "default"
        
        response = requests.post(
            f"{self.base_url}/api/agents/proxy",
            headers={
                "Authorization": f"Bearer {api_key_value}",
                "Content-Type": "application/json"
            },
            json={"service": service, "action": action, "params": kwargs},
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            return {"success": False, "error": "Authentication failed"}
        else:
            return {"success": False, "error": f"Request failed: {response.status_code}"}
    
    def _execute_mcp_call(self, api_key_value: str, **kwargs) -> Dict[str, Any]:
        """Execute a generic MCP API call."""
        # Extract MCP parameters
        method = kwargs.get("method", "GET").upper()
        endpoint = kwargs.get("endpoint", "")
        body = kwargs.get("body", {})
        headers = kwargs.get("headers", {})
        
        if not endpoint:
            return {"success": False, "error": "MCP calls require 'endpoint' parameter"}
        
        # Prepare MCP request payload
        mcp_payload = {
            "service": self.app_name,
            "action": "mcp_call",  # Special action for generic MCP calls
            "params": {
                "method": method,
                "endpoint": endpoint,
                "body": body if method in ["POST", "PUT", "PATCH"] else None,
                "headers": headers
            }
        }
        
        response = requests.post(
            f"{self.base_url}/api/agents/proxy",
            headers={
                "Authorization": f"Bearer {api_key_value}",
                "Content-Type": "application/json"
            },
            json=mcp_payload,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 401:
            return {"success": False, "error": "Authentication failed"}
        else:
            return {"success": False, "error": f"MCP request failed: {response.status_code}"}


# Tool registry
PIPEDREAM_TOOLS = {}

def _create_loader(tool_id: str):
    """Create tool loader function."""
    def loader(config: ToolConfig) -> PipedreamTool:
        return PipedreamTool(tool_id, config)
    loader.__name__ = f"load_{tool_id.replace('-', '_')}"
    return loader

# Build registry
for tool_id in PIPEDREAM_METADATA.keys():
    tool_name = tool_id.replace("-", "_")
    PIPEDREAM_TOOLS[tool_name] = _create_loader(tool_id)

# Log results
if PIPEDREAM_TOOLS:
    print(f"[PIPEDREAM-TOOLS] Loaded {len(PIPEDREAM_TOOLS)} tools")
else:
    print("[PIPEDREAM-TOOLS] No tools loaded")


# Utility functions
def get_pipedream_tool_info(tool_name: str) -> Optional[Dict[str, Any]]:
    """Get tool metadata by name."""
    tool_id = tool_name.replace("_", "-")
    return PIPEDREAM_METADATA.get(tool_id)

def list_pipedream_tools_by_app() -> Dict[str, List[str]]:
    """List tools by app."""
    tools_by_app = {}
    for tool_id, metadata in PIPEDREAM_METADATA.items():
        app = metadata["app"]
        tool_name = tool_id.replace("-", "_")
        tools_by_app.setdefault(app, []).append(tool_name)
    return tools_by_app