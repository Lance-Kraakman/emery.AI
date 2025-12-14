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
import threading
import uuid
from typing import Dict, Any, List, Optional, Union, AsyncIterator

import httpx

from smolagents import CodeAgent, ToolCallingAgent
from PIL import Image

from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode, AgentId, OrganizationId
from ..grpc.generated.agent_worker_pb2 import SkillConfig, ToolConfig, TokenUsage as TokenUsageProto, ImageAttachment
from ..entities.task import TaskRequest
from .model_provider import SmolagentsModelProvider
from .tool_loader import UnifiedToolLoader
from .image_processor import ImageProcessor
from .agent_factory import AgentFactory, AgentConfig
from .token_usage_extractor import TokenUsageExtractor
from ..tools.skill_tool import SkillTool
from ..clients import HuggingFaceInferenceClient, TaskResult
from ..entities.output_mapping import (
    OutputMappingConfig, FieldMapping, OutputMappingMode, RowAction,
    extract_field_value, build_row_data, get_extension_for_mime
)

logger = logging.getLogger(__name__)


class AgentExecutor:
    """
    Agent execution service combining routing and execution logic.

    Simplified from DDD pattern - no interfaces, direct dependencies.

    AIDEV-NOTE: Thread-local context storage allows SkillTool to access parent
    context (images, attachments) when invoked from an agent. This enables
    Direct mode skills to receive image/audio inputs from chat attachments.
    """

    # Thread-local storage for execution context
    # Allows SkillTool.forward() to access parent context for injecting images/audio
    _context_local = threading.local()

    @classmethod
    def set_current_context(cls, context: Optional[ExecutionContext]) -> None:
        """Store execution context for skill access in current thread."""
        cls._context_local.context = context

    @classmethod
    def get_current_context(cls) -> Optional[ExecutionContext]:
        """Get execution context for current thread (used by SkillTool)."""
        return getattr(cls._context_local, 'context', None)

    def __init__(
        self,
        model_provider: Optional[SmolagentsModelProvider] = None,
        tool_loader: Optional[UnifiedToolLoader] = None,
        agent_factory: Optional[AgentFactory] = None,
        inference_client: Optional[HuggingFaceInferenceClient] = None
    ):
        """Initialize with optional dependencies (creates defaults if not provided)."""
        self.model_provider = model_provider or SmolagentsModelProvider()
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self.agent_factory = agent_factory or AgentFactory(self.model_provider)
        # Inference client for direct operation execution (lazy initialization)
        self._inference_client = inference_client
        # Agent cache now managed by AgentFactory
        logger.info("AgentExecutor initialized with shared utilities")

    def _extract_token_usage(self, result) -> Optional[TokenUsageProto]:
        """Extract token usage using consolidated TokenUsageExtractor."""
        return TokenUsageExtractor.extract_from_result(result)

    async def _download_images(self, image_attachments: List[ImageAttachment]) -> List[Image.Image]:
        """Download images using consolidated ImageProcessor."""
        return await ImageProcessor.download_images_from_attachments(image_attachments)

    def _get_inference_client(self) -> HuggingFaceInferenceClient:
        """Get or create the inference client (lazy initialization)."""
        if self._inference_client is None:
            self._inference_client = HuggingFaceInferenceClient()
        return self._inference_client

    def _is_operation_skill(self, skill: SkillConfig) -> bool:
        """
        Check if skill uses operation execution (bypasses LLM orchestration).

        Operation skills call inference APIs directly for single-task models:
        - text-to-image, speech-to-text, feature-extraction, etc.
        """
        # SkillConfig is a protobuf - execution_type field is always present (empty string if not set)
        return skill.execution_type == 'operation'

    def _extract_runtime_inputs(self, context: ExecutionContext) -> Dict[str, Any]:
        """
        Extract runtime inputs from execution context for direct skill execution.

        Maps skill inputs from context to a dictionary for inference client.
        """
        inputs = {}

        # For now, extract from the task text (skill instructions with injected inputs)
        # TODO: Parse structured inputs from context once frontend sends them
        if context.task:
            inputs['prompt'] = context.task
            inputs['text'] = context.task

        # Extract image inputs from context
        if context.images:
            # For image-based tasks, include first image
            # TODO: Handle multiple images if needed
            inputs['images'] = context.images

        # Extract audio inputs from attachments
        # FileAttachment is a protobuf - mime_type field is always present
        for attachment in context.attachments:
            if attachment.mime_type and attachment.mime_type.startswith('audio/'):
                inputs['audio'] = attachment

        return inputs

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
        if not request.skill_name:
            raise ValueError("Skill name is required for skill-based execution")
        skill = self._find_skill_by_name(list(request.agent_config.skills), request.skill_name)

        if not skill:
            raise ValueError(f"Skill '{request.skill_name}' not found in agent configuration")

        # Extract api_key from skill's tool configs (for output mappings)
        api_key = self._extract_api_key_from_tools(list(skill.tools)) if skill.tools else None

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

        # Get all available skills for delegation (excluding the current skill)
        all_skills = list(request.agent_config.skills) if hasattr(request.agent_config, 'skills') else []
        available_skills = [s for s in all_skills if s.name != request.skill_name]

        return ExecutionContext(
            mode=ExecutionMode.SKILL,
            task=skill.instructions,  # Changed from 'instructions'
            available_tools=tool_names,
            agent_id=request.agent_id if hasattr(request, 'agent_id') else None,
            organization_id=request.organization_id if hasattr(request, 'organization_id') else None,
            skill_name=request.skill_name,
            skill=skill,
            available_skills=available_skills,  # Skills that can be delegated to
            agent_model=agent_model,
            org_model=org_model,
            images=images,
            attachments=attachments,
            api_key=api_key,  # For output mappings
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

        # Store context in thread-local for SkillTool access
        # This allows skills to access images/audio from parent context
        self.set_current_context(context)

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
                    "output": json.dumps({"result": str(result)}),
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

                # Route: operation skills bypass LLM orchestration
                if self._is_operation_skill(skill):
                    logger.info(f"🎯 Operation skill '{skill.name}' - using direct execution")
                    async for progress in self._execute_direct_skill(context, start_time):
                        yield progress
                    return

                # Standard agent execution (LLM orchestration via smolagents)
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
                        "result": str(result),
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
            # Always clean up thread-local context
            self.set_current_context(None)

    async def _execute_direct_skill(
        self,
        context: ExecutionContext,
        start_time: float
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute skill directly without LLM orchestration.

        Uses the model specified in taskModelConfig to perform a single task:
        - text-to-image: Generate image from prompt
        - speech-to-text: Transcribe audio
        - feature-extraction: Generate embeddings
        - etc.

        Args:
            context: ExecutionContext with skill configuration
            start_time: Task start time for duration calculation

        Yields:
            Dict with status, output, progress updates
        """
        skill = context.skill
        task_config = skill.task_model_config

        if not task_config:
            raise ValueError(f"Operation skill '{skill.name}' missing task_model_config")

        model_id = task_config.model_id
        task_type = task_config.task_type

        # Convert protobuf map to dict for parameters
        parameters = dict(task_config.parameters) if task_config.parameters else {}

        logger.info(f"🚀 Direct skill execution: {skill.name}")
        logger.info(f"   Model: {model_id}, Task: {task_type}")

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "skill": skill.name,
                "model": model_id,
                "task_type": task_type,
                "message": "Starting direct model execution"
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 20.0
        }

        # Get inference client
        client = self._get_inference_client()

        # Verify task type is supported
        if not client.supports_task_type(task_type):
            raise ValueError(
                f"Task type '{task_type}' not supported. "
                f"Supported: {client.supported_task_types}"
            )

        # Extract runtime inputs from context
        runtime_inputs = self._extract_runtime_inputs(context)

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "message": f"Executing {task_type}...",
                "inputs_count": len(runtime_inputs)
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 50.0
        }

        # Execute the task
        result: TaskResult = await client.execute_task(
            model_id=model_id,
            task_type=task_type,
            inputs=runtime_inputs,
            parameters=parameters
        )

        # Apply output mappings if configured
        await self._apply_output_mappings_for_skill(
            skill=skill,
            result=result,
            api_key=context.api_key,
            organization_id=context.organization_id
        )

        # Build output based on result type
        output_data = self._build_task_result_output(result, skill.name)

        # Final completion
        duration_ms = int((time.time() - start_time) * 1000)
        yield {
            "status": "completed",
            "output": json.dumps(output_data),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 100.0,
            "duration_ms": duration_ms,
            # Include binary data for image/audio results
            "binary_data": result.data if result.is_binary else None,
            "result_type": result.type.value,
            "metadata": result.metadata
        }

    def _build_task_result_output(self, result: TaskResult, skill_name: str) -> Dict[str, Any]:
        """Build output dict from TaskResult for progress response."""
        output: Dict[str, Any] = {
            "skill": skill_name,
            "result_type": result.type.value,
            "message": "Task completed successfully"
        }

        if result.is_text:
            output["result"] = str(result.data)
        elif result.is_structured:
            output["result"] = result.data  # Already list or dict
        elif result.is_binary:
            # For binary data (image/audio), include metadata only
            # Actual binary data is passed separately in the progress dict
            data_bytes = result.data if isinstance(result.data, bytes) else b""
            output["result"] = f"Binary data: {len(data_bytes)} bytes"
            if result.metadata:
                output.update(result.metadata)

        return output

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
            enable_caching=False,
            agent_type="skill_executor",
            context_type="autonomous"
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
                tools = self.tool_loader.load_tools(list(skill.tools))
                logger.info(f"Loaded {len(tools)} tools for skill '{skill.name}'")
            except Exception as e:
                logger.warning(f"Failed to load some tools for skill {skill.name}: {e}")

        # Load available skills as SkillTools for delegation
        if context.available_skills:
            skill_tools = self._create_skill_tools(
                context.available_skills,
                context.org_model,
                api_key=context.api_key,
                organization_id=context.organization_id
            )
            tools.extend(skill_tools)
            logger.info(f"Added {len(skill_tools)} skills as tools for delegation")

        # Extract skill model and agent type if present
        skill_model = skill.model if hasattr(skill, 'model') and skill.model else None
        skill_agent_type = skill.agent_type if hasattr(skill, 'agent_type') and skill.agent_type else None

        # Create agent using AgentFactory with autonomous context
        agent_config = AgentConfig(
            tools=tools,
            skill_model=skill_model,
            agent_model=context.agent_model,
            org_model=context.org_model,
            max_steps=context.max_steps,
            agent_name=skill.name,
            agent_description=skill.description,
            enable_caching=False,  # Tasks are stateless - no caching
            agent_type="skill_executor",
            context_type="autonomous",
            skill_agent_type=skill_agent_type  # "tool_calling" (default) or "code_agent"
        )

        return self.agent_factory.create_agent(agent_config)

    def _create_skill_tools(
        self,
        skills: List[SkillConfig],
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> List[SkillTool]:
        """
        Create SkillTool instances for each skill.

        These allow the agent to delegate work to other skills.
        For operation skills, passes the inference client for direct execution.

        Args:
            skills: List of SkillConfig objects to wrap as tools
            org_model: Organization default model (used as fallback)
            api_key: Optional API key for output mapping (calls emery-api)
            organization_id: Optional org ID for output mapping (RLS context)

        Returns:
            List of SkillTool instances
        """
        skill_tools = []

        # Check if any skills need inference client
        # SkillConfig is a protobuf - execution_type field is always present
        has_operation_skills = any(
            s.execution_type == 'operation'
            for s in skills
        )
        inference_client = self._get_inference_client() if has_operation_skills else None

        for skill_config in skills:
            try:
                # Create executor callback for this skill
                skill_tool = SkillTool(
                    skill_config=skill_config,
                    skill_executor=self._create_skill_executor(org_model),
                    inference_client=inference_client,
                    api_key=api_key,
                    organization_id=organization_id
                )
                skill_tools.append(skill_tool)
                logger.debug(f"Created SkillTool for: {skill_config.name}")
            except Exception as e:
                logger.warning(f"Failed to create SkillTool for {skill_config.name}: {e}")

        return skill_tools

    def _create_skill_executor(self, org_model: Optional[str] = None):
        """
        Create an executor callback for skill tools.

        Args:
            org_model: Organization default model

        Returns:
            Callable that executes a skill and returns result string
        """
        def execute_skill(skill_config: SkillConfig, runtime_inputs: Dict[str, Any]) -> str:
            """Execute a skill synchronously (for task execution)."""
            logger.info(f"🎯 Task executing skill: {skill_config.name}")

            try:
                # Load skill's tools
                skill_tools = []
                if skill_config.tools:
                    skill_tools = self.tool_loader.load_tools(list(skill_config.tools))

                # Build task from instructions + inputs
                task_parts = [skill_config.instructions]
                if runtime_inputs:
                    task_parts.append("\n## Inputs:")
                    for key, value in runtime_inputs.items():
                        task_parts.append(f"- {key}: {value}")
                task = "\n".join(task_parts)

                # Create sub-agent with skill context from template
                skill_model = skill_config.model if hasattr(skill_config, 'model') and skill_config.model else None
                skill_agent_type = skill_config.agent_type if hasattr(skill_config, 'agent_type') and skill_config.agent_type else None
                agent_config = AgentConfig(
                    tools=skill_tools,
                    skill_model=skill_model,
                    org_model=org_model,
                    max_steps=10,
                    agent_name=f"skill_{skill_config.name}",
                    agent_description=skill_config.description,
                    enable_caching=False,
                    agent_type="skill_executor",
                    context_type="autonomous",
                    skill_agent_type=skill_agent_type  # "tool_calling" (default) or "code_agent"
                )
                sub_agent = self.agent_factory.create_agent(agent_config)

                # Execute
                result = sub_agent.run(task=task, reset=True)
                logger.info(f"✅ Task skill {skill_config.name} completed")
                return str(result)

            except Exception as e:
                error_msg = f"Skill execution failed: {str(e)}"
                logger.error(f"❌ Task skill {skill_config.name} failed: {e}")
                return error_msg

        return execute_skill

    # Note: _create_tool_configs_with_context removed - now using tool_loader.create_tool_configs_with_context()

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _extract_api_key_from_tools(self, tools: List[ToolConfig]) -> Optional[str]:
        """Extract user API key from tool configs (for output mappings)."""
        for tool in tools:
            if hasattr(tool, 'config') and tool.config:
                config = dict(tool.config) if hasattr(tool.config, 'items') else tool.config
                api_key = config.get('api_key')
                if api_key and (api_key.startswith('user_') or api_key.startswith('agent_')):
                    return api_key
        return None

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
        return self.tool_loader.get_available_tools()

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

    # =========================================================================
    # Output Mapping Methods (for direct skill execution)
    # =========================================================================

    async def _apply_output_mappings_for_skill(
        self,
        skill: SkillConfig,
        result: TaskResult,
        api_key: Optional[str],
        organization_id: Optional[str],
        source_row_id: Optional[str] = None
    ) -> None:
        """
        Apply output mappings to save skill results to tables.

        Supports two modes:
        - single_row: Map to one row (classification - top result)
        - multi_row: Create row per array item (object detection)

        Args:
            skill: SkillConfig with output definitions
            result: The TaskResult from inference execution
            api_key: API key for authenticated calls
            organization_id: Organization ID for RLS context
            source_row_id: Optional source row ID for linking back
        """
        # Check if we have auth for API calls
        if not api_key or not organization_id:
            logger.warning("📊 Output mapping skipped: missing api_key or organization_id")
            return

        # Get outputs with mappings (new structure uses output_mapping)
        outputs_with_mappings = [
            output for output in skill.outputs
            if output.HasField('output_mapping') and len(output.output_mapping.mappings) > 0
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info(f"📊 Applying {len(outputs_with_mappings)} output mappings")

        # Get API base URL
        nextjs_base = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
        api_base_url = f"{nextjs_base}/api"

        # Build context for field extraction (source row info for linking)
        context = {'source': {'rowId': source_row_id}} if source_row_id else None

        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "X-Organization-ID": str(organization_id),
                "Content-Type": "application/json"
            }

            for output in outputs_with_mappings:
                try:
                    config = OutputMappingConfig.from_proto(output.output_mapping)
                    await self._apply_output_mapping(
                        client, config, result, headers, api_base_url, context
                    )
                except Exception as e:
                    logger.error(f"❌ Failed to apply output mapping for {output.name}: {e}")

    async def _apply_output_mapping(
        self,
        client: httpx.AsyncClient,
        config: OutputMappingConfig,
        result: TaskResult,
        headers: Dict[str, str],
        api_base_url: str,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Apply output mapping based on mode (single_row or multi_row)."""

        if config.is_single_row:
            await self._apply_single_row_mapping(client, config, result, headers, api_base_url, context)
        elif config.is_multi_row:
            await self._apply_multi_row_mapping(client, config, result, headers, api_base_url, context)
        else:
            logger.warning(f"Unknown mapping mode: {config.mode}")

    async def _apply_single_row_mapping(
        self,
        client: httpx.AsyncClient,
        config: OutputMappingConfig,
        result: TaskResult,
        headers: Dict[str, str],
        api_base_url: str,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Apply single-row mapping (e.g., classification top result)."""
        # Get the data item to extract from
        if result.is_structured and isinstance(result.data, list) and len(result.data) > 0:
            item = result.data[0]  # Take first item for single_row mode
        elif result.is_structured:
            item = result.data
        elif result.is_text:
            item = {'text': str(result.data)}
        else:
            logger.warning("Unsupported result type for single_row mapping")
            return

        # Build row data from mappings
        row_data = build_row_data(item, config.mappings, context)

        if not row_data:
            logger.warning("No data extracted from mappings")
            return

        table_id = config.get_target_table_id()
        if not table_id:
            logger.warning("No target table ID found in mappings")
            return

        url = f"{api_base_url}/rows"

        if config.is_create:
            payload = {"tableId": table_id, "data": row_data}
            logger.info(f"📝 Creating row in table {table_id} with {len(row_data)} fields")
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.error(f"Failed to create row: {response.status_code} - {response.text[:200]}")
            else:
                logger.info(f"✅ Created row in table {table_id}")

        elif config.is_update and config.row_id:
            payload = {"tableId": table_id, "rowId": config.row_id, "data": row_data}
            logger.info(f"📝 Updating row {config.row_id} in table {table_id}")
            response = await client.put(url, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.error(f"Failed to update row: {response.status_code} - {response.text[:200]}")
            else:
                logger.info(f"✅ Updated row {config.row_id}")

    async def _apply_multi_row_mapping(
        self,
        client: httpx.AsyncClient,
        config: OutputMappingConfig,
        result: TaskResult,
        headers: Dict[str, str],
        api_base_url: str,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Apply multi-row mapping (e.g., object detection - one row per detection)."""
        # Get array of items to iterate
        if result.is_structured and isinstance(result.data, list):
            items = result.data
        elif result.is_structured:
            items = [result.data]
        else:
            logger.warning("Multi-row mapping requires structured array result")
            return

        table_id = config.get_target_table_id()
        if not table_id:
            logger.warning("No target table ID found in mappings")
            return

        url = f"{api_base_url}/rows"
        created_count = 0

        for item in items:
            row_data = build_row_data(item, config.mappings, context)
            if not row_data:
                continue

            payload = {"tableId": table_id, "data": row_data}
            try:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    logger.error(f"Failed to create row: {response.status_code}")
                else:
                    created_count += 1
            except Exception as e:
                logger.error(f"Error creating row: {e}")

        logger.info(f"✅ Created {created_count}/{len(items)} rows in table {table_id}")

    async def _upload_binary_to_s3(
        self,
        client: httpx.AsyncClient,
        result: TaskResult,
        output_name: str,
        api_key: str,
        organization_id: str,
        api_base_url: str
    ) -> Dict[str, Any]:
        """Upload binary result to S3 via the files upload API."""
        mime_type = result.metadata.get('mime_type', 'application/octet-stream')
        ext = get_extension_for_mime(mime_type)
        filename = f"{output_name}_{uuid.uuid4().hex[:8]}.{ext}"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "X-Organization-ID": str(organization_id)
        }

        url = f"{api_base_url}/files/upload"
        files = {'file': (filename, result.data, mime_type)}

        logger.info(f"📤 Uploading {len(result.data)} bytes to S3 as {filename}")

        response = await client.post(url, headers=headers, files=files)
        if response.status_code >= 400:
            logger.error(f"Failed to upload file: {response.status_code} - {response.text[:200]}")
            return {"error": f"Upload failed: {response.status_code}", "filename": filename, "size": len(result.data)}

        try:
            file_data = response.json()
            logger.info(f"✅ Uploaded file: {file_data.get('id', 'unknown')}")
            return file_data
        except Exception as e:
            logger.error(f"Failed to parse upload response: {e}")
            return {"error": str(e), "filename": filename}
