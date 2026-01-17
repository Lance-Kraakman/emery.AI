"""Stateful gRPC chat service. DB operations handled by Next.js."""

import json
import logging
import os
import re
import time
import asyncio
import concurrent.futures
from typing import AsyncIterator, Optional, List, Dict, Any, TypedDict, Literal, TypeVar, Coroutine, TYPE_CHECKING

import grpc
from grpc import aio
from PIL import Image
import requests

from smolagents import ToolCallingAgent, AgentText
from smolagents.models import ChatMessage, MessageRole
from smolagents.memory import ActionStep, PlanningStep, FinalAnswerStep

from emery_agents.agents.interrupt_aware_agent import InterruptAwareToolCallingAgent
from emery_agents.agents.chat_planner_agent import create_chat_planner_agent
from emery_agents.agents.skill_builder_agent import create_skill_builder_agent
from emery_agents.agents.document_builder_agent import create_document_builder_agent
from emery_agents.agents.table_builder_agent import create_table_builder_agent
from emery_agents.agents.schema_builder_agent import create_schema_builder_agent
from emery_agents.agents.research_agent import create_research_agent
from emery_agents.clients import HuggingFaceInferenceClient
from emery_agents.tools.crud_tools import load_skill_crud, load_document_crud
from emery_agents.services.tool_provider import ToolProvider
from emery_agents.tools.skill_tool import SkillTool
from emery_agents.tools.tool_executor import create_tool_executor
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .mappers import ProtoMapper
from .mappers.message_mapper import (
    build_conversation_messages,
    has_images,
    extract_text_from_parts,
    download_image_from_url,
    proto_parts_to_smolagents_content
)
from .mappers.message_types import MessageContentList
from ..services.model_provider import SmolagentsModelProvider
from ..services.tool_loader import UnifiedToolLoader
from ..services.session_manager import SessionManager
from ..services.file_processor import process_file
from ..utils.error_classifier import classify_error
from ..utils.error_messages import ErrorSeverity
from ..utils.mention_parser import parse_agent_mention
from .mention_routing import handle_agent_mention_routing
from ..services.image_processor import ImageProcessor
from ..services.agent_factory import AgentFactory, AgentConfig
from ..services.token_usage_extractor import TokenUsageExtractor
from ..services.agent_executor import AgentExecutor
from ..services.skill_executor import SkillExecutorService
from ..services.plan_service import PlanService
from ..services.plan_step_executor import PlanStepExecutor
from ..services.execution_coordinator import (
    ExecutionCoordinator,
    CoordinatorMode,
    PlanCreatedEvent,
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    EvaluationCompletedEvent,
    ReplanTriggeredEvent,
    ExecutionBlockedEvent,
    GoalAchievedEvent,
    ExecutionCompletedEvent,
    DirectExecutionStartedEvent,
    AwaitingClarificationEvent,
    # Recovery events (confidence-based error handling)
    RecoveryAnalysisEvent,
    AutoFixStartedEvent,
    AutoFixCompletedEvent,
    RecoveryPlanProposedEvent,
    # Cascade planning events
    QuestionsCollectedEvent,
    SubPlanCreatedEvent,
    CascadingPlanCompleteEvent,
)
from ..models.planning_questions import QuestionAnswers
from ..agents.evaluator_agent import create_evaluator_factory
from ..models.plan import Plan, PlanStatus, create_plan
from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode
from ..tools.tool_modes import ToolMode, filter_tools_for_mode
from .message_processor import (
    extract_user_api_key_from_tools,
    extract_file_attachments,
    extract_images_from_message,
    extract_text_from_message,
    build_task_with_conversation_context,
)
from .step_converter import (
    extract_planning_step,
    extract_action_step,
    extract_final_step,
    build_skill_message,
)
from .coordinator_event_converter import convert_coordinator_event
from .response_types import (
    StepType,
    StepMetadata,
    StepProgressDict,
    ContentChunkDict,
    ErrorDetailsDict,
    ErrorDataDict,
    ErrorResponseDict,
    InterruptedResponseDict,
    InputOptionDict,
    AwaitingInputDataDict,
    AwaitingInputResponseDict,
    StreamResponseDict,
)
from .agents import ManagedAgentsFactory

if TYPE_CHECKING:
    from .generated.agent_worker_pb2 import AgentConfig, SkillConfig

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Type variable for generic async function return type
T = TypeVar('T')

# Constants for skill task building
INPUTS_HEADER = "\n\nInputs:"


def _populate_protobuf_map(proto_map, data: Dict[str, str]) -> None:
    """
    Explicitly populate a protobuf ScalarMap field.

    Protobuf map fields require field-by-field assignment, not dict assignment.
    This ensures proper serialization to the wire format.

    Args:
        proto_map: The protobuf ScalarMap field to populate
        data: Dictionary of string key-value pairs
    """
    for key, value in data.items():
        proto_map[key] = str(value)


# Shared thread pool for async operations to prevent deadlock
_async_thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=10, thread_name_prefix="grpc-async")

# Register cleanup handler for thread pool shutdown
import atexit
def _cleanup_thread_pool():
    """Cleanup handler for graceful thread pool shutdown."""
    _async_thread_pool.shutdown(wait=True, cancel_futures=False)
    logger.info("Chat processing thread pool shut down")

atexit.register(_cleanup_thread_pool)


def detect_stored_plan_from_skills(
    skills: Optional[List['agent_worker_pb2.SkillConfig']]
) -> Optional[Plan]:
    """
    Detect stored plan from skill configurations.

    Scans skills for agentic steps that have pre-approved execution plans.
    When found, the plan enables autonomous execution without HITL approval.

    Args:
        skills: List of SkillConfig proto messages from agent config

    Returns:
        Hydrated Plan object if found, None otherwise
    """
    if not skills:
        return None

    for skill in skills:
        # Check if skill has steps (DAG-based execution)
        if not skill.steps:
            continue

        for step in skill.steps:
            # Check if step has agentic config with a plan
            if not step.HasField('agentic_config'):
                continue

            agentic_config = step.agentic_config
            if not agentic_config.HasField('plan'):
                continue

            # Check if plan has an ID (empty proto message means no plan)
            if not agentic_config.plan.id:
                continue

            # Found a stored plan - hydrate it
            stored_plan = Plan.from_stored_proto(agentic_config.plan)
            logger.info(
                f"📋 Found stored plan '{stored_plan.id}' in skill '{skill.name}' "
                f"step '{step.name}' - enabling AUTONOMOUS mode"
            )
            return stored_plan

    return None


class ChatProcessingServiceImplementation(agent_worker_pb2_grpc.ChatProcessingServiceServicer):
    """
    gRPC service implementation for ChatProcessingService.

    Handles AI-only operations:
    - LLM response streaming using existing HuggingFace integration
    - Tool execution for agent-based responses
    - Managed agent delegation (skill_builder, document_builder)

    Does NOT handle:
    - Chat session management (Next.js)
    - Message persistence (Next.js)
    - User authentication (Next.js)
    """
    
    def __init__(self, organization_id: str = ""):
        # Fail fast if HF_TOKEN is not provided
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for ChatProcessingService. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        
        self.organization_id = organization_id  # Multi-tenant: org from request context
        self.proto_mapper = ProtoMapper()
        self.last_token_usage = None  # Store token usage from last agent execution
        self.active_streams: Dict[str, bool] = {}  # Track active message streams for cancellation

        # Initialize session manager for stateful agent persistence
        self.session_manager = SessionManager(
            idle_timeout=1800,  # 30 minutes
            max_lifetime=14400  # 4 hours
        )
        self.session_manager.start_cleanup_task()
        logger.info("✅ SessionManager initialized with automatic cleanup")


        # Initialize AI processing services - no database dependencies
        logger.info("Initializing ChatProcessingService with shared utilities")

        # Import services at runtime to avoid circular dependencies
        try:
            # Tool loader for converting ToolConfig to smolagents tools
            try:
                self.tool_loader = UnifiedToolLoader()
                logger.info("✅ UnifiedToolLoader initialized successfully")
            except ImportError as tool_error:
                logger.warning(f"⚠️ ToolRegistryRepository not available: {tool_error}")
                self.tool_loader = None

            # Model provider and AgentFactory (shared utilities)
            self.model_provider = SmolagentsModelProvider()
            self.agent_factory = AgentFactory(self.model_provider)
            self.managed_agents_factory = ManagedAgentsFactory(self.model_provider)
            logger.info("✅ AgentFactory and ManagedAgentsFactory initialized successfully")

            # SkillExecutorService for shared skill execution logic
            self.skill_executor_service = SkillExecutorService(
                tool_loader=self.tool_loader,
                agent_factory=self.agent_factory
            )
            logger.info("✅ SkillExecutorService initialized successfully")

            # PlanService for goal/plan tracking and persistence
            # AIDEV-NOTE: Plans track complex task execution with nested sub-goals
            self.plan_service = PlanService(
                grpc_client=None,  # TODO: Wire gRPC client for persistence
                model_provider=self.model_provider,
            )
            logger.info("✅ PlanService initialized (in-memory mode)")

            # Inference client for operation skills (lazy initialization)
            self._inference_client: Optional[HuggingFaceInferenceClient] = None

            logger.info("✅ ChatProcessingService initialized successfully")

        except ImportError as e:
            logger.error(f"❌ Failed to import core services: {e}")
            self.tool_loader = None
            self.model_provider = None
            self.agent_factory = None

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

        # Register message stream for cancellation tracking
        self.active_streams[message_id] = False  # False = not cancelled
        logger.info(f"🚀 Processing message {message_id} for user {user_id} in org {org_id} (session: {session_id})")

        # Extract text preview for logging
        text_preview = extract_text_from_parts(message_parts)
        has_image_content = has_images(message_parts)
        logger.info(f"📝 Message preview: {text_preview[:100]}...")
        if has_image_content:
            logger.info(f"🖼️ Message contains images")

        # Extract file attachments (audio, PDFs) for skill context injection
        # AIDEV-NOTE: Don't add to session here - session may not exist yet (created lazily)
        # Attachments are passed to _stream_tool_calling_agent_response and added after session creation
        file_attachments = extract_file_attachments(message_parts)
        if file_attachments:
            logger.info(f"📎 Extracted {len(file_attachments)} file attachments")

        # Extract tools and skills from AgentConfig
        # ChatProcessingRequest is protobuf - message fields are None if not set
        # Access directly and check truthiness
        agent_config = request.agent_config if request.agent_config else None

        if agent_config:
            tools_count = len(agent_config.tools) if agent_config.tools else 0
            skills_count = len(agent_config.skills) if agent_config.skills else 0
            logger.info(f"🔧 AgentConfig provided: {tools_count} tools, {skills_count} skills")
        else:
            logger.info(f"⚠️ No AgentConfig provided, using empty tools")

        try:
            # 1. Build Conversation Context using mapper
            # Converts protobuf MessageParts to HuggingFace format
            # AIDEV-NOTE: Now async to support file processing (PDFs, audio, documents)
            conversation_messages = await build_conversation_messages(
                request.conversation_history,
                message_parts
            )

            logger.info(f"💬 Built conversation with {len(conversation_messages)} messages (HF format)")

            # 3. Generate AI Response using ToolCallingAgent (always)
            sequence = 0
            total_content = ""
            current_plan_data: Dict[str, Any] | None = None  # Plan metadata from _stream_tool_calling_agent_response

            # Extract tools from AgentConfig
            tools_to_use = []
            skills_to_use = []

            if agent_config:
                tools_to_use = list(agent_config.tools) if agent_config.tools else []
                skills_to_use = list(agent_config.skills) if agent_config.skills else []

                logger.info(f"📨 AgentConfig tools received: {len(tools_to_use)} tools")
                if tools_to_use:
                    for i, tool in enumerate(tools_to_use):
                        logger.info(f"  Tool {i}: name={tool.name}, config_keys={list(tool.config.keys()) if tool.config else 'none'}")

                logger.info(f"🎯 AgentConfig skills received: {len(skills_to_use)} skills")
                if skills_to_use:
                    for i, skill in enumerate(skills_to_use):
                        logger.info(f"  Skill {i}: name={skill.name}, tools={len(skill.tools) if skill.tools else 0}")
            else:
                logger.info("  No AgentConfig received from frontend")

            # Extract organization model from request (if provided)
            org_model = request.model if request.model else None
            if org_model:
                logger.info(f"🔧 Using organization model override: {org_model}")
            else:
                logger.info("🔧 No organization model specified, will use system default")

            # Extract user API key from request (for managed agents like skill_builder)
            # Protobuf string field - empty string if not set
            user_api_key = request.user_api_key or None
            if user_api_key:
                logger.info(f"🔑 User API key provided for managed agents")
            else:
                logger.warning("⚠️ No user API key provided - managed agents may fail auth")

            async for response_dict in self._stream_tool_calling_agent_response(
                conversation_messages,
                tools_to_use,
                domain_context=request.context,
                org_model=org_model,
                has_images=has_image_content,
                session_id=session_id,
                user_id=user_id,
                org_id=org_id,
                conversation_history=request.conversation_history,
                agent_config=agent_config,  # Pass agent_config for skill execution
                user_api_key=user_api_key,  # User API key for managed agents
                file_attachments=file_attachments  # File attachments for skill context injection
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

                # Handle different response types from streaming
                if isinstance(response_dict, dict):
                    response_type = response_dict.get("type")

                    if response_type == "step_progress":
                        # Send step progress update
                        step_type_map = {
                            "PLANNING": agent_worker_pb2.STEP_PLANNING,
                            "ACTION": agent_worker_pb2.STEP_ACTION,
                            "REASONING": agent_worker_pb2.STEP_REASONING,
                            "FINAL": agent_worker_pb2.STEP_FINAL
                        }

                        logger.debug(f"📤 Creating StepProgress protobuf message: type={response_dict.get('step_type')}, name={response_dict.get('step_name')}")

                        # Create StepProgress message without metadata
                        step_progress_msg = agent_worker_pb2.StepProgress(
                            step_type=step_type_map.get(response_dict.get("step_type"), agent_worker_pb2.STEP_PLANNING),
                            step_name=response_dict.get("step_name", ""),
                            content=response_dict.get("content", ""),
                            step_index=response_dict.get("step_index", 0)
                        )

                        # Explicitly populate metadata map field (protobuf requires field-by-field assignment)
                        metadata = response_dict.get("metadata", {})
                        if metadata:
                            logger.debug(f"📦 Populating metadata with {len(metadata)} fields: {list(metadata.keys())}")
                            _populate_protobuf_map(step_progress_msg.metadata, metadata)
                        else:
                            logger.debug("📦 No metadata to populate")

                        # Create response with properly populated step_progress
                        step_response = agent_worker_pb2.ProcessMessageResponse(
                            step_progress=step_progress_msg,
                            timestamp=int(time.time() * 1000)
                        )
                        logger.debug(f"✅ Yielding StepProgress message to gRPC client")
                        yield step_response

                    elif response_type == "content_chunk":
                        # Send content chunk (final answer text)
                        # Type assertion: we know this is ContentChunkDict
                        chunk_resp = response_dict  # type: ContentChunkDict
                        chunk = chunk_resp["content"]
                        total_content += chunk

                        chunk_response = agent_worker_pb2.ProcessMessageResponse(
                            content_chunk=agent_worker_pb2.ContentChunk(
                                content=chunk,
                                sequence=sequence
                            ),
                            timestamp=int(time.time() * 1000)
                        )
                        yield chunk_response
                        sequence += 1

                    elif response_type == "error":
                        # Send error response from agent execution
                        # Type assertion: we know this is ErrorResponseDict from _stream_tool_calling_agent_response
                        error_resp = response_dict  # type: ErrorResponseDict
                        error_data: ErrorDataDict = error_resp["error"]

                        error_response = agent_worker_pb2.ProcessMessageResponse(
                            error=agent_worker_pb2.ProcessingError(
                                error_code=error_data["error_code"],
                                error_message=error_data["error_message"],
                                error_details=error_data["error_details"],
                                hint=error_data["hint"],
                                can_retry=error_data["can_retry"],
                                auto_retry=error_data["auto_retry"],
                                session_reset=error_data["session_reset"]
                            ),
                            timestamp=int(time.time() * 1000)
                        )
                        yield error_response
                        # Stop processing after error
                        break

                    elif response_type == "interrupted":
                        # HITL interrupt - agent paused for user approval
                        # Send as final content chunk with the interrupt message
                        # Session preserved for resumption on next message
                        interrupt_resp = response_dict  # type: InterruptedResponseDict
                        logger.info(f"⏸️ Sending interrupt response to client: {interrupt_resp['message']}")

                        # Stream the interrupt message as content
                        interrupt_response = agent_worker_pb2.ProcessMessageResponse(
                            content_chunk=agent_worker_pb2.ContentChunk(
                                content=f"\n\n{interrupt_resp['message']}",
                                sequence=sequence
                            ),
                            timestamp=int(time.time() * 1000)
                        )
                        yield interrupt_response
                        sequence += 1
                        # Don't break - let it fall through to completion marker
                        # Session remains active for user to respond and resume

                    elif response_type == "awaiting_input":
                        # HITL: Agent needs user input (plan approval or question)
                        # AIDEV-NOTE: This is the unified HITL mechanism for all agents
                        awaiting_resp = response_dict  # type: AwaitingInputResponseDict
                        data = awaiting_resp["data"]
                        logger.info(f"⏸️ Agent awaiting input: type={data.get('input_type')}, title={data.get('title')}")

                        # Build InputOption messages for proto
                        input_options = []
                        for opt in data.get("options", []):
                            input_options.append(agent_worker_pb2.InputOption(
                                id=opt.get("id", ""),
                                label=opt.get("label", ""),
                                description=opt.get("description", "")
                            ))

                        # Send AwaitingInput response
                        awaiting_input_response = agent_worker_pb2.ProcessMessageResponse(
                            awaiting_input=agent_worker_pb2.AwaitingInput(
                                input_type=data.get("input_type", "question"),
                                title=data.get("title", ""),
                                content=data.get("content", ""),
                                options=input_options,
                                plan_json=data.get("plan_json", "")
                            ),
                            timestamp=int(time.time() * 1000)
                        )
                        yield awaiting_input_response
                        # Don't break - session remains active for user response

                    elif response_type == "plan_metadata":
                        # Capture plan metadata yielded from _stream_tool_calling_agent_response
                        # AIDEV-NOTE: Plan is defined inside the generator, so it yields plan data
                        # for inclusion in completion metadata
                        current_plan_data = response_dict.get("plan")
                        logger.info(f"📋 Captured plan metadata: {current_plan_data.get('id') if current_plan_data else 'None'}")

                    else:
                        # Unknown response type - log warning
                        logger.warning(f"⚠️ Unknown response type: {response_type}, ignoring")

            # 4. Send completion marker
            processing_time = int((time.time() - start_time) * 1000)

            # Convert stored token usage to protobuf using shared utility
            token_usage_proto = TokenUsageExtractor.to_proto(self.last_token_usage)

            # Get model name from token usage if available
            model_used = getattr(self.last_token_usage, 'model_name', '') if self.last_token_usage else ''

            # Build completion metadata
            completion_metadata = {
                'content_length': str(len(total_content)),
                'domain_type': request.context.domain_type if request.context else 'none'
            }

            # Include plan JSON if plan was created (for UI persistence)
            # AIDEV-NOTE: Plan stored in message metadata for history/audit trail
            # current_plan_data was captured from plan_metadata response yielded by _stream_tool_calling_agent_response
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
        """
        Cancel an in-progress message processing.

        Marks the message as cancelled so the streaming loop will stop gracefully.
        """
        message_id = request.message_id

        logger.info(f"🚫 Cancellation requested for message {message_id}")

        if message_id in self.active_streams:
            # Mark as cancelled
            self.active_streams[message_id] = True
            logger.info(f"✅ Message {message_id} marked for cancellation")

            return agent_worker_pb2.CancelMessageResponse(
                success=True,
                message=f"Message {message_id} cancellation requested"
            )
        else:
            logger.warning(f"⚠️ Message {message_id} not found in active streams")

            return agent_worker_pb2.CancelMessageResponse(
                success=False,
                message=f"Message {message_id} not found or already completed"
            )

    async def _stream_tool_calling_agent_response(
        self,
        conversation_messages: List[ChatMessage],
        tools: List['agent_worker_pb2.ToolConfig'],
        domain_context: Optional['agent_worker_pb2.ChatContext'] = None,
        org_model: Optional[str] = None,
        has_images: bool = False,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        org_id: Optional[int] = None,
        conversation_history: Optional[List] = None,
        agent_config: Optional['agent_worker_pb2.AgentConfig'] = None,
        user_api_key: Optional[str] = None,
        file_attachments: Optional[List['agent_worker_pb2.FileAttachment']] = None
    ) -> AsyncIterator[StreamResponseDict]:
        """
        Stream AI response using ToolCallingAgent with stateful session support.

        Session Management:
        - HOT PATH: Reuse existing agent from session (agent.memory persists)
        - COLD PATH: Create new agent and restore from conversation history

        AIDEV-NOTE: Accepts smolagents ChatMessage objects with PIL Image support.
        Smolagents handles conversion to HuggingFace API format internally.
        """

        # Reset thread-local state for new request
        # Prevents stale data from previous requests on thread reuse
        SkillTool.reset_call_stack()
        SkillTool.reset_result_cache()

        try:
            # 1. Convert protobuf tools to smolagents tools
            smolagents_tools = self._convert_tools_to_smolagents(
                tools, agent_config=agent_config, org_model=org_model, org_id=org_id, api_key=user_api_key
            )
            logger.info(f"🔧 Converted {len(smolagents_tools)} tools for ToolCallingAgent")

            # 2. Get or create agent with session management
            # HOT PATH: Check if agent exists in session
            logger.info(f"🔍 [SESSION-DEBUG] Checking for existing session: {session_id}")
            logger.info(f"🔍 [SESSION-DEBUG] Conversation history length: {len(conversation_history) if conversation_history else 0}")

            # Get effective API key BEFORE hot/cold path split
            # This is needed for tool provider regardless of hot/cold path
            effective_api_key = user_api_key or extract_user_api_key_from_tools(tools)
            if effective_api_key:
                logger.info(f"🔑 Using API key for tools (source: {'request' if user_api_key else 'tools'})")
            else:
                logger.warning("⚠️ No API key available for tools")

            # Create centralized tool provider - creates tools lazily with consistent auth
            tool_provider = ToolProvider(effective_api_key or "", org_id or 0)

            agent = self.session_manager.get_agent(session_id) if session_id else None

            if agent:
                # Agent exists in memory - HOT PATH (fast, memory persists)
                logger.info(f"♻️  [HOT-PATH] Reusing existing agent from session {session_id}")
                logger.info(f"🧠 [MEMORY-DEBUG] Agent memory has {len(agent.memory.steps)} steps")

                # Debug: Log memory step types
                step_types = [type(step).__name__ for step in agent.memory.steps]
                logger.info(f"🧠 [MEMORY-DEBUG] Step types: {step_types}")

                # Add new file attachments to existing session (for cross-message file access)
                if file_attachments and session_id:
                    self.session_manager.add_attachments(session_id, file_attachments)
                    logger.info(f"📎 Added {len(file_attachments)} new attachments to existing session")

            else:
                # Agent doesn't exist - COLD PATH (create + restore from history)
                logger.info(f"✨ [COLD-PATH] Creating new agent for session {session_id}")

                # Create managed agents using factory with centralized tool provider
                skill_builder_agent = self.managed_agents_factory.create_skill_builder(
                    tool_provider=tool_provider,
                    org_model=org_model
                )
                document_builder_agent = self.managed_agents_factory.create_document_builder(
                    tool_provider=tool_provider,
                    org_model=org_model
                )
                table_builder_agent = self.managed_agents_factory.create_table_builder(
                    tool_provider=tool_provider,
                    org_model=org_model
                )
                schema_builder_agent = self.managed_agents_factory.create_schema_builder(
                    tool_provider=tool_provider,
                    org_model=org_model
                )
                app_builder_agent = self.managed_agents_factory.create_app_builder(
                    tool_provider=tool_provider,
                    org_model=org_model
                )
                agent_builder_agent = self.managed_agents_factory.create_agent_builder(
                    tool_provider=tool_provider,
                    org_model=org_model
                )
                # Research agent may fail if ddgs package is missing - make it optional
                # Pass api_key and org_id so ResearchEmery is created as managed agent
                research_agent = None
                try:
                    research_agent = self.managed_agents_factory.create_research_agent(
                        api_key=tool_provider.api_key,
                        organization_id=tool_provider.organization_id,
                        org_model=org_model
                    )
                except ImportError as e:
                    logger.warning(f"Research agent unavailable (missing dependency): {e}")

                # Load user-defined agents (dynamically created from DB)
                # AIDEV-NOTE: This enables ChatPlanner to route to user agents via:
                # 1. Natural language ("use my sales bot") via managed_agents
                # 2. Template display (user_agents_metadata shows them in instructions)
                user_agent_executors, user_agents_metadata = await self.managed_agents_factory.load_user_agents(
                    tool_provider, org_model
                )

                # Create ToolCallingAgent with managed agents
                # InterruptAwareToolCallingAgent sets interrupt_switch=True
                # when detecting interrupt from managed agent, breaking the loop
                # Pass file_attachments so chat agent can see available files in session
                # Filter None values in case research_agent failed to create
                managed_agents = [a for a in [
                    skill_builder_agent, document_builder_agent,
                    table_builder_agent, schema_builder_agent,
                    app_builder_agent, agent_builder_agent, research_agent
                ] if a is not None]

                # Add user-defined agent executors to managed agents
                managed_agents.extend(user_agent_executors)
                logger.info(f"📋 Total managed agents: {len(managed_agents)} ({len(user_agent_executors)} user-defined)")

                agent = self.managed_agents_factory.create_chat_planner(
                    smolagents_tools,
                    org_model=org_model,
                    has_images=has_images,
                    managed_agents=managed_agents,
                    user_agents=user_agents_metadata,  # For template display
                    session_attachments=file_attachments
                )

                logger.info(f"🧠 [MEMORY-DEBUG] New agent created, memory steps: {len(agent.memory.steps)}")

                # Restore agent memory from conversation history if available
                if conversation_history and len(conversation_history) > 0:
                    logger.info(f"📚 [RESTORE-DEBUG] Restoring {len(conversation_history)} messages from history")
                    restored_count = await self.session_manager.restore_agent_from_history(
                        agent,
                        conversation_history
                    )
                    logger.info(f"📚 [RESTORE-DEBUG] Restored {restored_count} messages to agent memory")
                    logger.info(f"🧠 [MEMORY-DEBUG] After restoration, memory has {len(agent.memory.steps)} steps")

                    # Debug: Log first few steps
                    for i, step in enumerate(agent.memory.steps[:5]):
                        logger.info(f"🧠 [MEMORY-DEBUG] Step {i}: {type(step).__name__}")
                else:
                    logger.info(f"📚 [RESTORE-DEBUG] No conversation history to restore")

                # Register agent in session manager
                if session_id:
                    self.session_manager.register_agent(
                        session_id=session_id,
                        agent=agent,
                        organization_id=org_id or 0,
                        user_id=user_id or "",
                        restored_from_history=bool(conversation_history),
                        history_message_count=len(conversation_history) if conversation_history else 0
                    )
                    # Add file attachments to session AFTER session is created
                    # This enables cross-message file access for skills
                    if file_attachments:
                        self.session_manager.add_attachments(session_id, file_attachments)
                        logger.info(f"📎 Added {len(file_attachments)} attachments to session")

                    # Also restore file attachments from conversation history (cold path)
                    # This makes files from previous messages available to skills
                    if conversation_history:
                        history_attachments = self.session_manager.extract_file_attachments_from_history(
                            conversation_history
                        )
                        if history_attachments:
                            self.session_manager.add_attachments(session_id, history_attachments)
                            logger.info(f"📎 Restored {len(history_attachments)} attachments from history")

            logger.info(f"🤖 Using ToolCallingAgent with {len(smolagents_tools)} tools")
            logger.info(f"🧠 [MEMORY-DEBUG] Final agent memory before execution: {len(agent.memory.steps)} steps")

            # Debug: Verify managed agents are set up correctly
            logger.info(f"📋 [MANAGED-AGENTS-DEBUG] Managed agents dict: {list(agent.managed_agents.keys())}")
            if agent.managed_agents:
                logger.info(f"📋 [MANAGED-AGENTS-DEBUG] System prompt includes 'team members': {'team members' in agent.system_prompt.lower()}")
                logger.info(f"📋 [MANAGED-AGENTS-DEBUG] System prompt preview (first 1500 chars):\n{agent.system_prompt[:1500]}")

            # 4. Extract current user message (last message in conversation)
            # AIDEV-NOTE: With reset=False, agent.memory persists, so we only need the current message
            last_message = conversation_messages[-1] if conversation_messages else None

            # Extract images from last message (smolagents limitation - only last message images)
            images = extract_images_from_message(last_message) if last_message else []

            # Extract current user message text (agent.memory has conversation history)
            current_task = extract_text_from_message(last_message) if last_message else "Continue the conversation"

            logger.info(f"🖼️ Extracted {len(images)} images from last message")
            logger.info(f"💬 Current task: {len(current_task)} chars")
            logger.info(f"🧠 Agent memory: {len(agent.memory.steps)} steps")

            # === @AGENT MENTION DETECTION ===
            # Parse @agent:name mention to route directly to user-defined agents
            cleaned_task, agent_mention = parse_agent_mention(current_task)
            if agent_mention:
                logger.info(f"🎯 Detected @agent mention: '{agent_mention}'")
                async for event in handle_agent_mention_routing(
                    agent_mention=agent_mention,
                    task=cleaned_task,
                    tool_provider=tool_provider,
                    model_provider=self.model_provider,
                    skill_executor_service=self.skill_executor_service,
                    org_model=org_model,
                    images=images,
                ):
                    yield event
                return  # Agent mention handled - don't continue to normal flow

            # 6. Execute with ToolCallingAgent with real streaming
            # AIDEV-NOTE: skill_builder is a managed_agent - smolagents routes automatically
            # InterruptAwareToolCallingAgent handles interrupt propagation from managed agents
            logger.info("🚀 Executing ToolCallingAgent with stream=True...")

            step_index = 0
            final_answer_text = ""

            # Check coordinator phase FIRST to avoid creating plans for approval messages
            # Coordinator internally decides mode: PASSTHROUGH, DIRECT, or PLAN_AND_APPROVE
            coordinator_phase = self.session_manager.get_coordinator_phase(session_id) if session_id else "idle"

            # Handle clarification response: combine original task + clarification and re-plan
            # AIDEV-NOTE: When user answers clarifying questions, we combine their response
            # with the original task and re-run the coordinator to create a proper plan
            if coordinator_phase == "awaiting_clarification" and session_id:
                original_task = self.session_manager.get_original_task(session_id)
                if original_task:
                    # Combine original task with user's clarification response
                    current_task = f"{original_task}\n\nUser's clarification: {current_task}"
                    logger.info(f"📋 Combined original task with clarification, re-running coordinator")
                # Reset phase to idle so coordinator will run fresh with combined context
                self.session_manager.clear_coordinator_state(session_id)
                coordinator_phase = "idle"

            # Create Plan for tracking this execution
            # AIDEV-NOTE: Plan provides visibility into complex task progress and enables HITL
            # Only create for new tasks (idle phase), not for approvals or ongoing execution
            current_plan: Plan | None = None
            if agent.managed_agents and coordinator_phase == "idle":  # Only for new tasks
                current_plan = create_plan(
                    goal=current_task[:200] if len(current_task) > 200 else current_task,
                    basic_instructions=current_task
                )
                logger.info(f"📋 Created plan {current_plan.id} for task: {current_plan.goal[:100]}...")

            # Set execution context for skill tools to access file attachments
            # This enables _inject_context_inputs() in SkillTool to inject audio/image bytes
            #
            # File selection logic:
            # - attachments: Current message files (DEFAULT for skill inputs)
            # - session_attachments: All session files (for explicit filename lookup)
            #
            # When LLM doesn't specify a filename → uses current message file
            # When LLM specifies a filename → searches session_attachments by name
            session_attachments = self.session_manager.get_attachments(session_id) if session_id else []

            # Collect nested skill steps for streaming to UI after skill completes
            # AIDEV-NOTE: Steps collected during synchronous skill execution, yielded after
            collected_nested_steps: List[Dict[str, Any]] = []

            def progress_callback(step_dict: Dict[str, Any]) -> None:
                """Callback for nested skill progress - collects steps for later yielding."""
                step_dict['nested'] = True  # Mark as nested for UI rendering
                collected_nested_steps.append(step_dict)
                logger.info(f"📥 Collected nested step: {step_dict.get('step_name', 'unknown')}")

            context = ExecutionContext(
                mode=ExecutionMode.INTERACTIVE,  # Chat = interactive (with HITL)
                task=current_task,
                available_tools=[],
                images=[],  # Images already passed via smolagents images param
                attachments=file_attachments or [],  # Current message files (default)
                session_attachments=session_attachments,  # All session files (for explicit lookup)
                progress_callback=progress_callback,  # For nested skill step visibility
                tool_mode=ToolMode.EXECUTION,  # Default: allow mutations
                api_key=tool_provider.api_key,  # For any direct auth needs
                organization_id=str(tool_provider.organization_id),  # For RLS context (str type)
                tool_provider=tool_provider,  # Centralized tool creation
            )
            AgentExecutor.set_current_context(context)
            logger.info(f"📎 Set execution context: {len(file_attachments or [])} current, {len(session_attachments)} session files")

            # Get managed agents for coordinator's mode detection
            # (coordinator_phase already set earlier, before plan creation)
            # Extract agent objects (values) from the managed_agents dict, not keys
            managed_agents = []
            if hasattr(agent, 'managed_agents') and agent.managed_agents:
                managed_agents = list(agent.managed_agents.values())

            # Detect stored plan from agent config skills
            # If found, enables autonomous execution (skip HITL approval)
            stored_plan = None
            if agent_config and agent_config.skills:
                stored_plan = detect_stored_plan_from_skills(list(agent_config.skills))

            # Coordinator handles all execution paths
            should_fall_through = False
            async for event in self._stream_coordinator_response(
                context=context,
                tools=smolagents_tools,
                task=current_task,
                session_id=session_id,
                org_model=org_model,
                coordinator_phase=coordinator_phase,
                managed_agents=managed_agents,
                stored_plan=stored_plan,  # Pass stored plan for autonomous execution
            ):
                if isinstance(event, dict):
                    # Regular event - yield it
                    yield event
                elif event == "FALL_THROUGH":
                    # Signal to continue with normal agent flow
                    should_fall_through = True

            if not should_fall_through:
                return  # Coordinator handled everything

            # Use stream=True for real-time step-by-step progress
            # Pass images via official smolagents API (images parameter)
            # AIDEV-NOTE: smolagents only supports images from the last message, not conversation history
            # AIDEV-NOTE: reset=False for stateful sessions - agent.memory persists between messages
            for step in agent.run(
                task=current_task,  # Only current message (agent.memory has conversation history)
                stream=True,
                images=images if images else None,  # Official API for passing PIL Images
                reset=False  # Keep agent memory for stateful sessions
            ):
                logger.info(f"📊 Step {step_index}: {type(step).__name__}")

                # Use typed extraction helpers (no hasattr checks)
                step_data: StepProgressDict | None = None

                if isinstance(step, PlanningStep):
                    step_data = extract_planning_step(step, step_index)
                    logger.info(f"🧠 Planning: {step_data['content'][:100]}...")

                elif isinstance(step, ActionStep):
                    # Skip showing final_answer tool call - it's internal machinery
                    # The FinalAnswerStep will show the actual content
                    if step.tool_calls and len(step.tool_calls) > 0:
                        if step.tool_calls[0].name == "final_answer":
                            step_index += 1
                            continue

                    step_data = extract_action_step(step, step_index)
                    logger.info(f"🔧 Action: {step_data['step_name']}")

                    # Yield collected nested steps from skill execution (if any)
                    # AIDEV-NOTE: Nested steps were collected during synchronous skill.forward()
                    if collected_nested_steps:
                        logger.info(f"📤 Yielding {len(collected_nested_steps)} nested steps from skill execution")
                        for nested_step in collected_nested_steps:
                            nested_step_data: StepProgressDict = {
                                "type": "step_progress",
                                "step_type": nested_step.get('type', 'ACTION').upper(),
                                "step_name": nested_step.get('step_name', 'Nested step'),
                                "content": nested_step.get('content', ''),
                                "metadata": nested_step.get('metadata', {}),
                                "step_index": step_index  # Use parent step index for ordering
                            }
                            yield nested_step_data
                        collected_nested_steps.clear()

                elif isinstance(step, (FinalAnswerStep, AgentText)):
                    # Extract final step indicator
                    step_data = extract_final_step(step_index)

                    # Extract final answer text
                    if isinstance(step, FinalAnswerStep):
                        logger.debug(f"FinalAnswerStep attributes: {dir(step)}")
                        final_answer_text = str(step.output)  # Fixed: use 'output' not 'answer'
                    else:
                        final_answer_text = str(step)

                    logger.info(f"✅ Final answer: {len(final_answer_text)} chars")

                    # Yield step indicator
                    yield step_data

                    # Stream final answer as content chunks
                    async for chunk in self._stream_text_chunks(final_answer_text):
                        content_chunk: ContentChunkDict = {
                            "type": "content_chunk",
                            "content": chunk
                        }
                        yield content_chunk

                    step_index += 1
                    continue

                # Yield step progress for non-final steps
                if step_data:
                    logger.debug(f"Yielding step {step_index}: type={step_data['step_type']}, name={step_data['step_name']}")
                    yield step_data

                step_index += 1

            # Clear execution context after agent completes
            if file_attachments:
                AgentExecutor.set_current_context(None)
                logger.debug("📎 Cleared execution context")

            # Log summary of collected steps
            logger.info(f"✅ Completed streaming with {step_index} steps")

            # Debug: Log agent memory state after execution
            logger.info(f"🧠 [MEMORY-DEBUG] After execution, agent memory has {len(agent.memory.steps)} steps")
            step_types_after = [type(step).__name__ for step in agent.memory.steps]
            logger.info(f"🧠 [MEMORY-DEBUG] Step types after execution: {step_types_after}")

            # Extract token usage after execution completes
            self.last_token_usage = self._extract_token_usage_from_agent(agent)
            if self.last_token_usage:
                logger.info(f"💰 Token usage captured: {self.last_token_usage.total_tokens} tokens, ${self.last_token_usage.cost_usd:.6f}")
            else:
                logger.warning("⚠️ No token usage found in agent memory")

            logger.info(f"✅ Completed streaming with {step_index} steps")

            # Yield plan metadata for ProcessMessage to include in completion
            # AIDEV-NOTE: current_plan is defined in this method but completion code
            # is in ProcessMessage - yield it as a special response type
            if current_plan:
                # AIDEV-NOTE: Plan.status and PlanStep.status are already strings (not enums)
                # See models/plan.py: status: str = PlanStatus.DRAFT.value
                plan_metadata: Dict[str, Any] = {
                    "type": "plan_metadata",
                    "plan": {
                        'id': current_plan.id,
                        'goal': current_plan.goal,
                        'status': current_plan.status,
                        'steps': [
                            {
                                'id': step.step_id,
                                'description': step.description,
                                'status': step.status,
                                'tool_call': step.tool_call,
                                'result': step.result
                            }
                            for step in current_plan.steps
                        ],
                        'generated_at': current_plan.generated_at.isoformat() if current_plan.generated_at else None,
                        'approved_at': current_plan.approved_at.isoformat() if current_plan.approved_at else None
                    }
                }
                yield plan_metadata
                logger.info(f"📋 Yielded plan metadata for {current_plan.id}")

        except Exception as e:
            # ============================================================
            # Check for HITL Interrupt (not an error - pause for user approval)
            # ============================================================
            # Pattern matches smolagents' official plan_customization example
            if "interrupted" in str(e).lower():
                logger.info("⏸️ Agent interrupted for user approval (HITL workflow)")

                # Extract the plan from agent memory to show user what they're approving
                # AIDEV-NOTE: Plan may be in parent agent memory OR managed agent memory
                # depending on which agent created the plan (skill_builder stores in its own memory)
                plan_content = None

                # First check parent agent memory
                for step in reversed(agent.memory.steps):
                    if hasattr(step, 'plan') and step.plan:
                        plan_content = step.plan
                        logger.info(f"📋 Found plan in parent agent memory ({len(plan_content)} chars)")
                        break

                # If not found, check managed agents' memory (for HITL workflows like skill_builder)
                if not plan_content and hasattr(agent, 'managed_agents'):
                    for name, managed_agent in agent.managed_agents.items():
                        if hasattr(managed_agent, 'memory') and managed_agent.memory:
                            for step in reversed(managed_agent.memory.steps):
                                if hasattr(step, 'plan') and step.plan:
                                    plan_content = step.plan
                                    logger.info(f"📋 Found plan in {name} agent memory ({len(plan_content)} chars)")
                                    break
                        if plan_content:
                            break

                # Build structured awaiting_input response for UI
                # AIDEV-NOTE: Use awaiting_input instead of interrupted to render
                # structured approval UI with keyboard navigation
                awaiting_input_response: AwaitingInputResponseDict = {
                    "type": "awaiting_input",
                    "data": {
                        "input_type": "plan_approval",
                        "title": "Proposed Plan",
                        "content": plan_content or "Waiting for your approval to proceed.",
                        "options": [
                            {"id": "approve", "label": "Approve", "description": "Execute the plan as-is"}
                        ],
                        "plan_json": ""
                    }
                }
                yield awaiting_input_response
                return

            # ============================================================
            # Comprehensive Error Recovery System
            # ============================================================

            # 1. Classify error into user-friendly type
            error_info = classify_error(e)

            # 2. Log technical details to console ONLY (never show to user)
            logger.error(f"❌ Agent execution failed: {error_info.technical_details}", exc_info=True)
            logger.error(f"📊 Error classification: type={error_info.error_type}, "
                        f"severity={error_info.severity.value}, "
                        f"can_retry={error_info.can_retry}")

            # 3. Handle based on error severity
            session_was_reset = False

            if error_info.severity == ErrorSeverity.TRANSIENT:
                # TRANSIENT errors: Auto-retry not implemented in current flow
                # (would require recursion/loop which could complicate streaming)
                # Instead, we allow manual retry with preserved session
                logger.info(f"⏳ Transient error detected: {error_info.error_type}")
                logger.info("💡 Session preserved for manual retry")

            elif error_info.severity == ErrorSeverity.RECOVERABLE:
                # RECOVERABLE errors: Clear agent memory but keep session
                if session_id:
                    logger.info(f"🔄 Recoverable error - clearing agent memory for session {session_id}")
                    self.session_manager.reset_agent_memory(session_id)
                    self.session_manager.increment_error_count(session_id, error_info.error_type)

                    # Check if error threshold exceeded
                    if self.session_manager.should_remove_session_on_error(session_id):
                        logger.warning(f"🚨 Error threshold exceeded - removing session {session_id}")
                        await self.session_manager.remove_session_on_error(session_id, "error_threshold")
                        session_was_reset = True
                else:
                    logger.warning("⚠️ No session_id provided - cannot track errors")

            elif error_info.severity == ErrorSeverity.FATAL:
                # FATAL errors: Remove session entirely
                if session_id:
                    logger.error(f"💀 Fatal error - removing session {session_id}")
                    await self.session_manager.remove_session_on_error(session_id, error_info.error_type)
                    session_was_reset = True

            # 4. Send user-friendly error (NO technical details)
            error_details: ErrorDetailsDict = {
                "severity": error_info.severity.value
            }
            error_data: ErrorDataDict = {
                "error_code": error_info.error_type,
                "error_message": error_info.user_message,
                "error_details": error_details,
                "hint": error_info.hint or "",
                "can_retry": error_info.can_retry,
                "auto_retry": False,  # Auto-retry not implemented in current flow
                "session_reset": session_was_reset
            }
            error_response: ErrorResponseDict = {
                "type": "error",
                "error": error_data
            }
            yield error_response

            logger.info(f"📨 Sent user-friendly error message (type={error_info.error_type})")

        finally:
            # Reset error count on successful completion (if we got here without error)
            if session_id and 'error_info' not in locals():
                self.session_manager.reset_error_count(session_id)

    def _convert_tools_to_smolagents(
        self,
        tools: List['agent_worker_pb2.ToolConfig'],
        agent_config: Optional['agent_worker_pb2.AgentConfig'] = None,
        org_model: Optional[str] = None,
        org_id: Optional[int] = None,
        api_key: Optional[str] = None
    ) -> List[Any]:
        """
        Convert protobuf ToolConfig objects to smolagents tools using shared utility.

        Args:
            tools: List of ToolConfig proto objects
            agent_config: Optional AgentConfig containing skills for skill execution
            org_model: Organization default model (used as fallback for skills)
            org_id: Organization ID for CRUD tool authentication
            api_key: API key for output mapping in SkillTools

        Returns:
            List of loaded tool instances (including SkillTools)
        """
        if not self.tool_loader:
            logger.error("❌ Tool registry not available - tools cannot be loaded")
            return []

        # Create skill execution callback if agent_config has skills
        skill_executor = None
        if agent_config and agent_config.skills:
            skill_executor = self.skill_executor_service.create_executor_callback(
                org_model=org_model,
                return_message_parts=True,  # Chat mode returns MessageParts JSON
                api_key=api_key,
                organization_id=org_id
            )

        # Create inference client for operation skills (direct HF API calls)
        # Check if any skills use operation execution type
        inference_client = None
        if agent_config and agent_config.skills:
            has_operation_skills = any(
                s.execution_type == 'operation'
                for s in agent_config.skills
            )
            if has_operation_skills:
                inference_client = self._get_or_create_inference_client()
                logger.info(f"🔧 Created inference client for operation skills")

        # Use consolidated load_tools_from_configs method
        return self.tool_loader.load_tools_from_configs(
            tool_configs=tools,
            api_key=api_key,  # Pass API key for SkillTool output mappings
            api_key_mode="user",  # Chat system uses user API key mode
            agent_config=agent_config,
            skill_executor=skill_executor,
            organization_id=org_id,  # Pass organization ID for CRUD tools
            inference_client=inference_client  # Pass inference client for operation skills
        )

    def _get_or_create_inference_client(self):
        """
        Get or create the HuggingFace inference client for operation skills.

        Lazily creates the client on first use to avoid unnecessary initialization
        when no operation skills are present.

        Returns:
            HuggingFaceInferenceClient instance
        """
        # Lazy initialization - _inference_client is None until first use
        if self._inference_client is None:
            self._inference_client = HuggingFaceInferenceClient()
        return self._inference_client

    async def _stream_text_chunks(self, text: str, chunk_size: int = 5) -> AsyncIterator[str]:
        """Stream text by word chunks to simulate streaming."""
        words = text.split()
        for i in range(0, len(words), chunk_size):
            chunk = ' '.join(words[i:i + chunk_size]) + ' '
            yield chunk
            await asyncio.sleep(0.05)  # Small delay for realistic streaming feel

    def _extract_token_usage_from_agent(self, agent) -> Optional[Any]:
        """Extract accumulated token usage from agent's memory steps using shared utility."""
        return TokenUsageExtractor.extract_from_agent_memory(agent=agent)

    # ============================================================
    # ExecutionCoordinator Integration - Two-Phase Execution
    # ============================================================

    async def _stream_coordinator_response(
        self,
        context: ExecutionContext,
        tools: List[Any],
        task: str,
        session_id: Optional[str],
        org_model: Optional[str],
        coordinator_phase: str,
        managed_agents: Optional[List[Any]] = None,
        stored_plan: Optional[Plan] = None,
    ) -> AsyncIterator[Any]:
        """
        Coordinator-driven execution path.

        The coordinator internally decides the mode:
        - PASSTHROUGH: Single managed agent task (agent has own HITL)
        - DIRECT: Simple task, execute without plan
        - PLAN_AND_APPROVE: Complex task, create plan and await approval
        - AUTONOMOUS: Pre-approved stored plan, execute directly (skip HITL)

        Args:
            context: Execution context with tool_mode
            tools: Available smolagents tools
            task: Current user message/task
            session_id: Session ID for state persistence
            org_model: Organization model for evaluator
            coordinator_phase: Current phase from session
            managed_agents: Available managed agents for mode detection
            stored_plan: Pre-approved plan from skill's agentic step config (enables autonomous execution)
        """
        # === AUTONOMOUS MODE: Execute stored plan directly ===
        if stored_plan and coordinator_phase == "idle":
            logger.info(f"📋 Coordinator: AUTONOMOUS mode - executing stored plan '{stored_plan.id}' directly")

            # Create coordinator for execution
            model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()
            evaluator_factory = create_evaluator_factory(model)

            # Get managed agents as list for step executor
            if managed_agents:
                if isinstance(managed_agents, dict):
                    managed_agents_list = list(managed_agents.values())
                else:
                    managed_agents_list = list(managed_agents)
            else:
                managed_agents_list = []

            plan_step_executor = PlanStepExecutor(
                tools=tools,
                managed_agents=managed_agents_list,
                model=model,
                max_steps=10,
            )

            context_tools = context.tool_provider.get_context_tools() if context.tool_provider else []

            # Create agent factories for cascade planning (even if not used for autonomous mode)
            agent_factories = None
            if context.tool_provider:
                agent_factories = self.managed_agents_factory.get_agent_factories(
                    tool_provider=context.tool_provider,
                    org_model=org_model
                )

            coordinator = ExecutionCoordinator(
                plan_service=self.plan_service,
                model_provider=self.model_provider,
                evaluator_factory=evaluator_factory,
                plan_step_executor=plan_step_executor,
                evaluate_after_steps=1,
                max_replans=3,
                org_model=org_model,
                context_tools=context_tools,
            )

            # Execute stored plan directly (no classification, no approval)
            async for event in coordinator.execute(
                task=task,
                tools=tools,
                managed_agents=managed_agents,
                stored_plan=stored_plan,  # Pass stored plan for direct execution
                agent_factories=agent_factories,
            ):
                yield convert_coordinator_event(event, session_id)

            return

        if coordinator_phase == "idle":
            # === NEW REQUEST - Let coordinator determine mode ===
            logger.info("📋 Coordinator: Analyzing task to determine execution mode...")

            # Create coordinator with evaluator and step executor
            # PlanService already has model_provider, org_model passed for hierarchy resolution
            model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()
            evaluator_factory = create_evaluator_factory(model)

            # Get managed agents as list for step executor
            # managed_agents may be a dict {name: agent} or already a list
            if managed_agents:
                if isinstance(managed_agents, dict):
                    managed_agents_list = list(managed_agents.values())
                else:
                    managed_agents_list = list(managed_agents)
            else:
                managed_agents_list = []

            # Create step executor with smolagents native routing
            plan_step_executor = PlanStepExecutor(
                tools=tools,
                managed_agents=managed_agents_list,
                model=model,
                max_steps=10,
            )

            # Get context-gathering tools from provider
            # These allow the planner to see existing databases/tables before creating a plan
            if context.tool_provider is None:
                logger.error("❌ ToolProvider not set on context - cannot create context tools")
                yield "FALL_THROUGH"
                return
            context_tools = context.tool_provider.get_context_tools()
            logger.info(f"📋 Using {len(context_tools)} context tools from provider for planner")

            # Create agent factories for cascade planning (SubAgentPlanner)
            agent_factories = self.managed_agents_factory.get_agent_factories(
                tool_provider=context.tool_provider,
                org_model=org_model
            )
            logger.info(f"📋 Created {len(agent_factories)} agent factories for cascade planning")

            coordinator = ExecutionCoordinator(
                plan_service=self.plan_service,
                model_provider=self.model_provider,  # For LLM-based TaskClassifier
                evaluator_factory=evaluator_factory,
                plan_step_executor=plan_step_executor,
                evaluate_after_steps=1,
                max_replans=3,
                org_model=org_model,
                context_tools=context_tools,
            )

            # Use smart execute to determine mode and handle accordingly
            plan: Optional[Plan] = None
            async for event in coordinator.execute(
                task=task,
                tools=tools,
                managed_agents=managed_agents,
                agent_factories=agent_factories,
            ):
                if isinstance(event, AwaitingClarificationEvent):
                    # Clarification needed: Show questions to user before proceeding
                    logger.info(f"📋 Coordinator: Task needs clarification - {len(event.questions)} questions")

                    # Format questions as markdown (don't show internal reasoning to users)
                    questions_content = ""
                    for q in event.questions:
                        questions_content += f"{q}\n"

                    yield {
                        "type": "awaiting_input",
                        "data": {
                            "input_type": "question",  # Use 'question' - frontend doesn't have 'clarifying_questions'
                            "title": "Clarification Needed",
                            "content": questions_content,
                            "options": [],  # Free-form response expected
                            "plan_json": ""
                        }
                    }

                    # Store that we're awaiting clarification (different from plan approval)
                    # Also store the original task so we can combine with clarification response
                    if session_id:
                        self.session_manager.set_coordinator_phase(session_id, "awaiting_clarification")
                        self.session_manager.set_original_task(session_id, task)
                    return

                elif isinstance(event, DirectExecutionStartedEvent):
                    # DIRECT: Simple task, let normal agent flow handle
                    logger.info("📋 Coordinator: DIRECT mode - executing without plan")
                    yield "FALL_THROUGH"
                    return

                elif isinstance(event, PlanCreatedEvent):
                    # PLAN_AND_APPROVE: Complex task, show plan for approval
                    plan = event.plan
                    logger.info(f"📋 Coordinator: PLAN_AND_APPROVE mode - plan {plan.id} with {len(plan.steps)} steps")

                # Cascade planning events
                elif isinstance(event, SubPlanCreatedEvent):
                    # Sub-agent created its detailed plan - forward to UI
                    logger.info(f"📋 Cascade: {event.agent_name} created sub-plan ({event.sub_plan_step_count} steps)")
                    yield convert_coordinator_event(event, 0)

                elif isinstance(event, QuestionsCollectedEvent):
                    # Sub-agents have questions - present to user
                    logger.info(f"📋 Cascade: {len(event.questions.questions)} questions collected from sub-agents")
                    yield convert_coordinator_event(event, 0)

                    # Store coordinator and set phase for answer handling
                    if session_id:
                        self.session_manager.set_coordinator(session_id, coordinator, plan)
                        self.session_manager.set_coordinator_phase(session_id, "awaiting_cascade_questions")
                    return

                elif isinstance(event, CascadingPlanCompleteEvent):
                    # All sub-plans ready - forward to UI
                    logger.info(f"📋 Cascade: All {event.total_sub_plans} sub-plans complete")
                    yield convert_coordinator_event(event, 0)

            if plan and session_id:
                # Store coordinator and plan in session
                self.session_manager.set_coordinator(session_id, coordinator, plan)
                self.session_manager.set_coordinator_phase(session_id, "awaiting_approval")

                # Send plan for approval via awaiting_input
                yield self._create_awaiting_input_for_plan(plan)
            elif plan is None:
                # No plan created - this shouldn't happen for PLAN_AND_APPROVE
                logger.warning("📋 Coordinator: No plan created, falling through to normal flow")
                yield "FALL_THROUGH"

        elif coordinator_phase == "awaiting_approval":
            # === CHECK FOR APPROVAL ===
            if self._is_approval_response(task):
                # User approved - switch to execution mode
                context.tool_mode = ToolMode.EXECUTION
                AgentExecutor.set_current_context(context)
                logger.info("✅ Coordinator: User approved, starting execution phase")

                # Get coordinator and plan from session
                coordinator_from_session: Optional[ExecutionCoordinator] = self.session_manager.get_coordinator(session_id) if session_id else None
                plan_from_session: Optional[Plan] = self.session_manager.get_current_plan(session_id) if session_id else None

                if not coordinator_from_session or not plan_from_session:
                    logger.error("📋 Coordinator: No coordinator/plan found in session")
                    yield self._create_error_response(
                        "SESSION_STATE_ERROR",
                        "Session state lost. Please start over.",
                    )
                    if session_id:
                        self.session_manager.clear_coordinator_state(session_id)
                    return

                # Update phase
                if session_id:
                    self.session_manager.set_coordinator_phase(session_id, "executing")

                # Approve the plan
                try:
                    await coordinator_from_session.approve_plan(plan_from_session.id)
                except Exception as e:
                    logger.error(f"📋 Coordinator: Plan approval failed: {e}")
                    yield self._create_error_response(
                        "PLAN_APPROVAL_FAILED",
                        f"Failed to approve plan: {e}",
                    )
                    return

                # === PHASE 2: EXECUTION ===
                step_index = 0
                last_step_result: Optional[str] = None
                execution_success = False

                async for event in coordinator_from_session.execute_plan(plan_from_session.id, tools):
                    converted = convert_coordinator_event(event, step_index)
                    if converted:
                        yield converted
                        step_index += 1

                    # Capture step results for final summary
                    if isinstance(event, StepCompletedEvent) and event.result:
                        last_step_result = event.result
                    elif isinstance(event, ExecutionCompletedEvent):
                        execution_success = event.success

                # Send final summary as content_chunk so user sees a message
                # AIDEV-NOTE: This is critical - without this, user only sees step progress
                if execution_success:
                    summary = last_step_result or f"Plan executed successfully with {step_index} steps."
                    yield {
                        "type": "content_chunk",
                        "content": f"\n\n✅ **Execution Complete**\n\n{summary}"
                    }
                else:
                    yield {
                        "type": "content_chunk",
                        "content": "\n\n⚠️ **Execution completed with issues.** Some steps may have failed."
                    }

                # Clear coordinator state
                if session_id:
                    self.session_manager.clear_coordinator_state(session_id)
                logger.info("✅ Coordinator: Execution complete, state cleared")

            else:
                # Feedback (not approval) - clear coordinator state and reprocess as new request
                logger.info("📝 Coordinator: Feedback received (not approval), clearing state and reprocessing")
                if session_id:
                    self.session_manager.clear_coordinator_state(session_id)

                # Fall through to normal agent processing
                # This treats the feedback as a new task that will trigger re-planning
                yield "FALL_THROUGH"
                return

        elif coordinator_phase == "executing":
            # Execution is typically synchronous, but handle edge cases
            logger.warning("⚠️ Coordinator: Unexpected executing phase on new message")
            if session_id:
                self.session_manager.clear_coordinator_state(session_id)

        # NOTE: awaiting_clarification is now handled early (before coordinator creation)
        # to combine original task with clarification and re-run planning

        elif coordinator_phase == "awaiting_cascade_questions":
            # User responded to sub-agent questions from cascade planning
            logger.info(f"📋 Coordinator: Received cascade question answers: {task[:100]}...")

            # Get coordinator from session
            coordinator_from_session = self.session_manager.get_coordinator(session_id) if session_id else None
            if not coordinator_from_session:
                logger.error("📋 Coordinator: No coordinator found in session for cascade answers")
                yield self._create_error_response(
                    "SESSION_STATE_ERROR",
                    "Session state lost. Please start over.",
                )
                if session_id:
                    self.session_manager.clear_coordinator_state(session_id)
                return

            # Parse answers - expected as JSON object {question_id: answer, ...}
            try:
                answers_data = json.loads(task)
                answers = QuestionAnswers(answers=answers_data if isinstance(answers_data, dict) else {})
            except json.JSONDecodeError:
                # Treat as free-form text answer to first question
                logger.warning("📋 Cascade answers not JSON, treating as free-form text")
                answers = QuestionAnswers(answers={"default": task})

            # Resume cascade planning with answers
            step_index = 0
            async for event in coordinator_from_session.resume_cascading_plan(answers):
                if isinstance(event, QuestionsCollectedEvent):
                    # More questions needed - present to user
                    logger.info(f"📋 Cascade: More questions needed ({len(event.questions.questions)} questions)")
                    yield convert_coordinator_event(event, step_index)
                    # Stay in awaiting_cascade_questions phase
                    return
                elif isinstance(event, CascadingPlanCompleteEvent):
                    # All planning complete - show plan for approval
                    logger.info(f"📋 Cascade: Planning complete ({event.total_sub_plans} sub-plans)")
                    yield convert_coordinator_event(event, step_index)
                    # Transition to awaiting_approval
                    plan = self.session_manager.get_current_plan(session_id) if session_id else None
                    if plan and session_id:
                        self.session_manager.set_coordinator_phase(session_id, "awaiting_approval")
                        yield self._create_awaiting_input_for_plan(plan)
                    return
                else:
                    # Forward other events
                    converted = convert_coordinator_event(event, step_index)
                    if converted:
                        yield converted
                        step_index += 1

    def _is_approval_response(self, task: str) -> bool:
        """
        Check if the user response is an approval.

        Only accepts structured 'approve' from UI button.
        Any other text is feedback that routes to orchestrator.
        """
        return task.lower().strip() == "approve"

    def _create_awaiting_input_for_plan(self, plan: Plan) -> AwaitingInputResponseDict:
        """Create awaiting_input event for plan approval."""
        # Format plan steps as markdown
        plan_content = f"## Plan: {plan.goal}\n\n"

        # Include context section if available
        if plan.context:
            plan_content += f"### Current State\n{plan.context}\n\n"

        # Include analysis section if available
        if plan.analysis:
            plan_content += f"### Analysis\n{plan.analysis}\n\n"

        # Add steps
        plan_content += "### Steps\n"
        for i, step in enumerate(plan.steps, 1):
            plan_content += f"{i}. {step.description}\n"
            if step.tool_call:
                plan_content += f"   - Tool: `{step.tool_call}`\n"

        return {
            "type": "awaiting_input",
            "data": {
                "input_type": "plan_approval",
                "title": "Review Plan",
                "content": plan_content,
                "options": [
                    {"id": "approve", "label": "Approve", "description": "Execute the plan"}
                ],
                "plan_json": json.dumps({
                    "id": plan.id,
                    "goal": plan.goal,
                    "context": plan.context,
                    "analysis": plan.analysis,
                    "steps": [
                        {"step_id": s.step_id, "description": s.description, "tool_call": s.tool_call}
                        for s in plan.steps
                    ]
                })
            }
        }

    def _create_error_response(self, error_code: str, error_message: str) -> ErrorResponseDict:
        """Create a typed error response dict."""
        return {
            "type": "error",
            "error": {
                "error_code": error_code,
                "error_message": error_message,
                "error_details": {"severity": "recoverable"},
                "hint": "",
                "can_retry": True,
                "auto_retry": False,
                "session_reset": False
            }
        }

    async def GeneratePlan(
        self,
        request: agent_worker_pb2.GeneratePlanRequest,
        context: grpc.aio.ServicerContext
    ) -> agent_worker_pb2.GeneratePlanResponse:
        """
        Generate autonomous plan for skill editor using existing patterns.

        Creates a plan from skill instructions that can be stored and executed
        autonomously (without HITL approval) when the skill runs.

        Uses the same ToolProvider and planning patterns as ProcessMessage.
        """
        start_time = time.time()

        try:
            logger.info(f"📋 GeneratePlan: Starting for skill {request.skill_id}")

            # 1. Create ToolProvider (same pattern as ProcessMessage)
            tool_provider = ToolProvider(
                api_key=request.user_api_key or "",
                organization_id=request.organization_id
            )

            # 2. Get context tools from provider
            context_tools = tool_provider.get_context_tools()
            logger.info(f"📋 GeneratePlan: Using {len(context_tools)} context tools")

            # 3. Get managed agents for routing info in plan
            managed_agents = self.managed_agents_factory.create_all_agents(
                tool_provider=tool_provider,
                org_model=request.model or None
            )
            logger.info(f"📋 GeneratePlan: Using {len(managed_agents)} managed agents")

            # 4. Generate plan (uses PlanOutputTool internally)
            timeout = request.timeout_seconds if request.timeout_seconds > 0 else 60
            plan = await asyncio.wait_for(
                self.plan_service.generate_plan(
                    basic_instructions=request.instructions,
                    context_tables=None,  # Could resolve from skill_id in future
                    org_model=request.model or None,
                    managed_agents=managed_agents,
                    context_tools=context_tools,
                ),
                timeout=timeout
            )

            planning_time_ms = int((time.time() - start_time) * 1000)
            logger.info(f"📋 GeneratePlan: Created plan {plan.id} with {len(plan.steps)} steps in {planning_time_ms}ms")

            # 5. Convert Plan to StoredPlan JSON format (matches TypeScript StoredPlan type)
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
                    }
                    for step in plan.steps
                ],
                "version": 1,
                "generatedAt": plan.generated_at.isoformat() if plan.generated_at else None,
            }

            return agent_worker_pb2.GeneratePlanResponse(
                plan_json=json.dumps(stored_plan),
                plan_id=plan.id,
                planning_time_ms=planning_time_ms,
                status="success"
            )

        except asyncio.TimeoutError:
            logger.error(f"📋 GeneratePlan: Timed out after {request.timeout_seconds}s")
            return agent_worker_pb2.GeneratePlanResponse(
                status="error",
                error_message="Plan generation timed out"
            )

        except Exception as e:
            logger.error(f"📋 GeneratePlan: Failed with error: {e}", exc_info=True)
            return agent_worker_pb2.GeneratePlanResponse(
                status="error",
                error_message=str(e)
            )

