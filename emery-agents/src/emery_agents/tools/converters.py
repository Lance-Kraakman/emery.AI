"""
Tool configuration converters and utilities.

Handles conversion between different tool configuration formats.
"""

from typing import Dict, Any, Optional, Union
from ..domain.entities.models import ToolConfig
from .tool_registry import ToolType, tool_registry


class ToolConfigConverter:
    """Converts between different tool configuration formats."""
    
    @staticmethod
    def from_agent_config(tool_config: Union[ToolConfig, Dict[str, Any]]) -> Dict[str, Any]:
        """Convert agent tool config to registry format."""
        if isinstance(tool_config, ToolConfig):
            return tool_config.config or {}
        elif isinstance(tool_config, dict):
            return tool_config.get("config", {})
        return {}
    
    @staticmethod
    def find_tool_type_by_name(tool_name: str) -> Optional[ToolType]:
        """Find tool type by name from registry."""
        available_tools = tool_registry.get_available_tools()
        
        for tool_type_config in available_tools:
            if (tool_type_config.name.lower() == tool_name.lower() or 
                tool_type_config.tool_type.value == tool_name):
                return tool_type_config.tool_type
        return None
    
    @staticmethod
    def get_tool_name(tool_config: Union[ToolConfig, Dict[str, Any]]) -> str:
        """Extract tool name from config."""
        if isinstance(tool_config, ToolConfig):
            return tool_config.name
        elif isinstance(tool_config, dict):
            return tool_config.get("name", "")
        elif hasattr(tool_config, 'name'):
            return tool_config.name
        else:
            return str(tool_config)
