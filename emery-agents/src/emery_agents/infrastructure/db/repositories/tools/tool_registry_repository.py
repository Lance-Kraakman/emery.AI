"""
Pure Tool Registry Repository Implementation

AIDEV-NOTE: Pure DDD infrastructure implementation. 
Ports all tool registry logic from execution/tools/tool_registry.py.
No bridge pattern - contains the actual business logic.
"""

from typing import Any, Dict, List
from .....domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from .....core.entities import ToolConfig


class ToolRegistryRepository(IToolRegistryRepository):
    """Pure tool registry repository implementation with ported logic."""
    
    def __init__(self):
        """Initialize tool registry with all tool modules."""
        # AIDEV-NOTE: Ported tool registry from execution/tools/tool_registry.py
        from .....execution.tools.base_tools import BASE_TOOLS
        from .....execution.tools.mock_email_tools import EMAIL_TOOLS  
        from .....execution.tools.mock_data_tools import DATA_TOOLS
        from .....execution.tools.organizational_tools import ORGANIZATIONAL_TOOLS
        from .....execution.tools.api_tools import API_TOOLS
        
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
        
        AIDEV-NOTE: Ported from ToolRegistry.load_tool() - pure implementation.
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
    
    def get_tool_info(self, tool_name: str) -> Dict[str, Any]:
        """
        Get information about a specific tool.
        
        AIDEV-NOTE: Ported from ToolRegistry.get_tool_info() with enhanced return type.
        """
        tool_name_lower = tool_name.lower()
        
        if tool_name_lower not in self._tool_registry:
            return {"error": f"Tool {tool_name} not found"}
        
        # Determine tool category - ported logic
        from .....execution.tools.base_tools import BASE_TOOLS
        from .....execution.tools.mock_email_tools import EMAIL_TOOLS  
        from .....execution.tools.mock_data_tools import DATA_TOOLS
        from .....execution.tools.organizational_tools import ORGANIZATIONAL_TOOLS
        from .....execution.tools.api_tools import API_TOOLS
        
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
    
    def is_tool_available(self, tool_name: str) -> bool:
        """Check if a tool is available."""
        available_tools = self.list_available_tools()
        return tool_name.lower() in [name.lower() for name in available_tools]