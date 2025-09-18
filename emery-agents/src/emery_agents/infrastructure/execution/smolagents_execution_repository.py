"""
Pure SmolAgents Execution Repository Implementation

AIDEV-NOTE: Pure DDD infrastructure implementation. 
Ports all smolagents execution logic from infrastructure/execution/smolagents_execution_service.py.
Works directly with ExecutionContext - no TaskRequest conversion bridge pattern.
"""

import logging
import os
import time
import json
from typing import Dict, Any, List, Optional, Union, AsyncIterator

from smolagents import CodeAgent, ToolCallingAgent

from ...domain.execution.repositories.execution_repository import IExecutionRepository
from ...domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
from ...domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from ...domain.ai.services.model_provider_service import IModelProviderService
from ...core.entities import ToolConfig, CapabilityConfig, StepConfig
from ...core.types import StepType

logger = logging.getLogger(__name__)


class SmolAgentsExecutionRepository(IExecutionRepository):
    """
    Pure smolagents execution repository implementation.
    
    AIDEV-NOTE: Works directly with ExecutionContext - no bridge pattern.
    Contains all ported smolagents agent creation and execution logic.
    """
    
    def __init__(self, tool_registry_repository: IToolRegistryRepository, model_provider: IModelProviderService):
        self.tool_registry_repository = tool_registry_repository
        self.model_provider = model_provider
        self.agent_cache: Dict[str, CodeAgent] = {}  # Cache by execution context hash
        logger.info("SmolAgentsExecutionRepository initialized with centralized model provider")
    
    async def execute_task(self, context: ExecutionContext) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute a task with given execution context.
        
        AIDEV-NOTE: Ported from SmolAgentsExecutionService.execute_task().
        Works directly with ExecutionContext - no TaskRequest conversion.
        """
        logger.info(f"Executing task with context: {context.mode.value}")
        
        start_time = time.time()
        context_id = self._generate_context_id(context)
        
        try:
            # Yield initial progress
            yield {
                "status": "in_progress",
                "step_id": "setup",
                "step_type": "SETUP",
                "output": {"message": "Setting up execution"},
                "error_message": "",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 10.0
            }
            
            # Handle instruction-based execution (direct tool execution)
            if context.is_instruction_mode:
                yield {
                    "status": "in_progress",
                    "step_id": "direct_execution",
                    "step_type": "TOOL_EXECUTION",
                    "output": {"message": "Using direct tool execution"},
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 30.0
                }
                
                # Create direct tool execution agent
                agent = await self._create_direct_execution_agent(context)
                
                # Execute instructions directly
                result = agent.run(context.instructions)
                
                yield {
                    "status": "completed",
                    "step_id": "direct_execution",
                    "step_type": "TOOL_EXECUTION",
                    "output": {"result": str(result)},
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0
                }
                
                return
            
            # Handle capability-based execution
            if context.is_capability_mode:
                # Create capability from context (would come from domain routing service)
                capability = self._create_capability_from_context(context)
                
                yield {
                    "status": "in_progress",
                    "step_id": "capability_setup",
                    "step_type": "SETUP",
                    "output": {"capability": capability.name, "steps": len(capability.steps)},
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 20.0
                }
                
                # Create smolagents agent for this capability
                smolagents_agent = await self._create_capability_agent(capability, context_id)
                
                # Execute each step with progress updates
                total_steps = len(capability.steps)
                for i, step in enumerate(capability.steps):
                    step_progress = 30.0 + (60.0 * i / total_steps)
                    
                    yield {
                        "status": "in_progress",
                        "step_id": step.id,
                        "step_type": step.type.name,
                        "output": {"message": f"Executing step: {step.instructions[:100]}"},
                        "error_message": "",
                        "timestamp_ms": int(time.time() * 1000),
                        "progress_percent": step_progress
                    }
                    
                    # Execute step
                    result = smolagents_agent.run(step.instructions)
                    
                    yield {
                        "status": "in_progress",
                        "step_id": step.id,
                        "step_type": step.type.name,
                        "output": {"result": str(result)},
                        "error_message": "",
                        "timestamp_ms": int(time.time() * 1000),
                        "progress_percent": 30.0 + (60.0 * (i + 1) / total_steps)
                    }
                
                # Final completion
                duration_ms = int((time.time() - start_time) * 1000)
                yield {
                    "status": "completed",
                    "step_id": "completed",
                    "step_type": "COMPLETION",
                    "output": {
                        "message": "Task completed successfully",
                        "duration_ms": duration_ms,
                        "capability": capability.name
                    },
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0
                }
            
        except Exception as e:
            logger.exception(f"SmolAgents execution failed: {e}")
            yield {
                "status": "failed",
                "step_id": "error",
                "step_type": "ERROR",
                "output": {"error": str(e)},
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0
            }
        
        finally:
            # Clean up cached agent
            if context_id in self.agent_cache:
                del self.agent_cache[context_id]
    
    async def validate_execution_context(self, context: ExecutionContext) -> bool:
        """Validate that execution context is valid."""
        try:
            if not context.instructions:
                return False
            
            if context.max_steps and context.max_steps <= 0:
                return False
            
            if context.timeout_seconds and context.timeout_seconds <= 0:
                return False
            
            return True
        except Exception:
            return False
    
    async def get_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        return self.tool_registry_repository.list_available_tools()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of execution system."""
        try:
            available_tools = await self.get_available_tools()
            return {
                "status": "healthy",
                "available_tools_count": len(available_tools),
                "service": "smolagents",
                "initialized": True
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "service": "smolagents",
                "initialized": False
            }
    
    def _generate_context_id(self, context: ExecutionContext) -> str:
        """Generate unique ID for execution context."""
        return f"ctx_{hash(context.instructions + str(context.available_tools)) % 10000}"
    
    def _create_capability_from_context(self, context: ExecutionContext) -> CapabilityConfig:
        """Create capability configuration from execution context."""
        # Create tool configs with enhanced context for Pipedream tools
        tool_configs = self._create_tool_configs_with_context(context.available_tools, context)
        
        # Create single step capability
        step = StepConfig(
            id="execution_step",
            type=StepType.TOOL_STEP if tool_configs else StepType.CODE_STEP,
            instructions=context.instructions,
            model="Qwen/Qwen2.5-14B-Instruct",  # AIDEV-NOTE: Will be replaced by model provider in step agent creation
            tools=tool_configs,
            servers=[]
        )
        
        return CapabilityConfig(
            name=context.capability_name or "dynamic_capability",
            description=f"Generated capability: {context.instructions[:100]}...",
            steps=[step]
        )
    
    async def _create_direct_execution_agent(self, context: ExecutionContext) -> Union[CodeAgent, ToolCallingAgent]:
        """
        Create agent for direct tool execution.
        
        AIDEV-NOTE: Updated to use centralized model provider instead of hardcoded model creation.
        Updated to pass agent API key and environment context to Pipedream tools.
        """
        # Load tools from context with enhanced configuration for Pipedream tools
        tools = []
        if context.available_tools:
            tool_configs = self._create_tool_configs_with_context(context.available_tools, context)
            tools = self.tool_registry_repository.load_tools(tool_configs)
        
        # Get appropriate model from simplified provider
        model = self.model_provider.get_model('tool_calling')
        
        agent = ToolCallingAgent(
            tools=tools,
            model=model,
            max_steps=10
        )
        
        agent.name = "direct_executor"
        agent.description = "Direct tool execution agent"
        
        return agent
    
    async def _create_capability_agent(self, capability: CapabilityConfig, context_id: str) -> CodeAgent:
        """
        Create smolagents agent from capability configuration.
        
        AIDEV-NOTE: Updated to use centralized model provider instead of hardcoded model creation.
        """
        if context_id in self.agent_cache:
            return self.agent_cache[context_id]
        
        # Create step agents for this capability
        step_agents = []
        for step in capability.steps:
            step_agent = await self._create_step_agent(step)
            step_agent.name = step.id
            step_agent.description = step.instructions
            step_agents.append(step_agent)
        
        # Create capability-level agent that manages step agents
        model = self.model_provider.get_model('default')
        
        capability_agent = CodeAgent(
            tools=[],  # Capability agent delegates to step agents
            model=model,
            managed_agents=step_agents,
            additional_authorized_imports=["time", "json", "os", "sys"]
        )
        
        capability_agent.name = capability.name
        capability_agent.description = capability.description
        
        self.agent_cache[context_id] = capability_agent
        return capability_agent
    
    def _create_tool_configs_with_context(self, tool_names: List[str], context: ExecutionContext) -> List[ToolConfig]:
        """
        Create tool configurations with enhanced context for Pipedream tools.
        
        AIDEV-NOTE: Passes agent API key and environment context to tools that require it.
        Uses Value Objects from execution context for type safety.
        """
        tool_configs = []
        
        for tool_name in tool_names:
            config = {}
            
            # Check if this is a Pipedream tool (they use underscores in registry)
            is_pipedream_tool = any(tool_name.startswith(prefix) for prefix in [
                "gmail_", "slack_", "github_", "google_", "notion_", "trello_", 
                "discord_", "linear_", "dropbox_", "airtable_", "hubspot_"
            ])
            
            if is_pipedream_tool:
                # Extract agent API key from context environment
                agent_api_key = context.environment.get("agent_api_key")
                base_url = context.environment.get("base_url", os.getenv("NEXTJS_BASE_URL", "http://localhost:3000"))
                
                if agent_api_key:
                    config = {
                        "agent_api_key": agent_api_key,  # Already a Value Object from context
                        "base_url": base_url
                    }
                    logger.info(f"[EXECUTION] Configured Pipedream tool {tool_name} with API key context")
                else:
                    logger.warning(f"[EXECUTION] Pipedream tool {tool_name} missing agent_api_key in context")
            
            tool_configs.append(ToolConfig(
                name=tool_name,
                version="1.0",
                config=config
            ))
        
        return tool_configs
    
    async def _create_step_agent(self, step: StepConfig) -> Union[CodeAgent, ToolCallingAgent]:
        """
        Create step-level agent based on step type.
        
        AIDEV-NOTE: Updated to use centralized model provider with proper step type routing.
        """
        # Get appropriate model using simplified provider
        if step.model:
            # Use custom model if specified (would need to extend provider for this)
            model = self.model_provider.get_model('default')
        else:
            # Use tool_calling for TOOL_STEP, default for others
            model_type = 'tool_calling' if step.type.name == 'TOOL_STEP' else 'default'
            model = self.model_provider.get_model(model_type)
        
        # Load tools for this step - tools already have enhanced config from capability creation
        step_tools = []
        if hasattr(step, 'tools') and step.tools:
            try:
                step_tools = self.tool_registry_repository.load_tools(step.tools)
            except Exception as e:
                logger.warning(f"Failed to load some tools for step {step.id}: {e}")
        
        if step.type == StepType.CODE_STEP:
            return CodeAgent(
                tools=step_tools,
                model=model,
                additional_authorized_imports=["time", "json", "os", "sys"]
            )
        else:
            return ToolCallingAgent(
                tools=step_tools,
                model=model
            )
    
    def clear_cache(self):
        """Clear cached agents (useful for testing)."""
        self.agent_cache.clear()