"""gRPC chat service. Streams AI responses, delegates DB to Next.js."""

import json
import logging
import os
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, cast

import grpc

from emery_agents.entities.models.capability import CapabilityType
from emery_agents.knowledge.cache import load_knowledge_cache, load_knowledge_local
from emery_agents.planning.patterns import ALL_PATTERNS
from emery_agents.planning.registry import PlanningRegistry
from emery_agents.services.analysis.embedding_cache import (
    load_embedding_cache,
    save_embedding_cache,
)
from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from emery_agents.tools.capability_bootstrap import (
    populate_integration_services,
    populate_system_agents,
)
from emery_agents.tools.capability_registry import CapabilityRegistry
from emery_agents.tools.knowledge import set_knowledge_base
from emery_agents.tools.loader import UnifiedToolLoader
from emery_agents.tools.provider import ToolProvider

from ..entities.models.plan import Plan, SkillInputDefinition, SkillOutputDefinition
from ..infrastructure.storage import create_workspace_storage, WorkspaceType
from ..orchestrators.nodes.planning import generate_plan_node
from ..orchestrators.runtime import RuntimeContext
from ..orchestrators.state import PlanExecuteState
from ..services.agents.executor import AgentExecutor
from ..services.agents.factory import AgentFactory
from ..services.context.session_manager import SessionManager
from ..services.execution.events import AwaitingClarificationEvent, PlanCreatedEvent
from ..services.models.provider import ModelProvider
from ..services.plan_service import PlanService
from ..services.skills.executor import SkillExecutorService
from ..services.tasks import TaskExecutor
from ..services.tasks.task_executor import TaskData
from .agent_streaming import AgentStreamingHandler
from .agents.agent_models import get_builder_descriptors
from .coordinator_streaming import CoordinatorStreamingHandler
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .mappers import format_clarifying_questions
from .mappers.message_mapper import (
    build_conversation_messages,
    extract_text_from_parts,
    has_images,
)
from .mappers.proto_mapper import (
    history_messages_from_proto,
    token_usage_to_proto,
    tool_configs_from_proto,
)
from .message_processor import extract_file_attachments
from .response_converter import convert_response_to_proto
from .response_types import StreamResponseDict

logger = logging.getLogger(__name__)


class ChatProcessingServiceImplementation(
    agent_worker_pb2_grpc.ChatProcessingServiceServicer
):
    """gRPC service for AI chat. DB/auth handled by Next.js."""

    def __init__(self, organization_id: str = ""):
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise OSError("HF_TOKEN environment variable required")

        self.organization_id = organization_id
        self.active_streams: dict[str, bool] = {}

        # Initialize workspace storage (EFS/NFS/local filesystem)
        # Workspaces are stored directly on shared filesystem - no S3 needed
        self.workspace_storage = create_workspace_storage()
        logger.info("✅ WorkspaceStorage initialized for chat")

        # Initialize knowledge base for discovery
        self._initialize_knowledge_base()

        self.session_manager = SessionManager(
            idle_timeout=1800, max_lifetime=14400
        )
        self.session_manager.start_cleanup_task()

        try:
            self.tool_loader: UnifiedToolLoader = UnifiedToolLoader()
        except ImportError:
            raise RuntimeError(
                "UnifiedToolLoader failed to initialize due to missing dependencies."
            )

        self.model_provider: ModelProvider = ModelProvider()
        self.agent_factory: AgentFactory = AgentFactory(self.model_provider)
        self.capability_registry = CapabilityRegistry()
        populate_system_agents(self.capability_registry)
        populate_integration_services(self.capability_registry)
        self._precompute_embeddings()

        # Initialize planning registry with all patterns
        self.planning_registry = PlanningRegistry()
        for pattern in ALL_PATTERNS:
            self.planning_registry.register(pattern)

        self.skill_executor_service = SkillExecutorService(
            tool_loader=self.tool_loader, agent_factory=self.agent_factory
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
            planning_registry=self.planning_registry,
        )

        # Shared TaskExecutor for task-based chat executions
        self._agent_executor = AgentExecutor()
        self._task_executor = TaskExecutor(
            agent_executor=self._agent_executor,
            api_service=None,  # No API service needed for chat tasks
        )

        logger.info("✅ ChatProcessingService initialized successfully")

    def _resolve_agent_id(
        self, request: agent_worker_pb2.ProcessMessageRequest
    ) -> int | None:
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

    @staticmethod
    def _build_chat_audit_headers(
        user_id: str,
        agent_id: int | None,
        task_id: str | None,
        user_name: str | None = None,
        agent_name: str | None = None,
    ) -> dict[str, str] | None:
        """
        Build HTTP headers for audit trail in chat-initiated executions.

        When a user executes a skill from chat, CRUD tool calls should
        carry context so the TypeScript API can attribute the action
        correctly in the audit log.
        """
        if not agent_id:
            # Org-level (no agent) - user is the actor; no extra headers needed
            return None

        headers: dict[str, str] = {
            "X-Agent-ID": str(agent_id),
            "X-Trigger-Type": "manual",
            "X-Triggered-By-User-Id": user_id,
        }
        if user_name:
            headers["X-Triggered-By-User-Name"] = user_name
        if agent_name:
            headers["X-Agent-Name"] = agent_name
        if task_id:
            headers["X-Task-ID"] = task_id
        return headers

    def _initialize_knowledge_base(self) -> None:
        """Eagerly load knowledge base at startup."""
        s3_bucket = os.getenv("S3_BUCKET_NAME")

        try:
            kb = None
            if s3_bucket:
                kb = load_knowledge_cache(s3_bucket)
                if kb:
                    set_knowledge_base(kb)
                    logger.info(
                        f"✅ KnowledgeBase initialized from S3 ({kb.count()} items)"
                    )
                    return

            # Local fallback
            local_path = os.environ.get(
                "KNOWLEDGE_BASE_PATH", "./knowledge_base.json.gz"
            )
            if os.path.exists(local_path):
                kb = load_knowledge_local(local_path)
                if kb:
                    set_knowledge_base(kb)
                    logger.info(
                        f"✅ KnowledgeBase initialized locally ({kb.count()} items)"
                    )
                    return

            logger.info("ℹ️ No knowledge base cache found, will be empty")

        except Exception as e:
            logger.warning(f"⚠️ Knowledge base init failed: {e}")

    def _precompute_embeddings(self) -> None:
        """Pre-compute capability embeddings at startup.

        Integration embeddings (3K+ static services): loaded from S3 cache.
        On cache miss: computed via multi-text embed_content, then uploaded to S3.
        Agent embeddings (11): always computed fresh (1 API call).
        """
        start = time.monotonic()
        s3_bucket = os.getenv("S3_BUCKET_NAME")
        integration_caps = self.capability_registry.by_type(CapabilityType.TOOL)

        # Integration embeddings: try S3 cache first
        loaded_from_cache = False
        if s3_bucket and integration_caps:
            try:
                cached = load_embedding_cache(s3_bucket, integration_caps)
                if cached:
                    count = self.capability_registry.load_embeddings(cached)
                    logger.info(f"Loaded {count} integration embeddings from S3 cache")
                    loaded_from_cache = True
            except Exception as e:
                logger.warning(f"Failed to load embedding cache: {e}")

        # Cache miss: compute via batch API, then upload to S3
        if not loaded_from_cache and integration_caps:
            logger.info(
                f"Computing {len(integration_caps)} integration embeddings (first startup)..."
            )
            count = self.capability_registry.precompute_embeddings("integration:")
            logger.info(f"Computed {count} integration embeddings via API")
            if s3_bucket and count > 0:
                try:
                    embeddings = self.capability_registry.export_embeddings(
                        "integration:"
                    )
                    save_embedding_cache(s3_bucket, integration_caps, embeddings)
                    logger.info("Uploaded integration embeddings to S3 cache")
                except Exception as e:
                    logger.warning(f"Failed to save embedding cache: {e}")

        # Agent embeddings: always compute (11 agents, 1 API call)
        agent_count = self.capability_registry.precompute_embeddings("agent:")
        if agent_count:
            logger.info(f"Computed {agent_count} agent embeddings")

        elapsed = time.monotonic() - start
        logger.info(f"Embedding pre-computation complete in {elapsed:.1f}s")

    def _get_workspace_id(
        self, request: agent_worker_pb2.ProcessMessageRequest
    ) -> tuple[WorkspaceType, str, int]:
        """
        Determine workspace type and ID from skill's agent ownership.

        Returns:
            Tuple of (workspace_type, workspace_id, organization_id)
            - workspace_type: WorkspaceType.AGENTS or WorkspaceType.USERS
            - workspace_id: agent_id or user_id
            - organization_id: org that owns this workspace
        """
        # Resolve agentId from skill being invoked
        agent_id = self._resolve_agent_id(request)

        if agent_id:
            workspace_type = WorkspaceType.AGENTS
            workspace_id = str(agent_id)
        else:
            # Org-level - use user's personal workspace
            workspace_type = WorkspaceType.USERS
            workspace_id = request.user_id

        organization_id = int(request.organization_id)
        return workspace_type, workspace_id, organization_id

    async def ProcessMessage(
        self,
        request: agent_worker_pb2.ProcessMessageRequest,
        context: grpc.aio.ServicerContext,
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
        user_id = request.user_id
        org_id = request.organization_id
        message_id = (
            request.message_id
            if request.message_id
            else f"msg_{int(time.time() * 1000)}"
        )
        session_id = request.session_id if request.session_id else f"{org_id}_{user_id}"

        # Task-based execution tracking (when task_id is provided)
        # AIDEV-NOTE: When task_id is set, this is a task-tracked execution (skill/agent invocation)
        task_id = request.task_id if request.task_id else None
        if task_id:
            logger.info(f"📋 Task-tracked execution: task_id={task_id[:8]}...")

        # Create a new token accumulator for this request
        accumulator = TokenAccumulator()

        # Register message stream for cancellation tracking
        self.active_streams[message_id] = False  # False = not cancelled
        logger.info(
            f"🚀 Processing message {message_id} for user {user_id} in org {org_id} (session: {session_id})"
        )

        # Extract text preview for logging
        message_parts_list = list(request.message_parts)
        text_preview = extract_text_from_parts(message_parts_list)
        has_image_content = has_images(message_parts_list)
        logger.info(f"📝 Message preview: {text_preview[:100]}...")
        if has_image_content:
            logger.info("🖼️ Message contains images")

        file_attachments = extract_file_attachments(message_parts_list)
        if file_attachments:
            logger.info(f"📎 Extracted {len(file_attachments)} file attachments")

        agent_config = request.agent_config if request.agent_config else None

        if agent_config:
            tools_count = len(agent_config.tools) if agent_config.tools else 0
            logger.info(f"🔧 AgentConfig provided: {tools_count} tools")
        else:
            logger.info("⚠️ No AgentConfig provided, using empty tools")

        # Get workspace path from shared filesystem (EFS/NFS/local)
        workspace_path: Path | None = None
        workspace_type: WorkspaceType | None = None
        workspace_id: str | None = None
        workspace_org_id: int | None = None

        try:
            workspace_type, workspace_id, workspace_org_id = self._get_workspace_id(
                request
            )
            workspace_path = self.workspace_storage.get_workspace_path(
                workspace_org_id, workspace_type, workspace_id
            )
            logger.info(
                f"📁 Workspace ready: {workspace_path} (type={workspace_type.value}, id={workspace_id})"
            )
        except Exception as e:
            logger.error(f"Failed to access workspace: {e}")
            # Continue without workspace - chat can still work

        try:
            conversation_messages = await build_conversation_messages(
                list(request.conversation_history), message_parts_list
            )

            logger.info(
                f"💬 Built conversation with {len(conversation_messages)} messages (HF format)"
            )

            sequence = 0
            total_content = ""
            current_plan_data: dict[str, Any] | None = None

            tools_to_use = []

            if agent_config:
                # Convert proto ToolConfig to entity ToolConfig at gRPC boundary
                proto_tools = list(agent_config.tools) if agent_config.tools else []
                tools_to_use = tool_configs_from_proto(proto_tools)

                logger.info(f"📨 AgentConfig tools received: {len(tools_to_use)} tools")
                if tools_to_use:
                    for i, tool in enumerate(tools_to_use):
                        logger.info(
                            f"  Tool {i}: name={tool.name}, config_keys={list(tool.config.keys()) if tool.config else 'none'}"
                        )
            else:
                logger.info("  No AgentConfig received from frontend")

            # Extract organization model from request (if provided)
            org_model = request.model if request.model else None
            if org_model:
                logger.info(f"🔧 Using organization model override: {org_model}")
            else:
                logger.info(
                    "🔧 No organization model specified, will use system default"
                )

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
                logger.info(
                    f"🔑 Using {credentials.source} credentials for task {task_id[:8]}..."
                )
            elif agent_id:
                # No task tracking but skill is agent-owned - use agent credentials
                credentials = await self._task_executor._load_agent_credentials(
                    agent_id, int(org_id)
                )
                effective_api_key = credentials.api_key
                logger.info(f"🔑 Using agent credentials (agent_id={agent_id})")
            else:
                # Org-level - use user's credentials from request
                effective_api_key = request.user_api_key or None
                if effective_api_key:
                    logger.info("🔑 User API key provided for managed agents")
                else:
                    logger.warning(
                        "⚠️ No user API key provided - managed agents may fail auth"
                    )

            # Build audit headers for chat-initiated tool calls
            user_name = request.user_name if request.user_name else None
            agent_name = (
                agent_config.name if agent_config and agent_config.name else None
            )
            chat_audit_headers = self._build_chat_audit_headers(
                user_id, agent_id, task_id, user_name=user_name, agent_name=agent_name
            )

            async for response_dict in self._agent_handler.stream_response(
                conversation_messages,
                tools_to_use,
                token_accumulator=accumulator,
                domain_context=None,  # Domain context removed - agentId resolved from skill config
                org_model=org_model,
                has_images=has_image_content,
                session_id=session_id,
                user_id=user_id,
                org_id=org_id,
                conversation_history=history_messages_from_proto(
                    list(request.conversation_history)
                ),
                agent_config=agent_config,  # Pass agent_config for skill execution
                user_api_key=effective_api_key,  # Resolved credentials (user or agent)
                file_attachments=file_attachments,  # File attachments for skill context injection
                workspace_path=workspace_path,  # Workspace filesystem path
                workspace_id=workspace_id,  # Workspace ID (user_id or agent_id)
                workspace_type=workspace_type.value if workspace_type else None,  # "agents" or "users"
                workspace_org_id=workspace_org_id,  # Organization ID
                extra_headers=chat_audit_headers,  # Audit trail headers for CRUD tool calls
            ):
                # Check for cancellation
                if self.active_streams.get(message_id, False):
                    logger.info(
                        f"⚠️ Message {message_id} was cancelled, stopping stream"
                    )
                    # Send cancellation error
                    cancel_response = agent_worker_pb2.ProcessMessageResponse(
                        error=agent_worker_pb2.ProcessingError(
                            error_code="CANCELLED",
                            error_message="Message processing was cancelled by user",
                            error_details={},
                        ),
                        timestamp=int(time.time() * 1000),
                    )
                    yield cancel_response
                    break

                if isinstance(response_dict, dict):
                    proto_response, content, plan_data, should_break, seq_inc = (
                        convert_response_to_proto(
                            cast(StreamResponseDict, response_dict), sequence
                        )
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

            # With EFS-based storage, workspace changes are already persisted
            # No upload needed - filesystem changes are immediately available
            if workspace_path:
                logger.info(f"✅ Workspace changes persisted: {workspace_id}")

            processing_time = int((time.time() - start_time) * 1000)
            # Extract accumulated LLM + embedding usage for this request
            llm_usage = accumulator.extract_llm_usage()
            embedding_usage = accumulator.extract_embedding_usage()
            handler_token_usage = TokenAccumulator.merge_usage(
                llm_usage, embedding_usage
            )
            token_usage_proto = token_usage_to_proto(handler_token_usage)
            model_used = (
                getattr(handler_token_usage, "model_name", "")
                if handler_token_usage
                else ""
            )

            completion_metadata = {
                "content_length": str(len(total_content)),
                "agent_id": str(agent_id) if agent_id else "none",
                "agent_name": agent_config.name
                if agent_config and agent_config.name
                else "",
            }

            if current_plan_data:
                completion_metadata["plan"] = json.dumps(current_plan_data)
                logger.info(
                    f"📋 Including plan {current_plan_data.get('id')} in completion metadata"
                )

            complete_response = agent_worker_pb2.ProcessMessageResponse(
                complete=agent_worker_pb2.ProcessingComplete(
                    model_used=model_used,
                    total_tokens=sequence,
                    processing_time_ms=processing_time,
                    token_usage=token_usage_proto,
                    metadata=completion_metadata,
                ),
                timestamp=int(time.time() * 1000),
            )
            # Add task_id to completion response for logging/tracking
            if task_id:
                complete_response.task_id = task_id
            yield complete_response

            logger.info(f"✅ Message processing completed in {processing_time}ms")

        except Exception as e:
            logger.exception(f"❌ Message processing failed: {e}")

            # Extract partial usage up to failure
            llm_usage = accumulator.extract_llm_usage()
            embedding_usage = accumulator.extract_embedding_usage()
            handler_token_usage = TokenAccumulator.merge_usage(
                llm_usage, embedding_usage
            )
            token_usage_proto = token_usage_to_proto(handler_token_usage)

            # Send error response
            error_response = agent_worker_pb2.ProcessMessageResponse(
                error=agent_worker_pb2.ProcessingError(
                    error_code="PROCESSING_FAILED",
                    error_message=str(e),
                    error_details={
                        "user_id": user_id,
                        "organization_id": str(org_id),
                        "processing_time_ms": str(
                            int((time.time() - start_time) * 1000)
                        ),
                    },
                    token_usage=token_usage_proto,
                ),
                timestamp=int(time.time() * 1000),
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
        context: grpc.aio.ServicerContext,
    ) -> agent_worker_pb2.CancelMessageResponse:
        """Cancel an in-progress message."""
        message_id = request.message_id

        if message_id in self.active_streams:
            self.active_streams[message_id] = True
            return agent_worker_pb2.CancelMessageResponse(
                success=True, message=f"Message {message_id} cancellation requested"
            )
        return agent_worker_pb2.CancelMessageResponse(
            success=False,
            message=f"Message {message_id} not found or already completed",
        )

    async def GeneratePlan(
        self,
        request: agent_worker_pb2.GeneratePlanRequest,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[agent_worker_pb2.GeneratePlanResponse]:
        """Generate autonomous plan for skill editor."""
        import uuid

        start_time = time.time()

        session_id = request.session_id if request.session_id else str(uuid.uuid4())

        def _make_progress(
            message: str, phase: str
        ) -> agent_worker_pb2.GeneratePlanResponse:
            """Create a progress response."""
            return agent_worker_pb2.GeneratePlanResponse(
                progress=agent_worker_pb2.PlanProgress(message=message, phase=phase),
                timestamp=int(time.time() * 1000),
            )

        def _make_error(
            error_code: str, error_message: str
        ) -> agent_worker_pb2.GeneratePlanResponse:
            """Create an error response."""
            return agent_worker_pb2.GeneratePlanResponse(
                error=agent_worker_pb2.ProcessingError(
                    error_code=error_code, error_message=error_message, can_retry=True
                ),
                timestamp=int(time.time() * 1000),
            )

        try:
            tool_provider = ToolProvider(
                api_key=request.user_api_key or "",
                organization_id=request.organization_id,
            )

            # Get agent descriptors for plan generation (replaces ManagedAgentsFactory.create_all_agents)
            managed_agents = get_builder_descriptors()
            capability_registry = self.capability_registry

            skill_inputs: list[SkillInputDefinition] = [
                SkillInputDefinition(
                    name=i.name, type=i.type or "text", required=i.required
                )
                for i in request.skill_inputs
            ]

            skill_outputs: list[SkillOutputDefinition] = [
                SkillOutputDefinition(name=o.name, type=o.type or "text")
                for o in request.skill_outputs
            ]

            previous_plan_json = request.previous_plan_json or None
            user_feedback = request.user_feedback or None
            task_instructions = request.instructions

            # Extract configured tools appendix from instructions
            configured_tools: list[dict[str, Any]] = []
            if "---CONFIGURED_TOOLS---" in task_instructions:
                parts = task_instructions.split("---CONFIGURED_TOOLS---", 1)
                task_instructions = parts[0].strip()
                try:
                    configured_tools = json.loads(parts[1].strip())
                    logger.info(
                        f"📋 GeneratePlan: Extracted {len(configured_tools)} configured tools"
                    )
                except json.JSONDecodeError:
                    logger.warning(
                        "📋 GeneratePlan: Failed to parse configured tools JSON"
                    )

            if request.session_id and request.answers:
                logger.info(
                    f"📋 GeneratePlan: Resuming session {session_id} with {len(request.answers)} answers"
                )
                yield _make_progress("Resuming with your answers...", "resuming")

                plan_session = await self.session_manager.get_plan_session(session_id)
                if not plan_session:
                    yield _make_error(
                        "SESSION_NOT_FOUND",
                        "Planning session expired. Please start over.",
                    )
                    return

                answers_dict = {a.question_id: a.answer for a in request.answers}
                if answers_dict:
                    answers_text = "\n".join(
                        [f"- {q}: {a}" for q, a in answers_dict.items()]
                    )
                    task_instructions = f"{plan_session.get('instructions', request.instructions)}\n\nUser clarifications:\n{answers_text}"
                    logger.info(
                        f"📋 GeneratePlan: Enhanced instructions with {len(answers_dict)} clarifications"
                    )

                await self.session_manager.remove_plan_session(session_id)

            # Append previous plan + user feedback for regeneration
            if previous_plan_json:
                task_instructions = f"{task_instructions}\n\nPrevious plan (revise based on feedback):\n{previous_plan_json}"
            if user_feedback:
                task_instructions = f"{task_instructions}\n\nUser feedback on previous plan:\n{user_feedback}"
            if previous_plan_json or user_feedback:
                logger.info(
                    "📋 GeneratePlan: Enhanced instructions with regeneration context"
                )

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
                planning_registry=self.planning_registry,
                token_accumulator=TokenAccumulator(),
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
                ]
                if skill_inputs
                else None,
                "skill_outputs": [
                    {"name": o.name, "type": o.type} for o in skill_outputs
                ]
                if skill_outputs
                else None,
                "is_template_generation": bool(skill_inputs),
                "configured_tools": configured_tools if configured_tools else None,
            }

            result = await generate_plan_node(
                cast(PlanExecuteState, plan_state), runtime
            )

            # Check for clarification
            result_events = result.get("events", [])
            for event in result_events:
                if isinstance(event, AwaitingClarificationEvent):
                    logger.info(
                        f"GeneratePlan: Needs clarification - {len(event.questions)} questions"
                    )

                    await self.session_manager.store_plan_session(
                        session_id,
                        {
                            "instructions": request.instructions,
                            "skill_inputs": skill_inputs,
                            "skill_outputs": skill_outputs,
                            "org_model": request.model,
                            "api_key": tool_provider.api_key,
                            "organization_id": tool_provider.organization_id,
                            "previous_plan_json": previous_plan_json,
                            "user_feedback": user_feedback,
                        },
                    )

                    questions_json = json.dumps(
                        format_clarifying_questions(event.questions)
                    )

                    yield agent_worker_pb2.GeneratePlanResponse(
                        awaiting_input=agent_worker_pb2.AwaitingInput(
                            input_type="questions",
                            title="Clarification Needed",
                            content=questions_json,
                            options=[],
                            session_id=session_id,
                        ),
                        timestamp=int(time.time() * 1000),
                    )
                    return

                elif isinstance(event, PlanCreatedEvent):
                    plan = event.plan
                    planning_time_ms = int((time.time() - start_time) * 1000)
                    logger.info(
                        f"GeneratePlan: Created plan {plan.id} with {len(plan.steps)} steps in {planning_time_ms}ms"
                    )

                    if not plan.steps:
                        logger.error(
                            "GeneratePlan: Plan has no steps - generation failed"
                        )
                        yield _make_error(
                            "PLAN_GENERATION_FAILED",
                            "Plan generation failed - no steps were created. Check that the model can access database context.",
                        )
                        return

                    yield self._make_plan_complete_response(plan, planning_time_ms)

            # Check for error
            if result.get("error"):
                yield _make_error("PLAN_GENERATION_FAILED", result["error"])

        except TimeoutError:
            logger.error(f"📋 GeneratePlan: Timed out after {request.timeout_seconds}s")
            yield _make_error("TIMEOUT", "Plan generation timed out")

        except Exception as e:
            logger.error(f"📋 GeneratePlan: Failed with error: {e}", exc_info=True)
            yield _make_error("INTERNAL_ERROR", str(e))

    def _make_plan_complete_response(
        self, plan: Plan, planning_time_ms: int
    ) -> agent_worker_pb2.GeneratePlanResponse:
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
                planning_time_ms=planning_time_ms,
            ),
            timestamp=int(time.time() * 1000),
        )
