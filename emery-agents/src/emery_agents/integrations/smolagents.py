"""
Integration with smolagents library for AI agent execution.
Provides orchestrator-based capability routing using managed agents.
"""

import logging
from typing import Dict, Any, List, Optional

from ..core.types import StepType, Agent, CapabilityConfig, TaskInstructions

logger = logging.getLogger(__name__)


class SmolAgentsOrchestrator:
    """
    Smolagents-based orchestrator for intelligent capability routing and execution.
    
    Uses smolagents' ManagedAgent and orchestrator patterns to:
    1. Convert each capability into a managed sub-agent
    2. Use an orchestrator agent to route instructions to the best sub-agent
    3. Execute instructions using smolagents' agent composition
    """
    
    def __init__(self):
        self.orchestrator_agent = None
        self.managed_agents = {}  # capability_name -> ManagedAgent
        self.tools_registry = {}
        logger.info("SmolAgentsOrchestrator initialized")
    
    def setup_agent_orchestrator(self, agent: Agent) -> None:
        """
        Set up the smolagents orchestrator with managed sub-agents for each capability.
        
        Args:
            agent: The agent configuration with capabilities
        """
        import os
        
        if not os.getenv("HF_TOKEN"):
            raise RuntimeError("HF_TOKEN environment variable is required. Get your token from https://huggingface.co/settings/tokens")
        
        try:
            from smolagents import CodeAgent, ToolCallingAgent
            # TODO: Import ManagedAgent and orchestrator when available in smolagents
            
            logger.info(f"Setting up orchestrator for agent {agent.name} with {len(agent.capabilities)} capabilities")
            
            # Create managed agents for each capability
            for capability in agent.capabilities:
                self._create_managed_agent_for_capability(capability)
            
            # Create the orchestrator agent that routes to sub-agents
            self._create_orchestrator_agent(agent)
            
            logger.info("Smolagents orchestrator setup complete")
            
        except ImportError as e:
            raise RuntimeError(f"smolagents library not available: {e}")
    
    def _create_managed_agent_for_capability(self, capability: CapabilityConfig) -> None:
        """
        Create a managed sub-agent for a specific capability.
        
        Args:
            capability: The capability configuration
        """
        try:
            from smolagents import CodeAgent, ToolCallingAgent
            
            # For now, use basic agent types - this will be enhanced when ManagedAgent is available
            # Determine agent type based on capability steps
            has_code_steps = any(step.type == StepType.CODE_STEP for step in capability.steps)
            has_tool_steps = any(step.type == StepType.TOOL_STEP for step in capability.steps)
            
            agent_kwargs = {
                "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
                "token": os.getenv("HF_TOKEN")
            }
            
            if has_code_steps and has_tool_steps:
                # Use ToolCallingAgent as it can handle both
                sub_agent = ToolCallingAgent(**agent_kwargs)
            elif has_code_steps:
                sub_agent = CodeAgent(**agent_kwargs)
            else:
                sub_agent = ToolCallingAgent(**agent_kwargs)
            
            # Add tools for this capability
            for step in capability.steps:
                if step.tools:
                    for tool_config in step.tools:
                        # TODO: Load and add tools based on tool_config
                        pass
            
            self.managed_agents[capability.name] = {
                'agent': sub_agent,
                'capability': capability,
                'description': capability.description
            }
            
            logger.info(f"Created managed agent for capability: {capability.name}")
            
        except Exception as e:
            logger.error(f"Failed to create managed agent for capability {capability.name}: {e}")
    
    def _create_orchestrator_agent(self, agent: Agent) -> None:
        """
        Create the main orchestrator agent that routes instructions to sub-agents.
        
        Args:
            agent: The main agent configuration
        """
        try:
            from smolagents import ToolCallingAgent
            
            # Create orchestrator with routing capabilities
            self.orchestrator_agent = ToolCallingAgent(
                model="Qwen/Qwen2.5-72B-Instruct",  # Use larger model for routing decisions
                token=os.getenv("HF_TOKEN")
            )
            
            logger.info("Created orchestrator agent")
            
        except Exception as e:
            logger.error(f"Failed to create orchestrator agent: {e}")
    
    async def execute_with_orchestrator(
        self, 
        instructions: TaskInstructions,
        trigger_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute instructions using the smolagents orchestrator pattern.
        
        Args:
            instructions: The task instructions with natural language and optional tools/servers
            trigger_data: Additional context data
            
        Returns:
            Dict with execution results
        """
        logger.info(f"Orchestrator executing: {instructions.instructions[:100]}...")
        
        try:
            # Step 1: Use orchestrator to select the best capability (sub-agent)
            selected_capability = await self._route_to_best_capability(instructions)
            
            # Step 2: Execute using the selected sub-agent
            if selected_capability in self.managed_agents:
                result = await self._execute_with_sub_agent(
                    selected_capability, 
                    instructions, 
                    trigger_data
                )
            else:
                # Fallback: execute directly with orchestrator
                result = await self._execute_directly_with_orchestrator(
                    instructions, 
                    trigger_data
                )
            
            return {
                "status": "success",
                "selected_capability": selected_capability,
                "result": result,
                "orchestrator": "smolagents"
            }
            
        except Exception as e:
            logger.exception(f"Orchestrator execution failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "orchestrator": "smolagents"
            }
    
    async def _route_to_best_capability(self, instructions: TaskInstructions) -> str:
        """
        Use orchestrator agent to intelligently route to the best capability.
        
        Args:
            instructions: The task instructions
            
        Returns:
            Name of the selected capability
        """
        # Create routing prompt with available capabilities
        capabilities_desc = []
        for name, managed_agent in self.managed_agents.items():
            capabilities_desc.append(f"- {name}: {managed_agent['description']}")
        
        routing_prompt = f"""
        You are an intelligent agent orchestrator. Given the user instructions and available capabilities, 
        select the BEST capability to handle the request.
        
        User Instructions: "{instructions.instructions}"
        
        Available Capabilities:
        {chr(10).join(capabilities_desc)}
        
        Respond with ONLY the capability name (no explanation).
        If no capability is perfect, choose the most relevant one.
        """
        
        try:
            if self.orchestrator_agent:
                # Use orchestrator to make intelligent routing decision
                selected = await self.orchestrator_agent.run(routing_prompt)
                selected = selected.strip()
                
                # Validate selection
                if selected in self.managed_agents:
                    logger.info(f"Orchestrator selected capability: {selected}")
                    return selected
            
            # Fallback to simple keyword matching
            return self._fallback_capability_selection(instructions)
            
        except Exception as e:
            logger.warning(f"Orchestrator routing failed, using fallback: {e}")
            return self._fallback_capability_selection(instructions)
    
    def _fallback_capability_selection(self, instructions: TaskInstructions) -> str:
        """
        Fallback capability selection using simple keyword matching.
        
        Args:
            instructions: The task instructions
            
        Returns:
            Name of the selected capability
        """
        if not self.managed_agents:
            return "general_task"
        
        instructions_lower = instructions.instructions.lower()
        
        # Simple keyword matching
        for capability_name, managed_agent in self.managed_agents.items():
            if capability_name.lower() in instructions_lower:
                logger.info(f"Fallback selected capability by name: {capability_name}")
                return capability_name
            
            if managed_agent['description'] and any(
                word in instructions_lower 
                for word in managed_agent['description'].lower().split()[:3]
            ):
                logger.info(f"Fallback selected capability by description: {capability_name}")
                return capability_name
        
        # Return first capability as ultimate fallback
        first_capability = list(self.managed_agents.keys())[0]
        logger.info(f"Using first capability as fallback: {first_capability}")
        return first_capability
    
    async def _execute_with_sub_agent(
        self, 
        capability_name: str, 
        instructions: TaskInstructions,
        trigger_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute using a specific sub-agent (capability).
        
        Args:
            capability_name: Name of the capability to use
            instructions: Task instructions
            trigger_data: Additional context
            
        Returns:
            Execution results
        """
        managed_agent_info = self.managed_agents[capability_name]
        sub_agent = managed_agent_info['agent']
        capability = managed_agent_info['capability']
        
        logger.info(f"Executing with sub-agent: {capability_name}")
        
        # Create execution prompt that includes the capability context
        execution_prompt = f"""
        You are executing as the '{capability_name}' capability: {capability.description}
        
        User Instructions: {instructions.instructions}
        
        Additional Context: {trigger_data}
        
        Execute the requested task according to your capability specialization.
        """
        
        try:
            result = await sub_agent.run(execution_prompt)
            return {
                "capability_used": capability_name,
                "output": result,
                "status": "completed"
            }
        except Exception as e:
            logger.error(f"Sub-agent execution failed for {capability_name}: {e}")
            return {
                "capability_used": capability_name,
                "error": str(e),
                "status": "failed"
            }
    
    async def _execute_directly_with_orchestrator(
        self, 
        instructions: TaskInstructions,
        trigger_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute directly with orchestrator when no suitable sub-agent exists.
        
        Args:
            instructions: Task instructions
            trigger_data: Additional context
            
        Returns:
            Execution results
        """
        logger.info("Executing directly with orchestrator agent")
        
        execution_prompt = f"""
        User Instructions: {instructions.instructions}
        
        Additional Context: {trigger_data}
        
        Execute the requested task.
        """
        
        try:
            result = await self.orchestrator_agent.run(execution_prompt)
            return {
                "capability_used": "orchestrator_direct",
                "output": result,
                "status": "completed"
            }
        except Exception as e:
            logger.error(f"Direct orchestrator execution failed: {e}")
            return {
                "capability_used": "orchestrator_direct", 
                "error": str(e),
                "status": "failed"
            }
    
    def _get_agent(self, step_type: StepType, model: Optional[str] = None):
        """
        Get appropriate smolagents agent instance.
        
        Args:
            step_type: Type of step (CODE_STEP or TOOL_STEP)
            model: Model identifier (e.g., "Qwen/Qwen2.5-Coder-32B-Instruct")
            
        Returns:
            Appropriate smolagents agent instance
        """
        import os
        
        try:
            # Import smolagents dynamically to avoid hard dependency
            from smolagents import CodeAgent, ToolCallingAgent
            
            # Require HF_TOKEN for operation
            if not os.getenv("HF_TOKEN"):
                raise RuntimeError("HF_TOKEN environment variable is required. Get your token from https://huggingface.co/settings/tokens")
            
            # Use Qwen model as default
            default_model = "Qwen/Qwen2.5-Coder-32B-Instruct"
            effective_model = model or default_model
            
            # Configure HF token
            agent_kwargs = {"model": effective_model, "token": os.getenv("HF_TOKEN")}
            
            if step_type == StepType.CODE_STEP:
                return CodeAgent(**agent_kwargs)
            elif step_type == StepType.TOOL_STEP:
                return ToolCallingAgent(**agent_kwargs)
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
# AIDEV-NOTE: Uses HuggingFace models (Qwen series) exclusively via HF_TOKEN env var
# AIDEV-TODO: Implement comprehensive tool registry with common tools
# AIDEV-TODO: Add support for tool configuration and parameters
# AIDEV-QUESTION: Should we cache agent instances or create new ones each time?