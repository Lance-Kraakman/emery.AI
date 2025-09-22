"""
Unified Tool Registry Repository Implementation

AIDEV-NOTE: Updated to use unified tool registry as single source of truth.
Reads from shared/tools-registry.json and pipedream metadata for tool loading.
Maintains backward compatibility with legacy tools.
"""

from typing import Any, Dict, List
from .....domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from .....core.entities import ToolConfig
from ...tools.unified_tool_loader import UnifiedToolLoader


class ToolRegistryRepository(IToolRegistryRepository):
    """Tool registry repository using unified registry as source of truth."""

    def __init__(self):
        """Initialize with unified tool loader."""
        self.unified_loader = UnifiedToolLoader()

    def load_tool(self, tool_config: ToolConfig) -> Any:
        """Load a tool instance from ToolConfig using unified registry."""
        return self.unified_loader.load_tool(tool_config)
    
    def load_tools(self, tool_configs: List[ToolConfig]) -> List[Any]:
        """Load multiple tools from configurations using unified loader."""
        return self.unified_loader.load_tools(tool_configs)
    
    def list_available_tools(self) -> List[str]:
        """List all available tool names from unified registry."""
        return self.unified_loader.get_available_tools()
    
    def get_tool_info(self, tool_name: str) -> Dict[str, Any]:
        """Get information about a specific tool from unified registry."""
        tool_config = self.unified_loader.get_tool_config(tool_name)

        if not tool_config:
            return {"error": f"Tool {tool_name} not found"}

        return {
            "name": tool_config["id"],
            "display_name": tool_config["display_name"],
            "description": tool_config["description"],
            "category": tool_config["category"],
            "app": tool_config["app"],
            "tags": tool_config["tags"],
            "available": True,
            "implementation_type": tool_config["implementation"]["type"]
        }
    
    def is_tool_available(self, tool_name: str) -> bool:
        """Check if a tool is available."""
        available_tools = self.list_available_tools()
        return tool_name.lower() in [name.lower() for name in available_tools]