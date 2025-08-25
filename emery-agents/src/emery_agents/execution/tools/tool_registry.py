"""
Tool Registry Module

AIDEV-NOTE: Central tool registration and loading for all emery-agents tools.
Replaces the massive tool_loader.py with a clean, modular approach.
"""

from typing import Any, Dict, List
from ...core.entities import ToolConfig
from .base_tools import BASE_TOOLS
from .mock_email_tools import EMAIL_TOOLS  
from .mock_data_tools import DATA_TOOLS
from .organizational_tools import ORGANIZATIONAL_TOOLS
from .api_tools import API_TOOLS


class ToolRegistry:
    """Central registry for all emery-agents tools."""
    
    def __init__(self):
        """Initialize tool registry with all tool modules."""
        # AIDEV-NOTE: Combine all tool registries into single mapping
        self._tool_registry = {
            **BASE_TOOLS,
            **EMAIL_TOOLS,
            **DATA_TOOLS,
            **ORGANIZATIONAL_TOOLS,
            **API_TOOLS
        }
    
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


# Backward compatibility - create instance that can be used like the old ToolLoader
def create_tool_loader():
    """Create tool loader instance for backward compatibility."""
    class CompatibilityToolLoader:
        """Compatibility wrapper for ToolRegistry."""
        
        def __init__(self):
            self.registry = ToolRegistry()
        
        def load_tool(self, tool_config: ToolConfig) -> Any:
            return self.registry.load_tool(tool_config)
        
        def load_tools(self, tool_configs: List[ToolConfig]) -> List[Any]:
            return self.registry.load_tools(tool_configs)
        
        def list_available_tools(self) -> List[str]:
            return self.registry.list_available_tools()
    
    return CompatibilityToolLoader()