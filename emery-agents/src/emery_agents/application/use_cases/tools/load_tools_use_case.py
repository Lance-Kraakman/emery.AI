"""
Load Tools Use Case

AIDEV-NOTE: Use case for loading and managing tools.
Separates tool loading concerns from agent execution.
"""

import logging
from typing import Any, Dict, List, Optional

from ....domain.tools.repositories.tool_repository import IToolRepository
from ....domain.tools.value_objects.tool_config import ToolConfig

logger = logging.getLogger(__name__)


class LoadToolsUseCase:
    """
    Use case for loading and managing tools.
    
    AIDEV-NOTE: Focused on tool loading and validation operations.
    """
    
    def __init__(self, tool_repository: IToolRepository):
        self._tool_repository = tool_repository
    
    async def load_tools_for_agent(
        self, 
        tool_configs: List[Dict[str, Any]], 
        agent_type: str = "default"
    ) -> List[Any]:
        """
        Load tool instances for an agent.
        
        Args:
            tool_configs: List of tool configuration dictionaries
            agent_type: Type of agent (for compatibility checking)
            
        Returns:
            List of loaded tool instances
        """
        logger.info(f"[LOAD-TOOLS-USE-CASE] Loading {len(tool_configs)} tools for agent type: {agent_type}")
        
        loaded_tools = []
        
        for tool_config_data in tool_configs:
            try:
                # Create value object with validation
                tool_config = ToolConfig.from_dict(tool_config_data)
                
                # Validate tool is compatible with agent type
                if not self._is_tool_compatible(tool_config, agent_type):
                    logger.warning(f"Tool {tool_config.display_name} not compatible with agent type {agent_type}")
                    continue
                
                # Load tool instance
                tool_instance = self._tool_repository.create_tool_instance(tool_config)
                if tool_instance is not None:
                    loaded_tools.append(tool_instance)
                    logger.debug(f"Loaded tool: {tool_config.display_name}")
                else:
                    logger.warning(f"Failed to load tool: {tool_config.display_name}")
                    
            except Exception as error:
                logger.exception(f"Error loading tool {tool_config_data}: {error}")
                # Continue loading other tools
        
        logger.info(f"[LOAD-TOOLS-USE-CASE] Successfully loaded {len(loaded_tools)} tools")
        return loaded_tools
    
    async def validate_tool_configurations(
        self, 
        tool_configs: List[Dict[str, Any]]
    ) -> Dict[str, bool]:
        """
        Validate a list of tool configurations.
        
        Returns:
            Dict mapping tool names to validation results
        """
        logger.info(f"[LOAD-TOOLS-USE-CASE] Validating {len(tool_configs)} tool configurations")
        
        validation_results = {}
        
        for tool_config_data in tool_configs:
            try:
                tool_config = ToolConfig.from_dict(tool_config_data)
                is_valid = self._tool_repository.validate_tool_config(tool_config)
                validation_results[tool_config.name] = is_valid
                
                if not is_valid:
                    logger.warning(f"Tool configuration invalid: {tool_config.display_name}")
                    
            except Exception as error:
                tool_name = tool_config_data.get("name", "unknown")
                validation_results[tool_name] = False
                logger.exception(f"Error validating tool {tool_name}: {error}")
        
        return validation_results
    
    async def get_available_tools(self, agent_type: str = "default") -> List[str]:
        """
        Get list of available tools for an agent type.
        
        Args:
            agent_type: Type of agent
            
        Returns:
            List of available tool names
        """
        all_tools = self._tool_repository.list_available_tools()
        compatible_tools = self._tool_repository.get_compatible_tools(agent_type)
        
        # Return intersection of available and compatible tools
        available_for_agent = [tool for tool in all_tools if tool in compatible_tools]
        
        logger.info(f"[LOAD-TOOLS-USE-CASE] Found {len(available_for_agent)} tools available for {agent_type}")
        return available_for_agent
    
    async def get_tool_information(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a tool.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            Tool information dict or None if not found
        """
        tool_info = self._tool_repository.get_tool_info(tool_name)
        
        if tool_info:
            # Add dependency information
            dependencies = self._tool_repository.get_tool_dependencies(tool_name)
            tool_info["dependencies"] = dependencies
            
            logger.debug(f"Retrieved information for tool: {tool_name}")
        else:
            logger.warning(f"Tool not found: {tool_name}")
        
        return tool_info
    
    async def refresh_tool_registry(self) -> None:
        """
        Refresh the tool registry to pick up new tools.
        
        AIDEV-NOTE: Useful for development and dynamic tool loading.
        """
        logger.info("[LOAD-TOOLS-USE-CASE] Refreshing tool registry")
        
        try:
            self._tool_repository.refresh_tool_registry()
            logger.info("Tool registry refreshed successfully")
        except Exception as error:
            logger.exception(f"Error refreshing tool registry: {error}")
            raise
    
    def _is_tool_compatible(self, tool_config: ToolConfig, agent_type: str) -> bool:
        """Check if tool is compatible with agent type."""
        try:
            compatible_tools = self._tool_repository.get_compatible_tools(agent_type)
            return tool_config.name in compatible_tools
        except Exception as error:
            logger.exception(f"Error checking tool compatibility: {error}")
            return True  # Default to compatible if check fails