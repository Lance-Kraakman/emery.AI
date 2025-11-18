"""
Agent Executor Service (Simplified)

Merged routing + execution logic without DDD interfaces.
Combines CapabilityRoutingService + SmolAgentsExecutionRepository.

AIDEV-NOTE: Refactored to use shared utilities:
- ImageProcessor for image downloading
- AgentFactory for agent creation
- TokenUsageExtractor for token tracking
- UnifiedToolLoader enhanced methods
"""

import logging
import os
import time
import json
from typing import Dict, Any, List, Optional, Union, AsyncIterator

from smolagents import CodeAgent, ToolCallingAgent
from PIL import Image

from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode, AgentId, OrganizationId
from ..grpc.generated.agent_worker_pb2 import TaskRequest, SkillConfig, ToolConfig, TokenUsage as TokenUsageProto, ImageAttachment
from .model_provider import SmolagentsModelProvider
from .tool_loader import UnifiedToolLoader
from .image_processor import ImageProcessor
from .agent_factory import AgentFactory, AgentConfig
from .token_usage_extractor import TokenUsageExtractor

logger = logging.getLogger(__name__)


class AgentExecutor:
    """
    Agent execution service combining routing and execution logic.

    Simplified from DDD pattern - no interfaces, direct dependencies.
    """

    def __init__(
        self,
        model_provider: Optional[SmolagentsModelProvider] = None,
        tool_loader: Optional[UnifiedToolLoader] = None,
        agent_factory: Optional[AgentFactory] = None
    ):
        """Initialize with optional dependencies (creates defaults if not provided)."""
        self.model_provider = model_provider or SmolagentsModelProvider()
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self.agent_factory = agent_factory or AgentFactory(self.model_provider)
        # Agent cache now managed by AgentFactory
        logger.info("AgentExecutor initialized with shared utilities")

    def _extract_token_usage(self, result) -> Optional[TokenUsageProto]:
        """Extract token usage using consolidated TokenUsageExtractor."""
        return TokenUsageExtractor.extract_from_result(result)

    async def _download_images(self, image_attachments: List[ImageAttachment]) -> List[Image.Image]:
        """Download images using consolidated ImageProcessor."""
        return await ImageProcessor.download_images_from_attachments(image_attachments)

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
        # Priority: skill model > request agent model > config default model
        skill_model = skill.model if hasattr(skill, 'model') and skill.model else None

        # Read from request-level fields FIRST (set by frontend), then fallback to config
        agent_model = None
        if hasattr(request, 'agent_model') and request.agent_model:
            agent_model = request.agent_model
        elif hasattr(request.agent_config, 'default_model') and request.agent_config.default_model:
            agent_model = request.agent_config.default_model

        org_model = None
        if hasattr(request, 'organization_model') and request.organization_model:
            org_model = request.organization_model

        # Extract attachments from skill definition (skill-level attachments)
        skill_content = list(skill.content) if hasattr(skill, 'content') and skill.content else []

        # Extract runtime input attachments (passed during invocation)
        input_content = list(request.input_content) if hasattr(request, 'input_content') and request.input_content else []

        # Merge skill-level and runtime attachments
        all_content = skill_content + input_content

        # Separate images and files from MessageParts
        images = []
        attachments = []
        for part in all_content:
            if hasattr(part, 'image_url') and part.image_url:
                # Convert MessagePart.ImageUrlPart to ImageAttachment for compatibility
                from ..grpc.generated.agent_worker_pb2 import ImageAttachment
                img_attachment = ImageAttachment(url=part.image_url.url)
                images.append(img_attachment)
            elif hasattr(part, 'file') and part.file:
                # Files are already in the right format
                attachments.append(part.file)

        return ExecutionContext(
            mode=ExecutionMode.SKILL,
            task=skill.instructions,  # Changed from 'instructions'
            available_tools=tool_names,
            agent_id=request.agent_id if hasattr(request, 'agent_id') else None,
            organization_id=request.organization_id if hasattr(request, 'organization_id') else None,
            skill_name=request.skill_name,
            skill=skill,
            agent_model=agent_model,
            org_model=org_model,
            images=images,
            attachments=attachments,
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
        # Priority: instruction model > request agent model > config default model
        instruction_model = instruction_config.model if hasattr(instruction_config, 'model') and instruction_config.model else None

        # Read from request-level fields FIRST (set by frontend), then fallback to config
        agent_model = None
        if hasattr(request, 'agent_model') and request.agent_model:
            agent_model = request.agent_model
        elif hasattr(request.agent_config, 'default_model') and request.agent_config.default_model:
            agent_model = request.agent_config.default_model

        org_model = None
        if hasattr(request, 'organization_model') and request.organization_model:
            org_model = request.organization_model

        # Extract images and attachments (new multimodal support)
        images = list(instruction_config.images) if hasattr(instruction_config, 'images') and instruction_config.images else []
        attachments = list(instruction_config.attachments) if hasattr(instruction_config, 'attachments') and instruction_config.attachments else []

        return ExecutionContext(
            mode=ExecutionMode.INSTRUCTION,
            task=instruction_config.task,  # Changed from 'instructions'
            available_tools=tool_names,
            images=images,
            attachments=attachments,
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

                # Download images if any (multimodal support)
                pil_images = await self._download_images(context.images)

                yield {
                    "status": "in_progress",
                    "output": json.dumps({
                        "message": "Executing task",
                        "images_loaded": len(pil_images)
                    }),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 50.0
                }

                # Execute task with text + images (smolagents format)
                result = agent.run(task=context.task, images=pil_images or None, reset=False)

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
                agent = await self._create_skill_agent(skill, context)

                # Download images if any (multimodal support)
                pil_images = await self._download_images(context.images)

                # Execute the skill instructions
                yield {
                    "status": "in_progress",
                    "output": json.dumps({
                        "message": f"Executing: {context.task[:100]}...",
                        "images_loaded": len(pil_images)
                    }),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 50.0
                }

                # Execute task with text + images (smolagents format)
                result = agent.run(task=context.task, images=pil_images or None)

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

    async def _create_direct_execution_agent(
        self,
        context: ExecutionContext
    ) -> Union[CodeAgent, ToolCallingAgent]:
        """Create agent for direct tool execution using AgentFactory."""
        # Load tools from context using consolidated method
        tools = []
        if context.available_tools:
            tool_configs = self.tool_loader.create_tool_configs_with_context(
                context.available_tools,
                {"environment": context.environment}
            )
            tools = self.tool_loader.load_tools(tool_configs)

        # Create agent using AgentFactory
        agent_config = AgentConfig(
            tools=tools,
            agent_model=context.agent_model,
            org_model=context.org_model,
            max_steps=context.max_steps,
            agent_name="direct_executor",
            agent_description="Direct tool execution agent",
            enable_caching=False
        )

        return self.agent_factory.create_agent(agent_config)

    async def _create_skill_agent(
        self,
        skill: SkillConfig,
        context: ExecutionContext
    ) -> Union[CodeAgent, ToolCallingAgent]:
        """Create smolagents agent from skill configuration using AgentFactory."""

        # Load tools for this skill
        tools = []
        if skill.tools:
            try:
                tools = self.tool_loader.load_tools(skill.tools)
                logger.info(f"Loaded {len(tools)} tools for skill '{skill.name}'")
            except Exception as e:
                logger.warning(f"Failed to load some tools for skill {skill.name}: {e}")

        # Extract skill model if present
        skill_model = skill.model if hasattr(skill, 'model') and skill.model else None

        # Create agent using AgentFactory
        agent_config = AgentConfig(
            tools=tools,
            skill_model=skill_model,
            agent_model=context.agent_model,
            org_model=context.org_model,
            max_steps=context.max_steps,
            agent_name=skill.name,
            agent_description=skill.description,
            enable_caching=False  # Tasks are stateless - no caching
        )

        # Create ToolCallingAgent (AgentFactory always creates ToolCallingAgent)
        # Note: If CodeAgent is truly needed, this would need special handling
        return self.agent_factory.create_agent(agent_config)

    # Note: _create_tool_configs_with_context removed - now using tool_loader.create_tool_configs_with_context()

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def validate_execution_context(self, context: ExecutionContext) -> bool:
        """Validate that execution context is valid."""
        try:
            if not context.task:
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
        self.agent_factory.clear_cache()
