"""
Pure SmolAgents Execution Repository Implementation

AIDEV-NOTE: Pure DDD infrastructure implementation.
Simplified for single-instruction model - removed step iteration logic.
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
from ...core.entities import ToolConfig, SkillConfig

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
                "output": json.dumps({"message": "Setting up execution"}),
                "error_message": "",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 10.0
            }

            # Handle instruction-based execution (direct tool execution)
            if context.is_instruction_mode:
                yield {
                    "status": "in_progress",
                    "output": json.dumps({"message": "Using direct tool execution"}),
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
                    "output": json.dumps({"result": str(result)}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0
                }

                return
            
            # Handle capability-based execution (single-instruction model)
            if context.is_capability_mode:
                # AIDEV-NOTE: Capability MUST be provided in context for capability-based execution
                # Fail fast if capability is missing - don't create stub capability
                if not context.capability:
                    error_msg = f"Capability-based execution requires context.capability to be set. Got skill_name='{context.skill_name}' but no capability object."
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                capability = context.capability
                tool_count = len(capability.tools) if capability.tools else 0
                logger.info(f"Using capability '{capability.name}' with {tool_count} tools (single-instruction model)")

                yield {
                    "status": "in_progress",
                    "output": json.dumps({"capability": capability.name, "tools": tool_count}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 20.0
                }

                # Create smolagents agent for this capability (single instruction)
                smolagents_agent = await self._create_capability_agent(capability, context_id)

                # Execute the single instruction
                yield {
                    "status": "in_progress",
                    "output": json.dumps({"message": f"Executing: {capability.instructions[:100]}..."}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 50.0
                }

                # Execute capability instructions directly
                result = smolagents_agent.run(capability.instructions)

                # Final completion
                duration_ms = int((time.time() - start_time) * 1000)
                yield {
                    "status": "completed",
                    "output": json.dumps({
                        "result": str(result),
                        "message": "Task completed successfully",
                        "duration_ms": duration_ms,
                        "capability": capability.name
                    }),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0
                }
            
        except Exception as e:
            logger.exception(f"SmolAgents execution failed: {e}")
            yield {
                "status": "failed",
                "output": json.dumps({"error": str(e)}),
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
    
    async def _create_capability_agent(self, capability: SkillConfig, context_id: str) -> Union[CodeAgent, ToolCallingAgent]:
        """
        Create smolagents agent from skill configuration (single-instruction model).

        AIDEV-NOTE: Simplified for single-instruction model - no step agents, just direct tool execution.
        Uses centralized model provider.
        """
        if context_id in self.agent_cache:
            return self.agent_cache[context_id]

        # Load tools for this capability
        tools = []
        if capability.tools:
            try:
                tools = self.tool_registry_repository.load_tools(capability.tools)
                logger.info(f"Loaded {len(tools)} tools for capability '{capability.name}'")
            except Exception as e:
                logger.warning(f"Failed to load some tools for capability {capability.name}: {e}")

        # Get appropriate model from provider
        model = self.model_provider.get_model('tool_calling' if tools else 'default')

        # Create ToolCallingAgent if we have tools, otherwise CodeAgent
        if tools:
            capability_agent = ToolCallingAgent(
                tools=tools,
                model=model,
                max_steps=10
            )
        else:
            capability_agent = CodeAgent(
                tools=[],
                model=model,
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
                # Extract API key from context environment
                api_key = context.environment.get("api_key")
                base_url = context.environment.get("base_url", os.getenv("NEXTJS_BASE_URL", "http://localhost:3000"))

                if api_key:
                    config = {
                        "api_key": api_key,  # Already a Value Object from context
                        "base_url": base_url,
                        "api_key_mode": "agent"  # Agent execution uses agent mode
                    }
                    logger.info(f"[EXECUTION] Configured Pipedream tool {tool_name} with API key context")
                else:
                    logger.warning(f"[EXECUTION] Pipedream tool {tool_name} missing api_key in context")
            
            tool_configs.append(ToolConfig(
                name=tool_name,
                version="1.0",
                config=config
            ))
        
        return tool_configs

    def clear_cache(self):
        """Clear cached agents (useful for testing)."""
        self.agent_cache.clear()