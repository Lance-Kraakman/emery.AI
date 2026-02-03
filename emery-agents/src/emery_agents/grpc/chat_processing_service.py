"""gRPC chat service. Streams AI responses, delegates DB to Next.js."""

import json
import logging
import os
import time
import asyncio
from pathlib import Path
from typing import AsyncIterator, Optional, List, Dict, Any, Tuple, cast

import grpc

from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .mappers.message_mapper import build_conversation_messages, has_images, extract_text_from_parts
from .mappers import format_clarifying_questions
from ..infrastructure.workspace_sync import WorkspaceSync
from ..services.models.provider import ModelProvider
from emery_agents.tools.loader import UnifiedToolLoader
from ..services.context.session_manager import SessionManager
from ..services.agents.factory import AgentFactory
from ..services.skills.executor import SkillExecutorService
from ..services.plan_service import PlanService
from ..services.execution.events import PlanCreatedEvent, AwaitingClarificationEvent
from ..orchestrators.nodes.planning import generate_plan_node
from ..orchestrators.state import PlanExecuteState
from ..orchestrators.runtime import RuntimeContext
from emery_agents.tools.provider import ToolProvider
from ..entities.models.plan import Plan, SkillInputDefinition, SkillOutputDefinition
from .message_processor import extract_file_attachments
from .mappers.proto_mapper import tool_configs_from_proto, history_messages_from_proto, token_usage_to_proto
from .agent_streaming import AgentStreamingHandler
from .coordinator_streaming import CoordinatorStreamingHandler
from .response_converter import convert_response_to_proto
from .agents.agent_models import get_builder_descriptors
from emery_agents.tools.capability_registry import CapabilityRegistry
from ..services.analysis.token_usage import TokenUsageExtractor
from emery_agents.tools.capability_bootstrap import populate_system_agents
from ..services.tasks import TaskExecutor
from ..services.tasks.task_executor import TaskData
from ..services.agents.executor import AgentExecutor

logger = logging.getLogger(__name__)


class ChatProcessingServiceImplementation(agent_worker_pb2_grpc.ChatProcessingServiceServicer):
    """gRPC service for AI chat. DB/auth handled by Next.js."""

    def __init__(self, organization_id: str = ""):
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError("HF_TOKEN environment variable required")

        self.organization_id = organization_id
        self.active_streams: Dict[str, bool] = {}

        # Initialize workspace sync for persistent filesystem
        s3_bucket = os.getenv("S3_BUCKET_NAME")
        if s3_bucket:
            self.workspace_sync = WorkspaceSync(
                bucket=s3_bucket,
                prefix="workspaces"  # Base prefix, type (users/agents) added per request
            )
            logger.info(f"✅ WorkspaceSync initialized with bucket: {s3_bucket}")
        else:
            self.workspace_sync = None
            logger.warning("⚠️ S3_BUCKET_NAME not set, workspace sync disabled for chat")

        self.session_manager = SessionManager(
            idle_timeout=1800,
            max_lifetime=14400,
            workspace_sync=self.workspace_sync
        )
        self.session_manager.start_cleanup_task()

        try:
            try:
                self.tool_loader: Optional[UnifiedToolLoader] = UnifiedToolLoader()
            except ImportError:
                self.tool_loader = None

            self.model_provider: Optional[ModelProvider] = ModelProvider()
            self.agent_factory: Optional[AgentFactory] = AgentFactory(self.model_provider)
            # CapabilityRegistry replaces ManagedAgentsFactory.capability_registry
            self.capability_registry = CapabilityRegistry()
            populate_system_agents(self.capability_registry)

            self.skill_executor_service = SkillExecutorService(
                tool_loader=self.tool_loader,
                agent_factory=self.agent_factory
            )

            self.plan_service = PlanService(
                grpc_client=None,
                model_provider=self.model_provider,
            )

            self._coordinator_handler = CoordinatorStreamingHandler()
            self._agent_handler = AgentStreamingHandler(
                session_manager=self.session_manager,
                model_provider=self.model_provider,
                skill_executor_service=self.skill_executor_service,
                tool_loader=self.tool_loader,
                plan_service=self.plan_service,
                coordinator_handler=self._coordinator_handler,
                capability_registry=self.capability_registry,
            )

            # Shared TaskExecutor for task-based chat executions
            self._agent_executor = AgentExecutor()
            self._task_executor = TaskExecutor(
                agent_executor=self._agent_executor,
                api_service=None,  # No API service needed for chat tasks
            )

            logger.info("✅ ChatProcessingService initialized successfully")

        except ImportError as e:
            logger.error(f"❌ Failed to import core services: {e}")
            self.tool_loader = None
            self.model_provider = None
            self.agent_factory = None

    def _resolve_agent_id(
        self,
        request: agent_worker_pb2.ProcessMessageRequest
    ) -> Optional[int]:
        """
        Resolve agentId - now returns None since skills are loaded dynamically.

        AIDEV-NOTE: Skills removed from gRPC - Python discovers and executes
        skills dynamically via API using skill_crud tool. Agent context is
        resolved when skills are invoked at runtime.

        Returns:
            None - agent context resolved at skill invocation time
        """
        # Skills removed from agent_config - resolved dynamically via API
        return None

    def _get_workspace_id(
        self,
        request: agent_worker_pb2.ProcessMessageRequest
    ) -> Tuple[str, str, str]:
        """
        Determine workspace type and ID from skill's agent ownership.

        Returns:
            Tuple of (workspace_type, workspace_id, s3_prefix)
            - workspace_type: "agents" or "users"
            - workspace_id: agent_id or user_id
            - s3_prefix: full S3 prefix path
        """
        # Resolve agentId from skill being invoked
        agent_id = self._resolve_agent_id(request)

        if agent_id:
            workspace_type = "agents"
            workspace_id = str(agent_id)
        else:
            # Org-level - use user's personal workspace
            workspace_type = "users"
            workspace_id = request.user_id

        s3_prefix = f"workspaces/{workspace_type}"
        return workspace_type, workspace_id, s3_prefix

    async def ProcessMessage(
        self,
        request: agent_worker_pb2.ProcessMessageRequest,
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.ProcessMessageResponse]:
        """
        Process a chat message and stream AI response.

        This is the core stateless operation:
        1. Build conversation context from provided history
        2. Stream LLM response using existing AI infrastructure
        3. Return processing metadata

        All session/persistence logic is handled by Next.js caller.
        """
        
        start_time = time.time()
        message_parts = request.message_parts
        user_id = request.user_id
        org_id = request.organization_id
        message_id = request.message_id if request.message_id else f"msg_{int(time.time() * 1000)}"
        session_id = request.session_id if request.session_id else f"{org_id}_{user_id}"

        # Task-based execution tracking (when task_id is provided)
        # AIDEV-NOTE: When task_id is set, this is a task-tracked execution (skill/agent invocation)
        task_id = request.task_id if request.task_id else None
        if task_id:
            logger.info(f"📋 Task-tracked execution: task_id={task_id[:8]}...")

        # Register message stream for cancellation tracking
        self.active_streams[message_id] = False  # False = not cancelled
        logger.info(f"🚀 Processing message {message_id} for user {user_id} in org {org_id} (session: {session_id})")

        # Extract text preview for logging
        text_preview = extract_text_from_parts(message_parts)
        has_image_content = has_images(message_parts)
        logger.info(f"📝 Message preview: {text_preview[:100]}...")
        if has_image_content:
            logger.info(f"🖼️ Message contains images")

        file_attachments = extract_file_attachments(message_parts)
        if file_attachments:
            logger.info(f"📎 Extracted {len(file_attachments)} file attachments")

        agent_config = request.agent_config if request.agent_config else None

        if agent_config:
            tools_count = len(agent_config.tools) if agent_config.tools else 0
            logger.info(f"🔧 AgentConfig provided: {tools_count} tools")
        else:
            logger.info(f"⚠️ No AgentConfig provided, using empty tools")

        # Download workspace from S3 if workspace sync is enabled
        workspace_path: Optional[Path] = None
        workspace_type: Optional[str] = None
        workspace_id: Optional[str] = None
        workspace_prefix: Optional[str] = None

        if self.workspace_sync:
            try:
                workspace_type, workspace_id, workspace_prefix = self._get_workspace_id(request)
                workspace_path = self.workspace_sync.download(workspace_id, prefix=workspace_prefix)
                logger.info(f"📁 Workspace downloaded: {workspace_path} (type={workspace_type}, id={workspace_id})")
            except Exception as e:
                logger.error(f"Failed to download workspace: {e}")
                # Continue without workspace - chat can still work

        try:
            conversation_messages = await build_conversation_messages(
                request.conversation_history,
                message_parts
            )

            logger.info(f"💬 Built conversation with {len(conversation_messages)} messages (HF format)")

            sequence = 0
            total_content = ""
            current_plan_data: Dict[str, Any] | None = None

            tools_to_use = []

            if agent_config:
                # Convert proto ToolConfig to entity ToolConfig at gRPC boundary
                proto_tools = list(agent_config.tools) if agent_config.tools else []
                tools_to_use = tool_configs_from_proto(proto_tools)

                logger.info(f"📨 AgentConfig tools received: {len(tools_to_use)} tools")
                if tools_to_use:
                    for i, tool in enumerate(tools_to_use):
                        logger.info(f"  Tool {i}: name={tool.name}, config_keys={list(tool.config.keys()) if tool.config else 'none'}")
            else:
                logger.info("  No AgentConfig received from frontend")

            # Extract organization model from request (if provided)
            org_model = request.model if request.model else None
            if org_model:
                logger.info(f"🔧 Using organization model override: {org_model}")
            else:
                logger.info("🔧 No organization model specified, will use system default")

            # Resolve credentials based on skill's agent ownership
            # agentId is resolved from skill.agent_id (set during enrichment in Next.js)
            # - Org-level skill (no agent_id) → User's credentials
            # - Agent skill (agent_id set) → Agent's stored credentials
            agent_id = self._resolve_agent_id(request)

            if task_id:
                task_data = TaskData(
                    task_id=task_id,
                    organization_id=int(org_id),
                    agent_id=agent_id,
                )
                credentials = await self._task_executor._resolve_credentials(task_data)
                effective_api_key = credentials.api_key
                logger.info(f"🔑 Using {credentials.source} credentials for task {task_id[:8]}...")
            elif agent_id:
                # No task tracking but skill is agent-owned - use agent credentials
                credentials = await self._task_executor._load_agent_credentials(agent_id, int(org_id))
                effective_api_key = credentials.api_key
                logger.info(f"🔑 Using agent credentials (agent_id={agent_id})")
            else:
                # Org-level - use user's credentials from request
                effective_api_key = request.user_api_key or None
                if effective_api_key:
                    logger.info(f"🔑 User API key provided for managed agents")
                else:
                    logger.warning("⚠️ No user API key provided - managed agents may fail auth")

            async for response_dict in self._agent_handler.stream_response(
                conversation_messages,
                tools_to_use,
                domain_context=None,  # Domain context removed - agentId resolved from skill config
                org_model=org_model,
                has_images=has_image_content,
                session_id=session_id,
                user_id=user_id,
                org_id=org_id,
                conversation_history=history_messages_from_proto(list(request.conversation_history)),
                agent_config=agent_config,  # Pass agent_config for skill execution
                user_api_key=effective_api_key,  # Resolved credentials (user or agent)
                file_attachments=file_attachments,  # File attachments for skill context injection
                workspace_path=workspace_path,  # Workspace filesystem path
                workspace_id=workspace_id,  # Workspace ID for S3 (user_id or agent_id)
                workspace_prefix=workspace_prefix,  # S3 prefix ("workspaces/users" or "workspaces/agents")
                workspace_type=workspace_type,  # "agents" or "users" — determines memory PII filtering
            ):
                # Check for cancellation
                if self.active_streams.get(message_id, False):
                    logger.info(f"⚠️ Message {message_id} was cancelled, stopping stream")
                    # Send cancellation error
                    cancel_response = agent_worker_pb2.ProcessMessageResponse(
                        error=agent_worker_pb2.ProcessingError(
                            error_code='CANCELLED',
                            error_message='Message processing was cancelled by user',
                            error_details={}
                        ),
                        timestamp=int(time.time() * 1000)
                    )
                    yield cancel_response
                    break

                if isinstance(response_dict, dict):
                    proto_response, content, plan_data, should_break, seq_inc = convert_response_to_proto(
                        response_dict, sequence
                    )

                    if proto_response:
                        # Add task_id to response for logging/tracking
                        if task_id:
                            proto_response.task_id = task_id
                        yield proto_response
                    if content:
                        total_content += content
                    if plan_data:
                        current_plan_data = plan_data
                    sequence += seq_inc
                    if should_break:
                        break

            # Upload workspace after message processing (crash-safe persistence)
            if self.workspace_sync and workspace_path and workspace_id and workspace_prefix:
                try:
                    self.workspace_sync.upload(workspace_id, prefix=workspace_prefix)
                    logger.info(f"📤 Workspace uploaded: {workspace_id}")
                except Exception as e:
                    logger.error(f"Failed to upload workspace: {e}")

            processing_time = int((time.time() - start_time) * 1000)
            handler_token_usage = self._agent_handler.last_token_usage
            # Merge embedding usage (capability discovery, planning) into total
            embedding_usage = TokenUsageExtractor.extract_embedding_usage()
            handler_token_usage = TokenUsageExtractor.merge_usage(handler_token_usage, embedding_usage)
            token_usage_proto = token_usage_to_proto(handler_token_usage)
            model_used = getattr(handler_token_usage, 'model_name', '') if handler_token_usage else ''

            completion_metadata = {
                'content_length': str(len(total_content)),
                'agent_id': str(agent_id) if agent_id else 'none'
            }

            if current_plan_data:
                completion_metadata['plan'] = json.dumps(current_plan_data)
                logger.info(f"📋 Including plan {current_plan_data.get('id')} in completion metadata")

            complete_response = agent_worker_pb2.ProcessMessageResponse(
                complete=agent_worker_pb2.ProcessingComplete(
                    model_used=model_used,
                    total_tokens=sequence,
                    processing_time_ms=processing_time,
                    token_usage=token_usage_proto,
                    metadata=completion_metadata
                ),
                timestamp=int(time.time() * 1000)
            )
            # Add task_id to completion response for logging/tracking
            if task_id:
                complete_response.task_id = task_id
            yield complete_response

            logger.info(f"✅ Message processing completed in {processing_time}ms")

        except Exception as e:
            logger.exception(f"❌ Message processing failed: {e}")
            
            # Send error response
            error_response = agent_worker_pb2.ProcessMessageResponse(
                error=agent_worker_pb2.ProcessingError(
                    error_code='PROCESSING_FAILED',
                    error_message=str(e),
                    error_details={
                        'user_id': user_id,
                        'organization_id': str(org_id),
                        'processing_time_ms': str(int((time.time() - start_time) * 1000))
                    }
                ),
                timestamp=int(time.time() * 1000)
            )
            # Add task_id to error response for logging/tracking
            if task_id:
                error_response.task_id = task_id
            yield error_response

        finally:
            # Cleanup: Remove message from active streams
            if message_id in self.active_streams:
                del self.active_streams[message_id]
                logger.info(f"🧹 Cleaned up message {message_id} from active streams")

    async def CancelMessage(
        self,
        request: agent_worker_pb2.CancelMessageRequest,
        context: grpc.aio.ServicerContext
    ) -> agent_worker_pb2.CancelMessageResponse:
        """Cancel an in-progress message."""
        message_id = request.message_id

        if message_id in self.active_streams:
            self.active_streams[message_id] = True
            return agent_worker_pb2.CancelMessageResponse(
                success=True,
                message=f"Message {message_id} cancellation requested"
            )
        return agent_worker_pb2.CancelMessageResponse(
            success=False,
            message=f"Message {message_id} not found or already completed"
        )

    async def GeneratePlan(
        self,
        request: agent_worker_pb2.GeneratePlanRequest,
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.GeneratePlanResponse]:
        """Generate autonomous plan for skill editor."""
        import uuid
        start_time = time.time()

        session_id = request.session_id if request.session_id else str(uuid.uuid4())

        def _make_progress(message: str, phase: str) -> agent_worker_pb2.GeneratePlanResponse:
            """Create a progress response."""
            return agent_worker_pb2.GeneratePlanResponse(
                progress=agent_worker_pb2.PlanProgress(
                    message=message,
                    phase=phase
                ),
                timestamp=int(time.time() * 1000)
            )

        def _make_error(error_code: str, error_message: str) -> agent_worker_pb2.GeneratePlanResponse:
            """Create an error response."""
            return agent_worker_pb2.GeneratePlanResponse(
                error=agent_worker_pb2.ProcessingError(
                    error_code=error_code,
                    error_message=error_message,
                    can_retry=True
                ),
                timestamp=int(time.time() * 1000)
            )

        try:
            tool_provider = ToolProvider(
                api_key=request.user_api_key or "",
                organization_id=request.organization_id
            )

            # Get agent descriptors for plan generation (replaces ManagedAgentsFactory.create_all_agents)
            managed_agents = get_builder_descriptors()
            capability_registry = self.capability_registry

            skill_inputs: List[SkillInputDefinition] = [
                SkillInputDefinition(name=i.name, type=i.type or "text", required=i.required)
                for i in request.skill_inputs
            ]

            skill_outputs: List[SkillOutputDefinition] = [
                SkillOutputDefinition(name=o.name, type=o.type or "text")
                for o in request.skill_outputs
            ]

            previous_plan_json = request.previous_plan_json or None
            user_feedback = request.user_feedback or None
            task_instructions = request.instructions

            if request.session_id and request.answers:
                logger.info(f"📋 GeneratePlan: Resuming session {session_id} with {len(request.answers)} answers")
                yield _make_progress("Resuming with your answers...", "resuming")

                plan_session = await self.session_manager.get_plan_session(session_id)
                if not plan_session:
                    yield _make_error("SESSION_NOT_FOUND", "Planning session expired. Please start over.")
                    return

                answers_dict = {a.question_id: a.answer for a in request.answers}
                if answers_dict:
                    answers_text = "\n".join([f"- {q}: {a}" for q, a in answers_dict.items()])
                    task_instructions = f"{plan_session.get('instructions', request.instructions)}\n\nUser clarifications:\n{answers_text}"
                    logger.info(f"📋 GeneratePlan: Enhanced instructions with {len(answers_dict)} clarifications")

                await self.session_manager.remove_plan_session(session_id)

            # Append previous plan + user feedback for regeneration
            if previous_plan_json:
                task_instructions = f"{task_instructions}\n\nPrevious plan (revise based on feedback):\n{previous_plan_json}"
            if user_feedback:
                task_instructions = f"{task_instructions}\n\nUser feedback on previous plan:\n{user_feedback}"
            if previous_plan_json or user_feedback:
                logger.info("📋 GeneratePlan: Enhanced instructions with regeneration context")

            yield _make_progress("Analyzing instructions...", "analyzing")

            yield _make_progress("Creating plan...", "planning")

            # Build RuntimeContext for non-serializable objects
            runtime = RuntimeContext(
                tools=[],
                managed_agents=managed_agents,
                api_key=tool_provider.api_key,
                org_id=str(tool_provider.organization_id),
                org_model=request.model or None,
                capability_registry=capability_registry,
            )

            # Call generate_plan_node directly (no graph needed for plan-only)
            plan_state = {
                "task": task_instructions,
                "api_key": tool_provider.api_key,
                "org_id": str(tool_provider.organization_id),
                "org_model": request.model or None,
                "organization_id": tool_provider.organization_id,
                "skill_inputs": [
                    {"name": i.name, "type": i.type, "required": i.required}
                    for i in skill_inputs
                ] if skill_inputs else None,
                "skill_outputs": [
                    {"name": o.name, "type": o.type}
                    for o in skill_outputs
                ] if skill_outputs else None,
                "is_template_generation": bool(skill_inputs),
            }

            result = await generate_plan_node(cast(PlanExecuteState, plan_state), runtime)

            # Check for clarification
            result_events = result.get("events", [])
            for event in result_events:
                if isinstance(event, AwaitingClarificationEvent):
                    logger.info(f"GeneratePlan: Needs clarification - {len(event.questions)} questions")

                    await self.session_manager.store_plan_session(session_id, {
                        "instructions": request.instructions,
                        "skill_inputs": skill_inputs,
                        "skill_outputs": skill_outputs,
                        "org_model": request.model,
                        "api_key": tool_provider.api_key,
                        "organization_id": tool_provider.organization_id,
                        "previous_plan_json": previous_plan_json,
                        "user_feedback": user_feedback,
                    })

                    questions_json = json.dumps(format_clarifying_questions(event.questions))

                    yield agent_worker_pb2.GeneratePlanResponse(
                        awaiting_input=agent_worker_pb2.AwaitingInput(
                            input_type="questions",
                            title="Clarification Needed",
                            content=questions_json,
                            options=[],
                            session_id=session_id
                        ),
                        timestamp=int(time.time() * 1000)
                    )
                    return

                elif isinstance(event, PlanCreatedEvent):
                    plan = event.plan
                    planning_time_ms = int((time.time() - start_time) * 1000)
                    logger.info(f"GeneratePlan: Created plan {plan.id} with {len(plan.steps)} steps in {planning_time_ms}ms")

                    if not plan.steps:
                        logger.error("GeneratePlan: Plan has no steps - generation failed")
                        yield _make_error(
                            "PLAN_GENERATION_FAILED",
                            "Plan generation failed - no steps were created. Check that the model can access database context."
                        )
                        return

                    yield self._make_plan_complete_response(plan, planning_time_ms)

            # Check for error
            if result.get("error"):
                yield _make_error("PLAN_GENERATION_FAILED", result["error"])

        except asyncio.TimeoutError:
            logger.error(f"📋 GeneratePlan: Timed out after {request.timeout_seconds}s")
            yield _make_error("TIMEOUT", "Plan generation timed out")

        except Exception as e:
            logger.error(f"📋 GeneratePlan: Failed with error: {e}", exc_info=True)
            yield _make_error("INTERNAL_ERROR", str(e))

    def _make_plan_complete_response(self, plan: Plan, planning_time_ms: int) -> agent_worker_pb2.GeneratePlanResponse:
        """Convert Plan to StoredPlan JSON format for TypeScript frontend."""
        stored_plan = {
            "id": plan.id,
            "goal": plan.goal,
            "basicInstructions": plan.basic_instructions,
            "context": plan.context,
            "analysis": plan.analysis,
            "steps": [
                {
                    "stepId": step.step_id,
                    "description": step.description,
                    "toolCall": step.tool_call,
                    "parameters": step.parameters or {},
                    "targetAgent": step.target_agent,
                    "promptTemplate": step.prompt_template,
                    "requiredContext": step.required_context or [],
                }
                for step in plan.steps
            ],
            "version": 1,
            "generatedAt": plan.generated_at.isoformat() if plan.generated_at else None,
        }

        return agent_worker_pb2.GeneratePlanResponse(
            plan_complete=agent_worker_pb2.PlanComplete(
                plan_json=json.dumps(stored_plan),
                plan_id=plan.id,
                planning_time_ms=planning_time_ms
            ),
            timestamp=int(time.time() * 1000)
        )

