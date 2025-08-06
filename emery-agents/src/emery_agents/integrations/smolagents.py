"""
Integration with smolagents library for AI agent execution.
Provides CodeAgent and ToolCallingAgent capabilities.
"""

import logging
from typing import Dict, Any, List, Optional

from ..core.types import StepType

logger = logging.getLogger(__name__)


class SmolAgentsIntegration:
    """
    Integration with smolagents library.
    
    Handles execution of AI agent steps using smolagents' CodeAgent and 
    ToolCallingAgent classes with dynamic tool loading.
    """
    
    def __init__(self):
        self.agents = {}
        self.tools_registry = {}
        logger.info("SmolAgentsIntegration initialized")
    
    def _get_agent(self, step_type: StepType, model: Optional[str] = None):
        """
        Get appropriate smolagents agent instance.
        
        Args:
            step_type: Type of step (CODE_STEP or TOOL_STEP)
            model: Model identifier (e.g., "claude-3-sonnet-20240229")
            
        Returns:
            Appropriate smolagents agent instance
        """
        try:
            # Import smolagents dynamically to avoid hard dependency
            from smolagents import CodeAgent, ToolCallingAgent
            
            if step_type == StepType.CODE_STEP:
                return CodeAgent(model=model or "claude-3-sonnet-20240229")
            elif step_type == StepType.TOOL_STEP:
                return ToolCallingAgent(model=model or "claude-3-sonnet-20240229")
            else:
                raise ValueError(f"Unsupported step type for smolagents: {step_type}")
                
        except ImportError:
            raise RuntimeError(
                "smolagents library not available. Install with: uv add smolagents"
            )
    
    async def execute_step(
        self, 
        step_type: StepType,
        instructions: str,
        tools: List[str],
        context: Dict[str, Any],
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute a step using smolagents.
        
        Args:
            step_type: Type of step to execute (CODE_STEP or TOOL_STEP)
            instructions: Instructions for the agent
            tools: List of tool names to load
            context: Current execution context/variables
            model: Model to use for execution
            
        Returns:
            Dict with execution results
        """
        logger.info(f"Executing {step_type.value} step with {len(tools)} tools")
        
        try:
            # Get agent instance
            agent = self._get_agent(step_type, model)
            
            # Load tools
            for tool_name in tools:
                tool = await self._load_tool(tool_name)
                if tool:
                    agent.add_tool(tool)
                    logger.debug(f"Loaded tool: {tool_name}")
            
            # Prepare execution context
            execution_context = {
                **context,
                "instructions": instructions
            }
            
            # Execute the agent
            logger.info(f"Running {step_type.value} with instructions: {instructions[:100]}...")
            result = await agent.run(instructions, **execution_context)
            
            # Format results
            output = {
                "result": result,
                "step_type": step_type.value,
                "tools_used": tools,
                "model": model,
                "status": "success"
            }
            
            logger.info(f"Step execution completed successfully")
            return output
            
        except Exception as e:
            logger.exception(f"Step execution failed: {e}")
            return {
                "error": str(e),
                "step_type": step_type.value,
                "status": "failed"
            }
    
    async def _load_tool(self, tool_name: str):
        """
        Load a tool by name from the tools registry.
        
        Args:
            tool_name: Name of the tool to load
            
        Returns:
            Tool instance or None if not found
        """
        # Check if tool is already loaded
        if tool_name in self.tools_registry:
            return self.tools_registry[tool_name]
        
        try:
            # AIDEV-TODO: Implement dynamic tool loading based on tool_name
            # For now, return None - tools will need to be registered separately
            logger.warning(f"Tool {tool_name} not found in registry")
            return None
            
        except Exception as e:
            logger.error(f"Failed to load tool {tool_name}: {e}")
            return None
    
    def register_tool(self, name: str, tool_instance):
        """
        Register a tool in the tools registry.
        
        Args:
            name: Tool name
            tool_instance: Tool instance
        """
        self.tools_registry[name] = tool_instance
        logger.info(f"Registered tool: {name}")
    
    def list_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        return list(self.tools_registry.keys())


# AIDEV-NOTE: This integration provides the bridge to smolagents library
# AIDEV-TODO: Implement comprehensive tool registry with common tools
# AIDEV-TODO: Add support for tool configuration and parameters
# AIDEV-QUESTION: Should we cache agent instances or create new ones each time?