"""Executes agent tasks with routing and tool loading.

AIDEV-NOTE: DSPy Migration - Uses ExecutorModule (dspy.ReAct) instead of
smolagents ToolCallingAgent. Agent execution now uses module.forward() pattern.
"""

from __future__ import annotations

import logging
import os
import time
import json
import uuid
from typing import TYPE_CHECKING, Any

import dspy
import httpx
from PIL import Image

from emery_agents.infrastructure.clients.base import TaskResult
from emery_agents.infrastructure.clients.huggingface_inference import HuggingFaceInferenceClient

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode, AgentId, OrganizationId
from ..grpc.generated.agent_worker_pb2 import SkillConfig, ToolConfig, TokenUsage as TokenUsageProto, ImageAttachment
from ..entities.task import TaskRequest
from .model_provider import ModelProvider
from .tool_loader import UnifiedToolLoader
from .image_processor import ImageProcessor
from .agent_factory import AgentFactory, AgentConfig
from .token_usage_extractor import TokenUsageExtractor
from ..reasoning.tools.execution import SkillTool, create_bash_tool
from ..reasoning.modules.extractor import OutputExtractorModule
# from ..infrastructure.clients import HuggingFaceInferenceClient, TaskResult
from .skill_executor import SkillExecutorService
from .step_executor import StepExecutorService
from .context_manager import (
    get_current_context as _get_context,
    set_current_context as _set_context,
    execution_scope as _execution_scope,
)
from ..entities.output_mapping import (
    OutputMappingConfig, FieldMapping, OutputMappingMode, RowAction,
    extract_field_value, get_extension_for_mime
)
from ..entities.task import SkillOutputValue
from .output_mapping_service import OutputMappingService, MappingContext
from .execution_coordinator import (
    ExecutionCoordinator,
    ExecutionCoordinatorFactory,
    PlanCreatedEvent,
    PlanApprovedEvent,
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    ExecutionCompletedEvent,
    EvaluationCompletedEvent,
    GoalAchievedEvent,
    ReplanTriggeredEvent,
    ExecutionBlockedEvent,
)
logger = logging.getLogger(__name__)


class AgentExecutor:
    """Executes agent tasks with async-safe context management.

    SECURITY: Uses contextvars.ContextVar (via context_manager module) instead
    of threading.local() to prevent context leakage between async requests.

    AIDEV-NOTE: Context management is delegated to context_manager.py module
    to avoid circular imports with agents that need access to current context.
    """

    @classmethod
    def set_current_context(cls, context: Optional[ExecutionContext]) -> None:
        """Store execution context for skill access in current async context."""
        _set_context(context)

    @classmethod
    def get_current_context(cls) -> Optional[ExecutionContext]:
        """Get execution context for current async context (used by SkillTool)."""
        return _get_context()

    @classmethod
    def execution_scope(cls, context: ExecutionContext):
        """Context manager ensuring proper cleanup of execution context.

        SECURITY: Always cleans up context even on exception,
        preventing sensitive data from leaking between requests.

        Usage:
            with AgentExecutor.execution_scope(context):
                # Execute agent task
                pass
            # Context is automatically cleaned up
        """
        return _execution_scope(context)

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        tool_loader: Optional[UnifiedToolLoader] = None,
        agent_factory: Optional[AgentFactory] = None,
        inference_client: Optional[HuggingFaceInferenceClient] = None
    ):
        """Initialize with optional dependencies (creates defaults if not provided)."""
        self.model_provider = model_provider or ModelProvider()
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self.agent_factory = agent_factory or AgentFactory(self.model_provider)
        # Inference client for direct operation execution (lazy initialization)
        self._inference_client = inference_client
        # SkillExecutorService for shared skill execution logic
        self.skill_executor_service = SkillExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
            inference_client=inference_client
        )
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

    def _is_agent_skill(self, skill: SkillConfig) -> bool:
        """
        Check if skill uses step-based agent execution (DAG workflow).

        Agent skills have a steps[] configuration that defines a workflow
        of sub-agents and skill delegations.
        """
        return skill.execution_type == 'agent' and len(skill.steps) > 0

    def _is_agentic_skill(self, skill: SkillConfig) -> bool:
        """
        Check if skill uses agentic execution (flat instructions, LLM orchestration).

        This is the default execution type for skills without explicit configuration.
        """
        # 'agentic' is explicit, but also treat empty/missing as agentic for backwards compat
        return skill.execution_type in ('agentic', '', None) or not skill.execution_type

    def _extract_runtime_inputs(self, context: ExecutionContext) -> Dict[str, Any]:
        """Extract runtime inputs from execution context for inference client."""
        inputs = {}

        # Include skill inputs from automation inputMappings (resolved from trigger_data.payload)
        # These are the primary source of runtime values for skill execution
        if context.skill_inputs:
            inputs.update(context.skill_inputs)
            logger.debug(f"Runtime inputs from skill_inputs: {list(context.skill_inputs.keys())}")

        # Extract from the task text (skill instructions with injected inputs)
        # Only set prompt/text if not already provided via skill_inputs
        if context.task:
            if 'prompt' not in inputs:
                inputs['prompt'] = context.task
            if 'text' not in inputs:
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
        """Determine execution context from TaskRequest (skill-based or instruction-based)."""
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
        # SkillConfig is protobuf - string fields are empty string if not set
        skill_model = skill.model or None

        # Read from request-level fields FIRST (set by frontend), then fallback to config
        # TaskRequest is dataclass with Optional[str] fields - None if not set
        agent_model = request.agent_model or (
            request.agent_config.default_model or None
        )

        org_model = request.organization_model or None

        # Extract attachments from skill definition (skill-level attachments)
        # Protobuf repeated fields are always present (empty list if not set)
        skill_content = list(skill.content) if skill.content else []

        # Extract runtime input attachments (passed during invocation)
        # Protobuf repeated fields - access directly
        input_content = list(request.input_content) if request.input_content else []

        # Merge skill-level and runtime attachments
        all_content = skill_content + input_content

        # Separate images and files from MessageParts
        # MessagePart is protobuf - use HasField() for oneof fields
        images = []
        attachments = []
        for part in all_content:
            if part.HasField('image_url') and part.image_url.url:
                # Convert MessagePart.ImageUrlPart to ImageAttachment for compatibility
                img_attachment = ImageAttachment(url=part.image_url.url)
                images.append(img_attachment)
            elif part.HasField('file') and part.file:
                # Files are already in the right format
                attachments.append(part.file)

        # Get all available skills for delegation (excluding the current skill)
        # Protobuf repeated field - always present
        all_skills = list(request.agent_config.skills) if request.agent_config.skills else []
        available_skills = [s for s in all_skills if s.name != request.skill_name]

        # Extract skill inputs from trigger_data.skill_inputs (automation inputMappings)
        # These are typed runtime values resolved from variables like $trigger.scheduledTime
        # AIDEV-NOTE: SkillInputValue carries name, type, and the actual typed value
        skill_inputs = {}
        if request.trigger_data and request.trigger_data.skill_inputs:
            for input_val in request.trigger_data.skill_inputs:
                skill_inputs[input_val.name] = input_val.value
            if skill_inputs:
                logger.info(f"📥 Skill inputs from trigger_data: {list(skill_inputs.keys())}")

        return ExecutionContext(
            mode=ExecutionMode.AUTONOMOUS,  # Skill execution = autonomous (no HITL)
            task=skill.instructions,  # Changed from 'instructions'
            available_tools=tool_names,
            # TaskRequest is dataclass - agent_id and organization_id are required fields
            agent_id=request.agent_id,
            organization_id=request.organization_id,
            skill_name=request.skill_name,
            skill=skill,
            available_skills=available_skills,  # Skills that can be delegated to
            agent_model=agent_model,
            org_model=org_model,
            images=images,
            attachments=attachments,
            environment={},
            skill_inputs=skill_inputs,  # Runtime values for skill inputs
            resolved_context=request.resolved_context,  # Context table mappings
        )

    def _create_instruction_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for instruction-based execution."""
        instruction_config = request.instruction_config

        # Extract tool names from instruction config
        # instruction_config is protobuf InstructionConfig - tools is repeated field
        tool_names = []
        if instruction_config.tools:
            tool_names = [tool.name for tool in instruction_config.tools]

        # Extract model overrides
        # Priority: instruction model > request agent model > config default model
        # Protobuf string field - empty string if not set
        instruction_model = instruction_config.model or None

        # Read from request-level fields FIRST (set by frontend), then fallback to config
        # TaskRequest is dataclass with Optional[str] fields
        agent_model = request.agent_model or (
            request.agent_config.default_model or None
        )

        org_model = request.organization_model or None

        # Extract images and attachments (new multimodal support)
        # Protobuf repeated fields - always present (empty list if not set)
        images = list(instruction_config.images) if instruction_config.images else []
        attachments = list(instruction_config.attachments) if instruction_config.attachments else []

        return ExecutionContext(
            mode=ExecutionMode.INTERACTIVE,  # Instruction-based = interactive (with HITL)
            task=instruction_config.task,  # Changed from 'instructions'
            available_tools=tool_names,
            images=images,
            attachments=attachments,
            # TaskRequest is dataclass - agent_id and organization_id are required fields
            agent_id=request.agent_id,
            organization_id=request.organization_id,
            skill_name=None,
            agent_model=agent_model or instruction_model,  # Prefer instruction model for direct execution
            org_model=org_model,
            environment={},
            resolved_context=request.resolved_context,  # Context table mappings
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
        """Execute a task with given execution context. Yields progress updates."""
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

            # Use ExecutionCoordinator for two-phase execution if enabled
            if context.use_coordinator:
                async for progress in self._execute_with_coordinator(context, start_time):
                    yield progress
                return

            # Handle instruction-based execution (direct tool execution)
            if context.is_interactive:
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

                # Execute task using DSPy module
                # Build context string with image info if present
                context_str = json.dumps({
                    "task": context.task,
                    "has_images": len(pil_images) > 0,
                    "image_count": len(pil_images),
                })
                result = agent.forward(
                    step_description=context.task,
                    context=context_str,
                )

                yield {
                    "status": "completed",
                    "output": json.dumps({"result": str(result)}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0,
                }

                return

            # Handle skill-based execution
            if context.is_autonomous:
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

                # Route: step-based agent execution (DAG workflow)
                if self._is_agent_skill(skill):
                    logger.info(f"🔗 Agent skill '{skill.name}' - using step-based execution")
                    async for progress in self._execute_step_skill(context, start_time):
                        yield progress
                    return

                # Standard agentic execution (LLM orchestration via DSPy ReAct)
                tool_count = len(skill.tools) if skill.tools else 0
                logger.info(f"Using skill '{skill.name}' with {tool_count} tools")

                yield {
                    "status": "in_progress",
                    "output": json.dumps({"skill": skill.name, "tools": tool_count}),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 20.0
                }

                # Create DSPy executor module for this skill
                agent = await self._create_skill_agent(skill, context)

                # Download images if any (multimodal support)
                pil_images = await self._download_images(context.images)

                # Enhance instructions if skill has output mappings
                task_instructions = self._get_task_instructions(skill) if skill.instructions else context.task

                # Execute the skill instructions
                yield {
                    "status": "in_progress",
                    "output": json.dumps({
                        "message": f"Executing: {task_instructions[:100]}...",
                        "images_loaded": len(pil_images)
                    }),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 50.0
                }

                # Execute task using DSPy module
                context_str = json.dumps({
                    "task": task_instructions,
                    "skill": skill.name,
                    "has_images": len(pil_images) > 0,
                    "image_count": len(pil_images),
                })
                result = agent.forward(
                    step_description=task_instructions,
                    context=context_str,
                )

                # Extract outputs using DSPy module if skill has output mappings
                captured_outputs = None
                if self._has_output_mappings(skill) and skill.outputs:
                    extractor = OutputExtractorModule(
                        skill_outputs=[{
                            'name': o.name,
                            'type': o.type,
                            'description': o.description
                        } for o in skill.outputs]
                    )
                    captured_outputs = extractor.extract(content=str(result))
                    # Apply agent output mappings
                    await self._apply_agent_output_mappings(
                        skill=skill,
                        captured_values=captured_outputs,
                        api_key=context.tool_provider.api_key if context.tool_provider else None,
                        organization_id=context.organization_id,
                    )

                # Final completion
                duration_ms = int((time.time() - start_time) * 1000)
                yield {
                    "status": "completed",
                    "output": json.dumps({
                        "result": str(result),
                        "message": "Task completed successfully",
                        "duration_ms": duration_ms,
                        "skill": skill.name,
                        "captured_outputs": captured_outputs,
                    }),
                    "error_message": "",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 100.0,
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
        """Execute skill directly without LLM orchestration (operation skills)."""
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
            api_key=context.tool_provider.api_key if context.tool_provider else None,
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

    async def _execute_step_skill(
        self,
        context: ExecutionContext,
        start_time: float
    ) -> AsyncIterator[Dict[str, Any]]:
        """Execute skill via step-based DAG workflow."""
        skill = context.skill

        logger.info(f"🔗 Step-based execution: {skill.name} ({len(skill.steps)} steps)")

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "skill": skill.name,
                "execution_type": "agent",
                "steps": len(skill.steps),
                "message": "Starting step-based execution"
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 10.0
        }

        # Build available skills map for delegation (skill_id -> config)
        available_skills: Dict[int, SkillConfig] = {}
        if context.available_skills:
            for s in context.available_skills:
                available_skills[s.id] = s

        # Create step executor with callback for skill delegation
        step_executor = StepExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
            skill_executor_callback=self.skill_executor_service.create_executor_callback(
                org_model=context.org_model,
                return_message_parts=False,
                api_key=context.tool_provider.api_key if context.tool_provider else None,
                organization_id=context.organization_id
            )
        )

        # Execute steps and yield progress
        step_results = []
        async for step_progress in step_executor.execute_steps(
            steps=list(skill.steps),
            available_skills=available_skills,
            initial_inputs=context.skill_inputs or {},
            org_model=context.org_model,
            api_key=context.tool_provider.api_key if context.tool_provider else None,
            organization_id=context.organization_id
        ):
            # Calculate overall progress (10% base + 80% for steps + 10% for completion)
            step_percent = (step_progress.step / step_progress.total) * 80
            overall_percent = 10 + step_percent

            yield {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill.name,
                    "step": step_progress.step,
                    "total_steps": step_progress.total,
                    "step_name": step_progress.name,
                    "step_status": step_progress.status,
                    "message": f"Step {step_progress.step}/{step_progress.total}: {step_progress.name}"
                }),
                "error_message": step_progress.error or "",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": overall_percent
            }

            if step_progress.status == "completed":
                step_results.append({
                    "name": step_progress.name,
                    "result": step_progress.result
                })
            elif step_progress.status == "failed":
                # Step failed - report error and stop
                yield {
                    "status": "failed",
                    "output": json.dumps({
                        "skill": skill.name,
                        "step": step_progress.step,
                        "step_name": step_progress.name,
                        "error": step_progress.error
                    }),
                    "error_message": step_progress.error or "Step execution failed",
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 0.0
                }
                return

        # All steps completed
        duration_ms = int((time.time() - start_time) * 1000)
        yield {
            "status": "completed",
            "output": json.dumps({
                "skill": skill.name,
                "execution_type": "agent",
                "steps_completed": len(step_results),
                "results": step_results,
                "message": "Step-based execution completed successfully",
                "duration_ms": duration_ms
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 100.0
        }

    async def _execute_with_coordinator(
        self,
        context: ExecutionContext,
        start_time: float
    ) -> AsyncIterator[Dict[str, Any]]:
        """Execute task using ExecutionCoordinator for two-phase execution (plan → approve → execute)."""
        skill = context.skill
        skill_name = skill.name if skill else "coordinator"

        logger.info(f"🎯 Using ExecutionCoordinator for two-phase execution: {skill_name}")

        # Load all tools
        tools = []
        if skill and skill.tools:
            try:
                tools = self.tool_loader.load_tools(list(skill.tools))
                logger.info(f"Loaded {len(tools)} tools for coordinator")
            except Exception as e:
                logger.warning(f"Failed to load some tools: {e}")

        # Create coordinator
        coordinator = ExecutionCoordinator(
            evaluate_after_steps=1,
            max_replans=3,
            org_model=context.org_model,
        )

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "skill": skill_name,
                "execution_type": "coordinator",
                "message": "Starting two-phase execution (planning → approval → execution)"
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 15.0
        }

        # Determine goal and instructions
        goal = context.task[:200] if context.task else "Execute task"
        instructions = context.task

        # Phase 1: Create plan
        plan_id = None
        async for event in coordinator.create_plan(
            goal=goal,
            instructions=instructions,
            tools=tools,
            context_tables=context.resolved_context,
        ):
            progress = self._coordinator_event_to_progress(event, skill_name, start_time)
            yield progress

            if isinstance(event, PlanCreatedEvent):
                plan_id = event.plan_id

        if not plan_id:
            yield {
                "status": "failed",
                "output": json.dumps({"error": "Plan creation failed"}),
                "error_message": "Plan creation failed",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0
            }
            return

        # Phase 2: Auto-approve for now (HITL approval would be external)
        # In production, this would wait for external approval signal
        try:
            await coordinator.approve_plan(plan_id)
            yield {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": plan_id,
                    "message": "Plan approved, starting execution"
                }),
                "error_message": "",
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 40.0
            }
        except ValueError as e:
            yield {
                "status": "failed",
                "output": json.dumps({"error": str(e)}),
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0
            }
            return

        # Phase 3: Execute plan
        async for event in coordinator.execute_plan(plan_id, tools):
            progress = self._coordinator_event_to_progress(event, skill_name, start_time)
            yield progress

    def _coordinator_event_to_progress(
        self,
        event: Any,
        skill_name: str,
        start_time: float
    ) -> Dict[str, Any]:
        """Convert ExecutionCoordinator events to progress dicts."""
        timestamp_ms = int(time.time() * 1000)
        duration_ms = int((time.time() - start_time) * 1000)

        if isinstance(event, PlanCreatedEvent):
            step_count = len(event.plan.steps) if event.plan else 0
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": event.plan_id,
                    "step_count": step_count,
                    "message": f"Plan created with {step_count} steps, awaiting approval",
                    "plan_steps": [
                        {"id": s.step_id, "description": s.description}
                        for s in (event.plan.steps if event.plan else [])
                    ],
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 25.0
            }

        elif isinstance(event, StepStartedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "step_id": event.step_id,
                    "message": f"Starting: {event.step_description}"
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 50.0
            }

        elif isinstance(event, StepCompletedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "step_id": event.step_id,
                    "result": event.result,
                    "message": f"Completed step: {event.step_id}"
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 70.0
            }

        elif isinstance(event, StepFailedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "step_id": event.step_id,
                    "error": event.error,
                    "message": f"Step failed: {event.step_id}"
                }),
                "error_message": event.error,
                "timestamp_ms": timestamp_ms,
                "progress_percent": 50.0
            }

        elif isinstance(event, EvaluationCompletedEvent):
            eval_result = event.evaluation
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "evaluation_number": event.evaluation_number,
                    "goal_achieved": eval_result.goal_achieved,
                    "needs_replan": eval_result.needs_replan,
                    "reason": eval_result.reason,
                    "message": f"Evaluation #{event.evaluation_number}: {eval_result.reason}"
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 75.0
            }

        elif isinstance(event, GoalAchievedEvent):
            return {
                "status": "completed",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": event.plan_id,
                    "goal_achieved": True,
                    "reason": event.reason,
                    "message": f"Goal achieved: {event.reason}",
                    "duration_ms": duration_ms
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 100.0
            }

        elif isinstance(event, ReplanTriggeredEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": event.plan_id,
                    "replan_number": event.replan_number,
                    "reason": event.reason,
                    "message": f"Replanning #{event.replan_number}: {event.reason}"
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 60.0
            }

        elif isinstance(event, ExecutionBlockedEvent):
            return {
                "status": "failed",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": event.plan_id,
                    "blocked": True,
                    "reason": event.reason,
                    "message": f"Execution blocked: {event.reason}",
                    "duration_ms": duration_ms
                }),
                "error_message": event.reason,
                "timestamp_ms": timestamp_ms,
                "progress_percent": 0.0
            }

        elif isinstance(event, ExecutionCompletedEvent):
            return {
                "status": "completed" if event.success else "failed",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": event.plan_id,
                    "success": event.success,
                    "message": "Execution completed successfully" if event.success else "Execution failed",
                    "duration_ms": duration_ms
                }),
                "error_message": "" if event.success else "Execution failed",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 100.0 if event.success else 0.0
            }

        else:
            # Unknown event type
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "event_type": type(event).__name__,
                    "message": f"Event: {type(event).__name__}"
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 50.0
            }

    async def _create_direct_execution_agent(
        self,
        context: ExecutionContext,
    ) -> dspy.Module:
        """Create DSPy executor module for direct tool execution."""
        # Load tools from context using consolidated method
        tools = []
        if context.available_tools:
            tool_configs = self.tool_loader.create_tool_configs_with_context(
                context.available_tools,
                {"environment": context.environment}
            )
            tools = self.tool_loader.load_tools(tool_configs)

        # Add bash tool if workspace_path is available (filesystem-based execution)
        if context.workspace_path:
            from pathlib import Path
            bash_tool = create_bash_tool(
                workspace_path=Path(context.workspace_path),
                allow_network=False,  # Network disabled by default for security
                timeout=300,
            )
            tools.append(bash_tool)
            logger.info(f"Added bash tool with workspace: {context.workspace_path}")

        # Create DSPy executor module using AgentFactory
        agent_config = AgentConfig(
            tools=tools,
            agent_model=context.agent_model,
            org_model=context.org_model,
            max_iters=context.max_steps,
            agent_name="direct_executor",
            agent_description="Direct tool execution agent",
            enable_caching=False,
        )

        return self.agent_factory.create_agent(agent_config)

    def _has_output_mappings(self, skill: SkillConfig) -> bool:
        """Check if skill has any outputs with output mappings configured."""
        if not skill.outputs:
            return False
        for output in skill.outputs:
            if output.HasField('output_mapping') and len(output.output_mapping.table_mappings) > 0:
                return True
        return False

    def _get_task_instructions(self, skill: SkillConfig) -> str:
        """Get task instructions from skill config.

        Note: Output capture instructions removed - extraction happens after execution.
        """
        return skill.instructions

    async def _create_skill_agent(
        self,
        skill: SkillConfig,
        context: ExecutionContext,
    ) -> dspy.Module:
        """Create DSPy executor module from skill configuration."""

        # Load tools for this skill
        tools = []
        if skill.tools:
            try:
                tools = self.tool_loader.load_tools(list(skill.tools))
                logger.info(f"Loaded {len(tools)} tools for skill '{skill.name}'")
            except Exception as e:
                logger.warning(f"Failed to load some tools for skill {skill.name}: {e}")

        # Add bash tool if workspace_path is available (filesystem-based execution)
        if context.workspace_path:
            from pathlib import Path
            bash_tool = create_bash_tool(
                workspace_path=Path(context.workspace_path),
                allow_network=False,  # Network disabled by default for security
                timeout=300,
            )
            tools.append(bash_tool)
            logger.info(f"Added bash tool with workspace: {context.workspace_path}")

        # Load available skills as SkillTools for delegation
        if context.available_skills:
            skill_tools = self._create_skill_tools(
                context.available_skills,
                context.org_model,
                api_key=context.tool_provider.api_key if context.tool_provider else None,
                organization_id=context.organization_id
            )
            tools.extend(skill_tools)
            logger.info(f"Added {len(skill_tools)} skills as tools for delegation")

        # Note: Output capture now uses separate extraction step after execution
        # No output tool needed - agent focuses on the task

        # Extract skill model if present
        # SkillConfig is protobuf - string fields are empty string if not set
        skill_model = skill.model or None
        use_code_execution = skill.agent_type == "code_agent"

        # Create DSPy executor module
        agent_config = AgentConfig(
            tools=tools,
            skill_model=skill_model,
            agent_model=context.agent_model,
            org_model=context.org_model,
            max_iters=context.max_steps,
            agent_name=skill.name,
            agent_description=skill.description,
            enable_caching=False,  # Tasks are stateless - no caching
            use_code_execution=use_code_execution,
        )

        return self.agent_factory.create_agent(agent_config)

    def _create_skill_tools(
        self,
        skills: List[SkillConfig],
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> List[SkillTool]:
        """Create SkillTool instances for skill delegation."""
        skill_tools = []

        # Check if any skills need inference client
        # SkillConfig is a protobuf - execution_type field is always present
        has_operation_skills = any(
            s.execution_type == 'operation'
            for s in skills
        )
        inference_client = self._get_inference_client() if has_operation_skills else None

        # Create shared executor callback for all skill tools
        skill_executor_callback = self.skill_executor_service.create_executor_callback(
            org_model=org_model,
            return_message_parts=False,  # Task mode returns plain strings
            api_key=api_key,
            organization_id=organization_id
        )

        for skill_config in skills:
            try:
                skill_tool = SkillTool(
                    skill_config=skill_config,
                    skill_executor=skill_executor_callback,
                    inference_client=inference_client,
                    api_key=api_key,
                    organization_id=organization_id
                )
                skill_tools.append(skill_tool)
                logger.debug(f"Created SkillTool for: {skill_config.name}")
            except Exception as e:
                logger.warning(f"Failed to create SkillTool for {skill_config.name}: {e}")

        return skill_tools

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _extract_api_key_from_tools(self, tools: List[ToolConfig]) -> Optional[str]:
        """Extract user API key from tool configs (for output mappings)."""
        for tool in tools:
            # ToolConfig is protobuf - config is a map<string, string> field
            # Protobuf maps are always present (empty dict if not set)
            if tool.config:
                config = dict(tool.config)
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

    async def health_check(self) -> dict[str, Any]:
        """Check health of execution system."""
        try:
            available_tools = await self.get_available_tools()
            return {
                "status": "healthy",
                "available_tools_count": len(available_tools),
                "service": "dspy_executor",
                "initialized": True,
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "service": "dspy_executor",
                "initialized": False,
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
        """Apply output mappings to save skill results to tables."""
        # Check if we have auth for API calls
        if not api_key or not organization_id:
            logger.warning("📊 Output mapping skipped: missing api_key or organization_id")
            return

        # Get outputs with table_mappings configured
        outputs_with_mappings = [
            output for output in skill.outputs
            if output.HasField('output_mapping') and len(output.output_mapping.table_mappings) > 0
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info(f"📊 Applying {len(outputs_with_mappings)} output mappings")

        # Create mapping context
        ctx = MappingContext(api_key=api_key, organization_id=organization_id)

        # Convert TaskResult to SkillOutputValue list using centralized method
        skill_outputs = result.to_skill_outputs()

        # Use first output's mapping config (UI stores all table mappings on outputs[0])
        first_output = outputs_with_mappings[0]

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)
            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=skill_outputs
            )
            logger.info(f"✅ Task output mapping complete: {len(results)} tables updated")
        except Exception as e:
            logger.error(f"❌ Failed to apply task output mapping: {e}")
            # Re-raise to propagate failure - callers should know mapping failed
            raise

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

    async def _apply_agent_output_mappings(
        self,
        skill: SkillConfig,
        captured_values: Dict[str, Any],
        api_key: Optional[str],
        organization_id: Optional[str]
    ) -> None:
        """Apply output mappings for agent mode skills using captured values."""
        if not api_key or not organization_id:
            logger.warning("📊 Agent output mapping skipped: missing api_key or organization_id")
            return

        if not captured_values:
            logger.debug("📊 Agent output mapping skipped: no values captured")
            return

        # Create mapping context
        ctx = MappingContext(api_key=api_key, organization_id=organization_id)

        # Get outputs with table_mappings configured
        outputs_with_mappings = [
            output for output in skill.outputs
            if output.HasField('output_mapping') and len(output.output_mapping.table_mappings) > 0
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info(f"📊 Applying {len(outputs_with_mappings)} agent output mappings")

        # Convert captured values to SkillOutputValue list
        skill_outputs: List[SkillOutputValue] = []
        for name, value in captured_values.items():
            if isinstance(value, dict):
                # Flatten dict values into separate outputs
                for k, v in value.items():
                    skill_outputs.append(SkillOutputValue(name=k, value=v))
            else:
                skill_outputs.append(SkillOutputValue(name=name, value=value))

        # Use first output's mapping config (UI stores all table mappings on outputs[0])
        first_output = outputs_with_mappings[0]

        try:
            config = OutputMappingConfig.from_proto(first_output.output_mapping)
            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=skill_outputs
            )
            logger.info(f"✅ Agent output mapping complete: {len(results)} tables updated")
        except Exception as e:
            logger.error(f"❌ Failed to apply agent output mapping: {e}")
            # Re-raise to propagate failure - callers should know mapping failed
            raise
