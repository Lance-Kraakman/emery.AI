"""
Tool Repository Interface

AIDEV-NOTE: Repository interface for tool loading and management.
Migrated from existing interface to fit DDD structure.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union

from ..value_objects.tool_config import ToolConfig


class IToolRepository(ABC):
    """
    Repository interface for tool loading and management.
    
    AIDEV-NOTE: Abstracts tool loading from different sources (SmolAgents, custom, etc.).
    """
    
    @abstractmethod
    def create_tool_instance(self, tool_config: Union[ToolConfig, Dict[str, Any]]) -> Optional[Any]:
        """
        Create a tool instance from configuration.
        
        Args:
            tool_config: Tool configuration (ToolConfig or dict)
            
        Returns:
            Tool instance or None if not found
        """
        pass
    
    @abstractmethod
    def list_available_tools(self) -> List[str]:
        """List all available tool names."""
        pass
    
    @abstractmethod
    def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific tool."""
        pass
    
    @abstractmethod
    def is_tool_available(self, tool_name: str) -> bool:
        """Check if a tool is available."""
        pass
    
    @abstractmethod
    def get_tool_dependencies(self, tool_name: str) -> List[str]:
        """Get dependencies for a tool."""
        pass
    
    @abstractmethod
    def validate_tool_config(self, tool_config: ToolConfig) -> bool:
        """Validate tool configuration."""
        pass
    
    @abstractmethod
    def get_compatible_tools(self, agent_type: str) -> List[str]:
        """Get tools compatible with an agent type."""
        pass
    
    @abstractmethod
    def refresh_tool_registry(self) -> None:
        """Refresh the tool registry (reload available tools)."""
        pass