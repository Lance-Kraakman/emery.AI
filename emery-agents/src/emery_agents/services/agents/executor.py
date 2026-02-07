"""Executes agent tasks with routing and tool loading.

AIDEV-NOTE: DSPy Migration - Uses ExecutorModule (dspy.ReAct) instead of
smolagents ToolCallingAgent. Agent execution now uses module.forward() pattern.
"""

from __future__ import annotations

import logging
import os
import time
import json
from collections.abc import AsyncIterator
from typing import Any, Dict

import dspy
from PIL import Image


from ...entities.execution_context import ExecutionContext
from ...entities.skill_config import SkillConfig
from ...types import ExecutionMode, AgentId, OrganizationId
from ...entities.tool_config import ToolConfig
from ...entities.message import ImageAttachment, ImagePart, FilePart, FileAttachment
from ...entities.task import TaskRequest
from ..models import ModelProvider
from ..data import ImageProcessor
from .factory import AgentFactory, AgentConfig
from ..analysis import TokenUsageExtractor
from emery_agents.tools.execution.skill import SkillTool
from emery_agents.tools.execution.bash import create_bash_tool
from ...reasoning.modules.extractor import OutputExtractorModule
from ..skills.executor import SkillExecutorService
from ..skills.step_executor import StepExecutorService
from emery_agents.tools.loader import UnifiedToolLoader
from ..context import (
    get_current_context as _get_context,
    set_current_context as _set_context,
    execution_scope as _execution_scope,
)
from ...entities.task import SkillOutputValue
from ..data import OutputMappingService, MappingContext
from ..execution.events import (
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
    FinalSynthesisEvent,
)
from ...orchestrators.nodes.planning import generate_plan_node, _build_workspace_context
from ...orchestrators import create_session_graph, RuntimeContext
from ...orchestrators.state import DEFAULT_STATE
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
    ):
        """Initialize with optional dependencies (creates defaults if not provided)."""
        self.model_provider = model_provider or ModelProvider()
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self.agent_factory = agent_factory or AgentFactory(self.model_provider)
        # SkillExecutorService for shared skill execution logic
        self.skill_executor_service = SkillExecutorService(
            tool_loader=self.tool_loader,
            agent_factory=self.agent_factory,
        )
        # Agent cache now managed by AgentFactory
        logger.info("AgentExecutor initialized with shared utilities")

    def _extract_token_usage(self, result) -> Optional[Any]:
        """Extract token usage using consolidated TokenUsageExtractor."""
        return TokenUsageExtractor.extract_from_result(result)

    async def _download_images(self, image_attachments: List[ImageAttachment]) -> List[Image.Image]:
        """Download images using consolidated ImageProcessor."""
        return await ImageProcessor.download_images_from_attachments(image_attachments)

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

    # =========================================================================
    # Routing Logic (from CapabilityRoutingService)
    # =========================================================================

    def determine_execution_context(
        self,
        request: TaskRequest,
        pre_fetched_skill: SkillConfig | None = None,
    ) -> ExecutionContext:
        """Determine execution context from TaskRequest (skill-based or instruction-based)."""
        if request.skill_name:
            return self._create_skill_context(request, pre_fetched_skill)
        elif request.instruction_config:
            return self._create_instruction_context(request)
        else:
            raise ValueError("TaskRequest must specify either skill_name or instruction_config")

    def _create_skill_context(
        self,
        request: TaskRequest,
        pre_fetched_skill: SkillConfig | None = None,
    ) -> ExecutionContext:
        """Create execution context for skill-based execution."""
        if not request.skill_name:
            raise ValueError("Skill name is required for skill-based execution")

        # Use pre-fetched skill from API if available (task execution path),
        # otherwise fall back to searching (currently empty — legacy proto path)
        if pre_fetched_skill:
            skill = pre_fetched_skill
            all_skill_dtos = [skill]
            logger.info(f"Using pre-fetched skill config: {skill.name} (id={skill.id})")
        else:
            all_skill_dtos: list[SkillConfig] = []
            skill = self._find_skill_by_name(all_skill_dtos, request.skill_name)

        if not skill:
            raise ValueError(f"Skill '{request.skill_name}' not found in agent configuration")

        # Extract api_key from skill's tool configs (for output mappings)
        api_key = self._extract_api_key_from_tools(list(skill.tools)) if skill.tools else None

        # Extract tool names from skill's tools list
        tool_names = [tool.name for tool in skill.tools] if skill.tools else []

        # Extract model overrides
        # Priority: skill model > request agent model > config default model
        skill_model = skill.model or None

        # Read from request-level fields FIRST (set by frontend), then fallback to config
        # TaskRequest is dataclass with Optional[str] fields - None if not set
        agent_model = request.agent_model or (
            request.agent_config.default_model or None
        )

        org_model = request.organization_model or None

        # Extract attachments from skill definition (skill-level attachments)
        skill_content = list(skill.content) if skill.content else []

        # Extract runtime input attachments (passed during invocation)
        input_content = list(request.input_content) if request.input_content else []

        # Merge skill-level and runtime attachments
        all_content = skill_content + input_content

        # Separate images and files from MessageParts (entity types)
        images = []
        attachments = []
        for part in all_content:
            if isinstance(part, ImagePart):
                images.append(ImageAttachment(url=part.url))
            elif isinstance(part, FilePart):
                attachments.append(FileAttachment(
                    url=part.url,
                    mime_type=part.mime_type,
                    filename=part.filename,
                ))

        # Get all available skills for delegation (excluding the current skill)
        # Reuse all_skill_dtos from above
        available_skills = [s for s in all_skill_dtos if s.name != request.skill_name]

        # Extract skill inputs from trigger_data.skill_inputs (automation inputMappings)
        # These are typed runtime values resolved from variables like $trigger.scheduledTime
        # AIDEV-NOTE: SkillInputValue carries name, type, and the actual typed value
        skill_inputs = {}
        if request.trigger_data and request.trigger_data.skill_inputs:
            for input_val in request.trigger_data.skill_inputs:
                skill_inputs[input_val.name] = input_val.value
            if skill_inputs:
                logger.info(f"📥 Skill inputs from trigger_data: {list(skill_inputs.keys())}")

        # For skill execution, use skill's allow_network setting
        # Skills default to False, but can be set to True for git/code skills
        skill_allow_network = skill.allow_network if skill else False

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
            allow_network=skill_allow_network,  # From skill config
        )

    def _create_instruction_context(self, request: TaskRequest) -> ExecutionContext:
        """Create execution context for instruction-based execution."""
        instruction_config = request.instruction_config

        # Extract tool names from instruction config
        tool_names = []
        if instruction_config.tools:
            tool_names = [tool.name for tool in instruction_config.tools]

        # Extract model overrides
        # Priority: instruction model > request agent model > config default model
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

        # Get agent's allow_network setting (default True for backwards compatibility)
        agent_allow_network = getattr(request.agent_config, 'allow_network', True)

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
            allow_network=agent_allow_network,  # From agent config
        )

    def _find_skill_by_name(self, skills: list[SkillConfig], skill_name: str) -> Optional[SkillConfig]:
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
                with dspy.context(lm=agent._lm):
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
                with dspy.context(lm=agent._lm):
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
        """Execute task using LangGraph plan-execute graph (plan → auto-approve → execute)."""
        skill = context.skill
        skill_name = skill.name if skill else "coordinator"

        logger.info(f"Using LangGraph plan-execute graph: {skill_name}")

        # Load all tools
        tools = []
        if skill and skill.tools:
            try:
                tools = self.tool_loader.load_tools(list(skill.tools))
                logger.info(f"Loaded {len(tools)} tools for graph execution")
            except Exception as e:
                logger.warning(f"Failed to load some tools: {e}")

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "skill": skill_name,
                "execution_type": "langgraph",
                "message": "Starting plan-execute graph (planning → auto-approve → execution)"
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 15.0
        }

        instructions = context.task or "Execute task"

        # Build RuntimeContext for non-serializable objects
        api_key = context.tool_provider.api_key if context.tool_provider else ""
        org_id = str(context.tool_provider.organization_id) if context.tool_provider else ""
        runtime = RuntimeContext(
            tools=tools,
            managed_agents=[],
            api_key=api_key,
            org_id=org_id,
            org_model=context.org_model,
        )

        # Phase 1: Generate plan using generate_plan_node directly
        workspace = _build_workspace_context(api_key, org_id)
        plan_state = {
            "task": instructions,
            "org_model": context.org_model,
            "api_key": api_key,
            "org_id": org_id,
            "workspace_context": workspace,
        }

        result = await generate_plan_node(plan_state, runtime)

        plan = result.get("plan")
        for event in result.get("events", []):
            progress = self._coordinator_event_to_progress(event, skill_name, start_time)
            yield progress

        if not plan:
            yield {
                "status": "failed",
                "output": json.dumps({"error": "Plan creation failed"}),
                "error_message": result.get("error", "Plan creation failed"),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0
            }
            return

        # Phase 2: Auto-approve and execute via graph with stored_plan (autonomous mode)
        approved_plan = plan.approve().start_execution()

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "skill": skill_name,
                "plan_id": plan.id,
                "message": "Plan auto-approved, starting execution"
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 40.0
        }

        # Phase 3: Execute plan via LangGraph (session-scoped graph with RuntimeContext)
        graph = create_session_graph(runtime)
        config = {"configurable": {"thread_id": f"executor-{plan.id}"}}

        initial_state = {
            **DEFAULT_STATE,
            "task": instructions,
            "org_model": context.org_model,
            "api_key": runtime.api_key,
            "org_id": runtime.org_id,
            "stored_plan": approved_plan,
        }

        try:
            async for event_chunk in graph.astream(initial_state, config=config):
                for node_name, state_update in event_chunk.items():
                    if node_name == "__end__":
                        continue
                    for event in state_update.get("events", []):
                        progress = self._coordinator_event_to_progress(event, skill_name, start_time)
                        yield progress
        except Exception as e:
            logger.error(f"Graph execution failed: {e}", exc_info=True)
            yield {
                "status": "failed",
                "output": json.dumps({"error": str(e)}),
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 0.0
            }

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

        elif isinstance(event, FinalSynthesisEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "skill": skill_name,
                    "plan_id": event.plan_id,
                    "synthesis": event.synthesis,
                    "message": f"Final synthesis: {event.synthesis[:200]}"
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 95.0
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
            # Use context.allow_network (from agent config, defaults to True)
            allow_net = context.allow_network
            bash_tool = create_bash_tool(
                workspace_path=Path(context.workspace_path),
                allow_network=allow_net,
                timeout=300,
            )
            tools.append(bash_tool)
            logger.info(f"Added bash tool with workspace: {context.workspace_path}, network={'enabled' if allow_net else 'disabled'}")

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
            if output.output_mapping is not None:
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
            allow_net = skill.allow_network if skill else False
            bash_tool = create_bash_tool(
                workspace_path=Path(context.workspace_path),
                allow_network=allow_net,
                timeout=300,
            )
            tools.append(bash_tool)
            logger.info(f"Added bash tool with workspace: {context.workspace_path}, network={'enabled' if allow_net else 'disabled'}")

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

    def _extract_api_key_from_tools(self, tools: list) -> Optional[str]:
        """Extract user API key from tool configs (for output mappings)."""
        for tool in tools:
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
    # Output Mapping Methods
    # =========================================================================

    async def _apply_agent_output_mappings(
        self,
        skill: SkillConfig,
        captured_values: Dict[str, Any],
        api_key: Optional[str],
        organization_id: Optional[str]
    ) -> None:
        """Apply output mappings for agent mode skills using captured values."""
        if not api_key or not organization_id:
            logger.warning("Agent output mapping skipped: missing api_key or organization_id")
            return

        if not captured_values:
            logger.debug("Agent output mapping skipped: no values captured")
            return

        # Create mapping context
        ctx = MappingContext(api_key=api_key, organization_id=organization_id)

        # Get outputs with output mappings configured
        outputs_with_mappings = [
            output for output in skill.outputs
            if output.output_mapping is not None
        ]

        if not outputs_with_mappings:
            logger.debug("No output mappings configured")
            return

        logger.info(f"Applying {len(outputs_with_mappings)} agent output mappings")

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
            config = first_output.output_mapping
            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=skill_outputs
            )
            logger.info(f"Agent output mapping complete: {len(results)} tables updated")
        except Exception as e:
            logger.error(f"Failed to apply agent output mapping: {e}")
            raise
