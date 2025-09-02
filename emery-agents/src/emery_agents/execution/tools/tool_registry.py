"""
Tool Registry Module

AIDEV-NOTE: Central tool registration and loading for all emery-agents tools.
Replaces the massive tool_loader.py with a clean, modular approach.
Now includes Pipedream tools for OAuth-backed integrations.
"""

import os
from typing import Any, Dict, List
from ...core.entities import ToolConfig
from .base_tools import BASE_TOOLS
from .mock_email_tools import EMAIL_TOOLS  
from .mock_data_tools import DATA_TOOLS
from .organizational_tools import ORGANIZATIONAL_TOOLS
from .api_tools import API_TOOLS

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
        self._tool_registry = {
            **BASE_TOOLS,
            **EMAIL_TOOLS,
            **DATA_TOOLS,
            **ORGANIZATIONAL_TOOLS,
            **API_TOOLS,
            **PIPEDREAM_TOOLS  # OAuth-backed integrations (Gmail, Slack, etc.)
        }
        
        # Log registry statistics
        tool_counts = {
            "base": len(BASE_TOOLS),
            "email": len(EMAIL_TOOLS),
            "data": len(DATA_TOOLS),
            "organizational": len(ORGANIZATIONAL_TOOLS),
            "api": len(API_TOOLS),
            "pipedream": len(PIPEDREAM_TOOLS)
        }
        total_tools = sum(tool_counts.values())
        print(f"[TOOL-REGISTRY] Initialized with {total_tools} tools")
        if PIPEDREAM_TOOLS:
            print(f"[TOOL-REGISTRY] Including {len(PIPEDREAM_TOOLS)} Pipedream OAuth tools")
    
    def load_tool(self, tool_config: ToolConfig) -> Any:
        """
        Load a tool instance from ToolConfig.
        
        Args:
            tool_config: Tool configuration from protobuf
            
        Returns:
            Tool instance for smolagents
            
        Raises:
            ValueError: If tool not found or cannot be loaded
        """
        tool_name = tool_config.name.lower()
        
        if tool_name not in self._tool_registry:
            raise ValueError(f"Unknown tool: {tool_config.name}")
        
        loader_func = self._tool_registry[tool_name]
        return loader_func(tool_config)
    
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
        
        return {
            "name": tool_name,
            "category": category,
            "available": True
        }

