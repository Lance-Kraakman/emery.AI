"""Integration with smolagents library for AI agent execution."""

import logging
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

# Constants
MAX_LOG_PREVIEW_LENGTH = 100
DEFAULT_HF_MODEL_CODE = "Qwen/Qwen2.5-Coder-32B-Instruct"
DEFAULT_HF_MODEL_GENERAL = "Qwen/Qwen2.5-72B-Instruct"

from ..core.types import (
    StepType, Agent, CapabilityConfig, TaskInstructions, 
    ExecutionResult, ContextData, CapabilityExecutionResult, OrchestratorResult
)
from ..utils.prompts import (
    render_task_executor_selection,
    render_capability_execution,
    render_default_execution
)

logger = logging.getLogger(__name__)

# Import optional dependencies at module level with graceful fallback
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

try:
    from smolagents import CodeAgent, ToolCallingAgent
    from smolagents.models import InferenceClientModel
    SMOLAGENTS_AVAILABLE = True
except ImportError:
    CodeAgent = None
    ToolCallingAgent = None
    InferenceClientModel = None
    SMOLAGENTS_AVAILABLE = False

# Load .env file if it exists
if load_dotenv is not None:
    env_path = "/Users/lancekraakman/orchastrate/emery-agents/src/emery_agents/.env.local"
    if os.path.exists(env_path):
        load_dotenv(env_path)
        logger.info(f"Loaded .env file from {env_path}")
    else:
        logger.debug("No .env.local file found")
else:
    logger.debug("python-dotenv not available, skipping .env loading")


class TaskExecutorAgent:
    """Top-level manager that delegates tasks to capability agents."""
    
    def __init__(self):
        self.manager_agent = None  # The actual smolagents manager agent
        self.capability_agents = {}  # capability_name -> CapabilityAgent
        self.default_executor = None  # DefaultTaskExecutorAgent
        self.tools_registry = {}
        logger.info("TaskExecutorAgent initialized")


class CapabilityAgent:
    """Agent representing a specific capability with tools and servers."""
    
    def __init__(self, capability: CapabilityConfig):
        self.capability = capability
        self.agent = None  # The actual smolagents agent instance
        self.tools = []
        self.servers = []
        logger.info(f"CapabilityAgent initialized for: {capability.name}")
    
    def setup_agent(self):
        """Set up the smolagents agent with capability-specific configuration."""
        if not SMOLAGENTS_AVAILABLE:
            raise ImportError("smolagents library not available")
        
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError("HF_TOKEN environment variable is required")
        
        try:
            # Determine agent type based on capability steps
            has_code_steps = any(step.type == StepType.CODE_STEP for step in self.capability.steps)
            has_tool_steps = any(step.type == StepType.TOOL_STEP for step in self.capability.steps)
            
            # Use the most appropriate model for this capability's first step
            model_name = DEFAULT_HF_MODEL_CODE
            if self.capability.steps and self.capability.steps[0].model:
                model_name = self.capability.steps[0].model
            
            # Create HuggingFace model instance
            model = InferenceClientModel(model_name, token=hf_token)
            
            # Create appropriate agent type
            if has_code_steps and has_tool_steps:
                self.agent = ToolCallingAgent(tools=[], model=model)
            elif has_code_steps:
                self.agent = CodeAgent(tools=[], model=model)
            else:
                self.agent = ToolCallingAgent(tools=[], model=model)
            
            # Configure tools and servers for this capability
            self._setup_tools_and_servers()
            
            logger.info(f"CapabilityAgent setup completed for: {self.capability.name}")
            
        except (ImportError, EnvironmentError):
            raise  # Re-raise these specific exceptions
        except Exception as e:
            logger.exception(f"Unexpected error setting up agent: {e}")
            raise RuntimeError(f"Failed to setup agent: {e}") from e
    
    def _setup_tools_and_servers(self):
        """Set up tools and servers specific to this capability."""
        # Collect all tools from capability steps
        for step in self.capability.steps:
            if step.tools:
                for tool_config in step.tools:
                    # TODO: Load and configure actual tools
                    logger.debug(f"Tool configured for {self.capability.name}: {tool_config.name}")
            
            if step.servers:
                for server_config in step.servers:
                    # TODO: Load and configure actual servers
                    logger.debug(f"Server configured for {self.capability.name}: {server_config.name}")
    
    async def execute(self, instructions: str, context: ContextData) -> CapabilityExecutionResult:
        """Execute task instructions using this capability agent."""
        if not self.agent:
            self.setup_agent()
        
        try:
            # Use templated prompt for cleaner, more maintainable code
            execution_prompt = render_capability_execution(
                capability_name=self.capability.name,
                capability_description=self.capability.description,
                instructions=instructions,
                context=context
            )
            
            result = await self.agent.run(execution_prompt)
            
            return {
                "capability_used": self.capability.name,
                "output": result,
                "status": "completed",
                "agent_type": type(self.agent).__name__
            }
            
        except Exception as e:
            logger.error(f"CapabilityAgent execution failed for {self.capability.name}: {e}")
            return {
                "capability_used": self.capability.name,
                "error": str(e),
                "status": "failed"
            }


class DefaultTaskExecutorAgent:
    """
    Default agent that directly executes tasks when no specific capability matches.
    
    This agent:
    1. Handles tasks that don't match any specific capability
    2. Executes instructions directly with available tools
    3. Serves as the fallback execution path
    """
    
    def __init__(self):
        self.agent = None
        logger.info("DefaultTaskExecutorAgent initialized")
    
    def setup_agent(self):
        """Set up the default execution agent."""
        try:
            from smolagents import ToolCallingAgent
            from smolagents.models import InferenceClientModel
            
            if not os.getenv("HF_TOKEN"):
                raise RuntimeError("HF_TOKEN environment variable is required")
            
            # Create HuggingFace model instance for general tasks
            model = InferenceClientModel("Qwen/Qwen2.5-72B-Instruct", token=os.getenv("HF_TOKEN"))
            
            # Use versatile model for general task execution
            self.agent = ToolCallingAgent(
                tools=[],  # Tools can be added later as needed
                model=model
            )
            
            logger.info("DefaultTaskExecutorAgent setup completed")
            
        except Exception as e:
            raise RuntimeError(f"Failed to setup default agent: {e}")
    
    async def execute(self, instructions: str, context: ContextData) -> CapabilityExecutionResult:
        """Execute task instructions directly without specific capability routing."""
        if not self.agent:
            self.setup_agent()
        
        try:
            # Use templated prompt for cleaner, more maintainable code
            execution_prompt = render_default_execution(
                instructions=instructions,
                context=context,
                available_tools=self.list_available_tools() if hasattr(self, 'list_available_tools') else None
            )
            
            result = await self.agent.run(execution_prompt)
            
            return {
                "capability_used": "default_executor",
                "output": result,
                "status": "completed",
                "agent_type": "DefaultTaskExecutorAgent"
            }
            
        except Exception as e:
            logger.error(f"DefaultTaskExecutorAgent execution failed: {e}")
            return {
                "capability_used": "default_executor",
                "error": str(e),
                "status": "failed"
            }


class SmolAgentsOrchestrator:
    """
    Main orchestrator that coordinates the agent hierarchy.
    
    Manages:
    1. TaskExecutorAgent (top-level manager)
    2. CapabilityAgents (one per capability)
    3. DefaultTaskExecutorAgent (fallback)
    """
    
    def __init__(self):
        self.task_executor = TaskExecutorAgent()
        self.default_executor = DefaultTaskExecutorAgent()
        self.tools_registry = {}
        logger.info("SmolAgentsOrchestrator initialized")
    
    def setup_agent_orchestrator(self, agent: Agent) -> None:
        """
        Set up the agent hierarchy with TaskExecutorAgent managing CapabilityAgents.
        
        Args:
            agent: The agent configuration with capabilities
        """
        logger.info(f"Setting up agent hierarchy for {agent.name} with {len(agent.capabilities or [])} capabilities")
        
        # Create CapabilityAgent for each capability
        if agent.capabilities:
            for capability in agent.capabilities:
                capability_agent = CapabilityAgent(capability)
                self.task_executor.capability_agents[capability.name] = capability_agent
                logger.info(f"Created CapabilityAgent: {capability.name}")
        
        # Set up the TaskExecutorAgent with managed agents
        self._setup_task_executor_agent(agent)
        
        # Store reference to default executor
        self.task_executor.default_executor = self.default_executor
        
        logger.info("Agent hierarchy setup complete")
    
    def _setup_task_executor_agent(self, agent: Agent) -> None:
        """
        Set up the TaskExecutorAgent as a manager agent with CapabilityAgents as managed_agents.
        
        Args:
            agent: The main agent configuration
        """
        try:
            from smolagents import ToolCallingAgent
            from smolagents.models import InferenceClientModel
            # TODO: Use ManagedAgent when available in smolagents
            
            if not os.getenv("HF_TOKEN"):
                raise RuntimeError("HF_TOKEN environment variable is required")
            
            # Create HuggingFace model instance for management decisions
            model = InferenceClientModel("Qwen/Qwen2.5-72B-Instruct", token=os.getenv("HF_TOKEN"))
            
            # Create the manager agent
            self.task_executor.manager_agent = ToolCallingAgent(
                tools=[],  # No tools needed for management decisions
                model=model
            )
            
            # TODO: Configure managed_agents parameter when available
            # For now, we manage the routing logic ourselves but through proper agent calls
            
            logger.info("TaskExecutorAgent setup completed")
            
        except ImportError as e:
            logger.warning(f"smolagents not available: {e}")
            # Continue without smolagents - will use fallback logic
        except Exception as e:
            logger.error(f"Failed to setup TaskExecutorAgent: {e}")
            raise
    
    async def execute_with_orchestrator(
        self, 
        instructions: TaskInstructions,
        trigger_data: ContextData
    ) -> OrchestratorResult:
        """
        Execute instructions using the agent hierarchy pattern.
        
        TaskExecutorAgent manages the execution by:
        1. Deciding which CapabilityAgent to use 
        2. Delegating to appropriate CapabilityAgent
        3. Falling back to DefaultTaskExecutorAgent if no capability matches
        
        Args:
            instructions: The task instructions with natural language and optional tools/servers
            trigger_data: Additional context data
            
        Returns:
            Dict with execution results
        """
        logger.info(f"Agent hierarchy executing: {instructions.instructions[:MAX_LOG_PREVIEW_LENGTH]}...")
        
        try:
            # Step 1: Use TaskExecutorAgent to select the appropriate capability or default
            selected_capability = await self._manager_select_capability(instructions)
            
            # Step 2: Execute using the selected capability agent or default executor
            if selected_capability and selected_capability in self.task_executor.capability_agents:
                capability_agent = self.task_executor.capability_agents[selected_capability]
                result = await capability_agent.execute(instructions.instructions, trigger_data)
                
                logger.info(f"Executed with CapabilityAgent: {selected_capability}")
            else:
                # Use DefaultTaskExecutorAgent for direct execution
                result = await self.default_executor.execute(instructions.instructions, trigger_data)
                
                logger.info("Executed with DefaultTaskExecutorAgent")
            
            return {
                "status": "success",
                "selected_capability": selected_capability or "default_executor",
                "result": result,
                "orchestrator": "agent_hierarchy"
            }
            
        except Exception as e:
            logger.exception(f"Agent hierarchy execution failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "orchestrator": "agent_hierarchy"
            }
    
    async def _manager_select_capability(self, instructions: TaskInstructions) -> Optional[str]:
        """
        Use TaskExecutorAgent (manager agent) to intelligently select the best capability.
        
        Args:
            instructions: The task instructions
            
        Returns:
            Name of the selected capability or None for default execution
        """
        if not self.task_executor.capability_agents:
            logger.info("No capability agents available, using default executor")
            return None
        
        # Prepare capabilities list for templated prompt
        capabilities = [
            {
                "name": name,
                "description": capability_agent.capability.description
            }
            for name, capability_agent in self.task_executor.capability_agents.items()
        ]
        
        try:
            if self.task_executor.manager_agent:
                # Use templated prompt for cleaner, more maintainable code
                selection_prompt = render_task_executor_selection(
                    instructions=instructions.instructions,
                    capabilities=capabilities
                )
                
                # Use manager agent to make intelligent selection
                selected = await self.task_executor.manager_agent.run(selection_prompt)
                selected = selected.strip()
                
                # Validate selection
                if selected == "DEFAULT":
                    logger.info("Manager agent selected: DefaultTaskExecutorAgent")
                    return None
                elif selected in self.task_executor.capability_agents:
                    logger.info(f"Manager agent selected CapabilityAgent: {selected}")
                    return selected
            
            # Fallback to simple keyword matching
            return self._fallback_capability_selection(instructions)
            
        except Exception as e:
            logger.warning(f"Manager agent selection failed, using fallback: {e}")
            return self._fallback_capability_selection(instructions)
    
    def _fallback_capability_selection(self, instructions: TaskInstructions) -> Optional[str]:
        """
        Fallback capability selection using simple keyword matching.
        
        Args:
            instructions: The task instructions
            
        Returns:
            Name of the selected capability or None for default execution
        """
        if not self.task_executor.capability_agents:
            logger.info("Fallback: No capability agents available, using default")
            return None
        
        instructions_lower = instructions.instructions.lower()
        
        # Simple keyword matching
        for capability_name, capability_agent in self.task_executor.capability_agents.items():
            if capability_name.lower() in instructions_lower:
                logger.info(f"Fallback selected capability by name: {capability_name}")
                return capability_name
            
            description = capability_agent.capability.description
            if description and any(
                word in instructions_lower 
                for word in description.lower().split()[:3]
            ):
                logger.info(f"Fallback selected capability by description: {capability_name}")
                return capability_name
        
        # Use default executor as ultimate fallback
        logger.info("Fallback: No capability match found, using default executor")
        return None
    
    # Legacy methods for backward compatibility with existing runner code
    
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
                
        except Exception as e:
            raise RuntimeError(f"Failed to create agent: {e}")
    
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
            logger.info(f"Running {step_type.value} with instructions: {instructions[:MAX_LOG_PREVIEW_LENGTH]}...")
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


# AIDEV-NOTE: This integration provides proper agent hierarchy using smolagents
# AIDEV-NOTE: Architecture: TaskExecutorAgent -> CapabilityAgents -> DefaultTaskExecutorAgent
# AIDEV-NOTE: Uses HuggingFace models (Qwen series) exclusively via HF_TOKEN env var
# AIDEV-TODO: Implement ManagedAgent when available in smolagents for true managed_agents pattern
# AIDEV-TODO: Implement comprehensive tool registry with dynamic tool loading
# AIDEV-TODO: Add support for tool configuration and parameters in CapabilityAgents