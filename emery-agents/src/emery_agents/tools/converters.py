"""
Tool configuration converters and utilities.

Handles conversion between different tool configuration formats.
"""

from typing import Dict, Any, Optional, Union
from ..domain.entities.models import ToolConfig

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
