"""
Tool Registry Repository Interface

AIDEV-NOTE: Domain interface for tool registry operations.
Abstracts tool loading and management from implementation details.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from ....core.entities import ToolConfig


class IToolRegistryRepository(ABC):
    """Repository interface for tool registry operations."""
    
    @abstractmethod
    def load_tool(self, tool_config: ToolConfig, api_key: str = "", api_key_mode: str = "agent") -> Any:
        """
        Load a single tool instance from configuration.

        Args:
            tool_config: Tool configuration
            api_key: API key for tool authentication
            api_key_mode: Mode of API key usage ('user' or 'agent')

        Returns:
            Tool instance for execution framework

        Raises:
            ValueError: If tool not found or cannot be loaded
        """
        pass

    @abstractmethod
    def load_tools(self, tool_configs: List[ToolConfig], api_key: str = "", api_key_mode: str = "agent") -> List[Any]:
        """
        Load multiple tools from configurations.

        Args:
            tool_configs: List of tool configurations
            api_key: API key for tool authentication
            api_key_mode: Mode of API key usage ('user' or 'agent')

        Returns:
            List of tool instances
        """
        pass
    
    @abstractmethod
    def list_available_tools(self) -> List[str]:
        """
        List all available tool names.
        
        Returns:
            List of tool names
        """
        pass
    
    @abstractmethod
    def get_tool_info(self, tool_name: str) -> Dict[str, Any]:
        """
        Get information about a specific tool.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            Tool information dictionary
        """
        pass
    
    @abstractmethod
    def is_tool_available(self, tool_name: str) -> bool:
        """
        Check if a tool is available.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            True if tool is available
        """
        pass