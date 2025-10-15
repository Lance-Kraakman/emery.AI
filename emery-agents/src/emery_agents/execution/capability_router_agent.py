"""
Capability Router Agent

AIDEV-NOTE: Direct tool-calling agent for capabilityName=null tasks.
Replaces complex routing with simple tool execution using ToolCallingAgent.
"""

import os
import logging
from typing import Any, Dict

from smolagents import ToolCallingAgent

from .tools.tool_registry import ToolRegistry
from ..domain.ai.services.model_provider_service import IModelProviderService
from ..core.entities import ToolConfig

logger = logging.getLogger(__name__)


class CapabilityRouterAgent:
    """
    Direct tool-calling agent for capability routing.
    
    AIDEV-NOTE: This agent handles tasks with capabilityName=null by loading
    all available tools and executing instructions directly via ToolCallingAgent.
    No intermediate routing or step creation - just direct tool execution.
    """
    
    def __init__(self, model_provider: IModelProviderService):
        self.tool_registry = ToolRegistry()
        self.model_provider = model_provider
        self._agent_cache = {}  # Cache by tool configuration
        logger.info("CapabilityRouterAgent initialized with centralized model provider")
    
    async def execute_instructions(self, instructions: str, available_tools: list = None) -> str:
        """
        Execute instructions using direct tool calls.
        
        Args:
            instructions: Task instructions to execute
            available_tools: Optional list of tool names to restrict to
            
        Returns:
            Execution result from the ToolCallingAgent
        """
        logger.info(f"Executing instructions with tools: {available_tools}")
        
        # Create cache key based on tool configuration
        tools_key = tuple(sorted(available_tools)) if available_tools else "all_tools"
        
        # Create agent if not cached for this tool configuration
        if tools_key not in self._agent_cache:
            logger.info(f"Creating new agent for tools: {tools_key}")
            self._agent_cache[tools_key] = await self._create_tool_calling_agent(available_tools)
        
        agent = self._agent_cache[tools_key]
        
        # Execute instructions directly with timeout handling
        try:
            logger.info("Starting tool execution...")
            result = agent.run(instructions)
            logger.info("Instructions executed successfully")
            return result
        except Exception as e:
            logger.error(f"Execution failed: {e}")
            raise
    
    async def _create_tool_calling_agent(self, tool_names: list = None) -> ToolCallingAgent:
        """
        Create ToolCallingAgent with specified tools.
        
        AIDEV-NOTE: Updated to use centralized model provider instead of hardcoded model creation.
        """        
        # Load only specified tools (avoid loading all tools to prevent performance issues)
        if tool_names:
            tool_configs = [ToolConfig(name=name, version="1.0", config={}) for name in tool_names]
            tools = self.tool_registry.load_tools(tool_configs)
            logger.info(f"Loaded {len(tools)} specified tools: {tool_names}")
        else:
            # Default to essential tools only to avoid performance issues
            default_tools = ['emery_database', 'table_data']
            tool_configs = [ToolConfig(name=name, version="1.0", config={}) for name in default_tools]
            tools = self.tool_registry.load_tools(tool_configs)
            logger.info(f"Loaded {len(tools)} default tools: {default_tools}")
        
        # Get appropriate model from simplified provider
        model = self.model_provider.get_model('tool_calling')
        
        agent = ToolCallingAgent(
            tools=tools,
            model=model,
            max_steps=10  # Limit steps to prevent infinite loops
        )
        
        agent.name = "capability_router"
        agent.description = "Direct tool-calling agent for capability routing"
        
        return agent