"""
Agent Executor Service (Simplified)

Merged routing + execution logic without DDD interfaces.
Combines CapabilityRoutingService + SmolAgentsExecutionRepository.
"""

import logging
import os
import time
import json
from typing import Dict, Any, List, Optional, Union, AsyncIterator

from smolagents import CodeAgent, ToolCallingAgent

from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode, AgentId, OrganizationId
from ..grpc.generated.agent_worker_pb2 import TaskRequest, SkillConfig, ToolConfig, TokenUsage as TokenUsageProto
from .model_provider import SmolagentsModelProvider
from .tool_loader import UnifiedToolLoader

logger = logging.getLogger(__name__)


class AgentExecutor:
    """
    Agent execution service combining routing and execution logic.

    Simplified from DDD pattern - no interfaces, direct dependencies.
    """

    def __init__(
        self,
        model_provider: Optional[SmolagentsModelProvider] = None,
        tool_loader: Optional[UnifiedToolLoader] = None
    ):
        """Initialize with optional dependencies (creates defaults if not provided)."""
        self.model_provider = model_provider or SmolagentsModelProvider()
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self.agent_cache: Dict[str, Union[CodeAgent, ToolCallingAgent]] = {}
        logger.info("AgentExecutor initialized")

    def _extract_token_usage(self, result) -> Optional[TokenUsageProto]:
        """
        Extract token usage from agent execution result.

        Args:
            result: RunResult object from smolagents agent.run()

        Returns:
            TokenUsageProto if token usage data exists, None otherwise
        """
        if not hasattr(result, 'token_usage') or not result.token_usage:
            logger.debug("No token_usage found in result")
            return None

        tu = result.token_usage
        logger.info(f"Extracted token usage: {getattr(tu, 'total_tokens', 0)} tokens, ${getattr(tu, 'cost_usd', 0.0):.6f}")

        return TokenUsageProto(
            model_name=getattr(tu, 'model_name', ''),
            input_tokens=getattr(tu, 'input_tokens', 0),
            output_tokens=getattr(tu, 'output_tokens', 0),
            total_tokens=getattr(tu, 'total_tokens', 0),
            cost_usd=getattr(tu, 'cost_usd', 0.0)
        )

    # =========================================================================
    # Routing Logic (from CapabilityRoutingService)
    # =========================================================================

    def determine_execution_context(self, request: TaskRequest) -> ExecutionContext:
        """
        Determine execution context from TaskRequest.

        Args:
            request: TaskRequest from protobuf with either skill_name or instruction_config

        Returns:
            ExecutionContext for task execution

        Raises:
            ValueError: If no valid execution mode specified
        """
        if request.skill_name:
            return self._create_skill_context(request)
        elif request.instruction_config:
            return self._create_instruction_context(request)
        else:
            raise ValueError("TaskRequest must specify either skill_name or instruction_config")

    def _create_skill_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for skill-based execution."""
        # Find skill in agent config
        skill = self._find_skill_by_name(request.agent_config.skills, request.skill_name)

        if not skill:
            raise ValueError(f"Skill '{request.skill_name}' not found in agent configuration")

        # Extract tool names from skill's tools list
        tool_names = [tool.name for tool in skill.tools] if skill.tools else []

        # Extract model overrides
        skill_model = skill.model if hasattr(skill, 'model') and skill.model else None
        agent_model = request.agent_config.default_model if hasattr(request.agent_config, 'default_model') else None
        org_model = request.organization_model if hasattr(request, 'organization_model') else None

        return ExecutionContext(
            mode=ExecutionMode.SKILL,
            instructions=skill.instructions,
            available_tools=tool_names,
            agent_id=request.agent_id if hasattr(request, 'agent_id') else None,
            organization_id=request.organization_id if hasattr(request, 'organization_id') else None,
            skill_name=request.skill_name,
            skill=skill,
            agent_model=agent_model,
            org_model=org_model,
            environment={}
        )

    def _create_instruction_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for instruction-based execution."""
        instruction_config = request.instruction_config

        # Extract tool names from instruction config
        tool_names = []
        if hasattr(instruction_config, 'tools') and instruction_config.tools:
            tool_names = [tool.name for tool in instruction_config.tools]

        # Extract model overrides
        instruction_model = instruction_config.model if hasattr(instruction_config, 'model') and instruction_config.model else None
        agent_model = request.agent_config.default_model if hasattr(request.agent_config, 'default_model') else None
        org_model = request.organization_model if hasattr(request, 'organization_model') else None

        return ExecutionContext(
            mode=ExecutionMode.INSTRUCTION,
            instructions=instruction_config.instructions,
            available_tools=tool_names,
            agent_id=request.agent_id if hasattr(request, 'agent_id') else None,
            organization_id=request.organization_id if hasattr(request, 'organization_id') else None,
            skill_name=None,
            agent_model=agent_model or instruction_model,  # Prefer instruction model for direct execution
            org_model=org_model,
            environment={}
        )

    def _find_skill_by_name(self, skills: List[SkillConfig], skill_name: str) -> Optional[SkillConfig]:
        """Find specific skill by name in agent skills."""
        for skill in skills:
            if skill.name == skill_name:
                return skill
        return None

    # =========================================================================
    # Execution Logic (from SmolAgentsExecutionRepository)
    # =========================================================================

    async def execute_task(self, context: ExecutionContext) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute a task with given execution context.

        Yields progress updates as task executes.

        Args:
            context: ExecutionContext with mode, instructions, tools, etc.

        Yields:
            Dict with status, output, progress updates
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

                # Extract token usage from result
                token_usage_proto = self._extract_token_usage(result)

                yield {
                    "status": "completed",
                    "output": json.dumps({"result": str(result.output) if hasattr(result, 'output') else str(result)}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0,
                    "token_usage": token_usage_proto
                }

                return

            # Handle skill-based execution
            if context.is_skill_mode:
                if not context.skill:
                    error_msg = f"Skill-based execution requires context.skill to be set. Got skill_name='{context.skill_name}' but no skill object."
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                skill = context.skill
                tool_count = len(skill.tools) if skill.tools else 0
                logger.info(f"Using skill '{skill.name}' with {tool_count} tools")

                yield {
                    "status": "in_progress",
                    "output": json.dumps({"skill": skill.name, "tools": tool_count}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 20.0
                }

                # Create smolagents agent for this skill
                agent = await self._create_skill_agent(skill, context, context_id)

                # Execute the skill instructions
                yield {
                    "status": "in_progress",
                    "output": json.dumps({"message": f"Executing: {skill.instructions[:100]}..."}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 50.0
                }

                # Execute skill instructions directly
                result = agent.run(skill.instructions)

                # Extract token usage from result
                token_usage_proto = self._extract_token_usage(result)

                # Final completion
                duration_ms = int((time.time() - start_time) * 1000)
                yield {
                    "status": "completed",
                    "output": json.dumps({
                        "result": str(result.output) if hasattr(result, 'output') else str(result),
                        "message": "Task completed successfully",
                        "duration_ms": duration_ms,
                        "skill": skill.name
                    }),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0,
                    "token_usage": token_usage_proto
                }

        except Exception as e:
            logger.exception(f"Agent execution failed: {e}")
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

    async def _create_direct_execution_agent(
        self,
        context: ExecutionContext
    ) -> Union[CodeAgent, ToolCallingAgent]:
        """Create agent for direct tool execution."""
        # Load tools from context
        tools = []
        if context.available_tools:
            tool_configs = self._create_tool_configs_with_context(context.available_tools, context)
            tools = self.tool_loader.load_tools(tool_configs)

        # Resolve model using hierarchy: agent_model → org_model → system default
        model_id = self.model_provider.resolve_model_selection(
            agent_model=context.agent_model,
            org_model=context.org_model
        )
        model = self.model_provider.get_model(model_id)

        agent = ToolCallingAgent(
            tools=tools,
            model=model,
            max_steps=context.max_steps
        )

        agent.name = "direct_executor"
        agent.description = "Direct tool execution agent"

        return agent

    async def _create_skill_agent(
        self,
        skill: SkillConfig,
        context: ExecutionContext,
        context_id: str
    ) -> Union[CodeAgent, ToolCallingAgent]:
        """Create smolagents agent from skill configuration."""
        if context_id in self.agent_cache:
            return self.agent_cache[context_id]

        # Load tools for this skill
        tools = []
        if skill.tools:
            try:
                tools = self.tool_loader.load_tools(skill.tools)
                logger.info(f"Loaded {len(tools)} tools for skill '{skill.name}'")
            except Exception as e:
                logger.warning(f"Failed to load some tools for skill {skill.name}: {e}")

        # Resolve model using hierarchy: skill_model → agent_model → org_model → system default
        skill_model = skill.model if hasattr(skill, 'model') and skill.model else None
        model_id = self.model_provider.resolve_model_selection(
            skill_model=skill_model,
            agent_model=context.agent_model,
            org_model=context.org_model
        )
        model = self.model_provider.get_model(model_id)

        # Create ToolCallingAgent if we have tools, otherwise CodeAgent
        if tools:
            agent = ToolCallingAgent(
                tools=tools,
                model=model,
                max_steps=context.max_steps
            )
        else:
            agent = CodeAgent(
                tools=[],
                model=model,
                additional_authorized_imports=["time", "json", "os", "sys"]
            )

        agent.name = skill.name
        agent.description = skill.description

        self.agent_cache[context_id] = agent
        return agent

    def _create_tool_configs_with_context(
        self,
        tool_names: List[str],
        context: ExecutionContext
    ) -> List[ToolConfig]:
        """Create tool configurations with enhanced context for Pipedream tools."""
        tool_configs = []

        for tool_name in tool_names:
            config = {}

            # Check if this is a Pipedream tool
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
                        "api_key": api_key,
                        "base_url": base_url,
                        "api_key_mode": "agent"
                    }
                    logger.info(f"Configured Pipedream tool {tool_name} with API key context")
                else:
                    logger.warning(f"Pipedream tool {tool_name} missing api_key in context")

            tool_configs.append(ToolConfig(
                name=tool_name,
                version="1.0",
                config=config
            ))

        return tool_configs

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _generate_context_id(self, context: ExecutionContext) -> str:
        """Generate unique ID for execution context."""
        return f"ctx_{hash(context.instructions + str(context.available_tools)) % 10000}"

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
        return self.tool_loader.list_available_tools()

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

    def clear_cache(self):
        """Clear cached agents (useful for testing)."""
        self.agent_cache.clear()
