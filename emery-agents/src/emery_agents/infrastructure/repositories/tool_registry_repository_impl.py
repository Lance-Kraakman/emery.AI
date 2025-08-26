"""
Tool Registry Repository Implementation

AIDEV-NOTE: Infrastructure implementation using existing ToolRegistry.
Bridges domain interface with existing tool registry infrastructure.
"""

from typing import List, Dict, Any
from ...domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from ...execution.tools.tool_registry import ToolRegistry
from ...core.entities import ToolConfig


class ToolRegistryRepositoryImpl(IToolRegistryRepository):
    """Implementation of tool registry repository using existing ToolRegistry."""
    
    def __init__(self):
        self.tool_registry = ToolRegistry()
    
    def load_tool(self, tool_config: ToolConfig) -> Any:
        """Load a single tool instance from configuration."""
        return self.tool_registry.load_tool(tool_config)
    
    def load_tools(self, tool_configs: List[ToolConfig]) -> List[Any]:
        """Load multiple tools from configurations."""
        return self.tool_registry.load_tools(tool_configs)
    
    def list_available_tools(self) -> List[str]:
        """List all available tool names."""
        return self.tool_registry.list_available_tools()
    
    def get_tool_info(self, tool_name: str) -> Dict[str, Any]:
        """Get information about a specific tool."""
        return self.tool_registry.get_tool_info(tool_name)
    
    def is_tool_available(self, tool_name: str) -> bool:
        """Check if a tool is available."""
        available_tools = self.list_available_tools()
        return tool_name.lower() in [name.lower() for name in available_tools]