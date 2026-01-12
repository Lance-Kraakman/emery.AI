"""Stateful gRPC chat service. DB operations handled by Next.js."""

import logging
import os
import time
import asyncio
import concurrent.futures
from typing import AsyncIterator, Optional, List, Dict, Any, TypedDict, Literal, TypeVar, Coroutine

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
from emery_agents.clients import HuggingFaceInferenceClient
from emery_agents.tools.crud_tools import load_skill_crud, load_document_crud
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
from ..services.image_processor import ImageProcessor
from ..services.agent_factory import AgentFactory, AgentConfig
from ..services.token_usage_extractor import TokenUsageExtractor
from ..services.agent_executor import AgentExecutor
from ..services.skill_executor import SkillExecutorService
from ..entities.execution_context import ExecutionContext
from ..types import ExecutionMode

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Type definitions for step progress
StepType = Literal["PLANNING", "ACTION", "REASONING", "FINAL"]

class StepMetadata(TypedDict, total=False):
    """Metadata for execution steps."""
    tool: str
    arguments: str
    observations: str
    error: str

class StepProgressDict(TypedDict):
    """Typed structure for step progress events."""
    type: Literal["step_progress"]
    step_type: StepType
    step_name: str
    content: str
    metadata: StepMetadata
    step_index: int


class ContentChunkDict(TypedDict):
    """Typed structure for content chunk events."""
    type: Literal["content_chunk"]
    content: str


class ErrorDetailsDict(TypedDict, total=False):
    """Error details metadata."""
    severity: str


class ErrorDataDict(TypedDict):
    """Error data structure."""
    error_code: str
    error_message: str
    error_details: ErrorDetailsDict
    hint: str
    can_retry: bool
    auto_retry: bool
    session_reset: bool


class ErrorResponseDict(TypedDict):
    """Typed structure for error response events."""
    type: Literal["error"]
    error: ErrorDataDict


class InterruptedResponseDict(TypedDict):
    """Typed structure for HITL interrupt events (not an error - pause for user approval)."""
    type: Literal["interrupted"]
    message: str


# Union type for all possible stream response types
StreamResponseDict = StepProgressDict | ContentChunkDict | ErrorResponseDict | InterruptedResponseDict


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
                self.tool_registry = UnifiedToolLoader()
                logger.info("✅ UnifiedToolLoader initialized successfully")
            except ImportError as tool_error:
                logger.warning(f"⚠️ ToolRegistryRepository not available: {tool_error}")
                self.tool_registry = None

            # Model provider and AgentFactory (shared utilities)
            self.model_provider = SmolagentsModelProvider()
            self.agent_factory = AgentFactory(self.model_provider)
            logger.info("✅ AgentFactory initialized successfully")

            # SkillExecutorService for shared skill execution logic
            self.skill_executor_service = SkillExecutorService(
                tool_loader=self.tool_registry,
                agent_factory=self.agent_factory
            )
            logger.info("✅ SkillExecutorService initialized successfully")

            # Inference client for operation skills (lazy initialization)
            self._inference_client: Optional[HuggingFaceInferenceClient] = None

            logger.info("✅ ChatProcessingService initialized successfully")

        except ImportError as e:
            logger.error(f"❌ Failed to import core services: {e}")
            self.tool_registry = None
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
        file_attachments = self._extract_file_attachments(message_parts)
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

                    else:
                        # Unknown response type - log warning
                        logger.warning(f"⚠️ Unknown response type: {response_type}, ignoring")

            # 4. Send completion marker
            processing_time = int((time.time() - start_time) * 1000)

            # Convert stored token usage to protobuf using shared utility
            token_usage_proto = TokenUsageExtractor.to_proto(self.last_token_usage)

            # Get model name from token usage if available
            model_used = getattr(self.last_token_usage, 'model_name', '') if self.last_token_usage else ''

            complete_response = agent_worker_pb2.ProcessMessageResponse(
                complete=agent_worker_pb2.ProcessingComplete(
                    model_used=model_used,
                    total_tokens=sequence,
                    processing_time_ms=processing_time,
                    token_usage=token_usage_proto,
                    metadata={
                        'content_length': str(len(total_content)),
                        'domain_type': request.context.domain_type if request.context else 'none'
                    }
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

                # Use user API key from request for managed agents
                effective_api_key = user_api_key or self._extract_user_api_key_from_tools(tools)
                if effective_api_key:
                    logger.info(f"🔑 Using API key for managed agents (source: {'request' if user_api_key else 'tools'})")
                else:
                    logger.warning("⚠️ No API key available for managed agents - skill_builder/document_builder may fail")

                # Create managed agents (routes automatically via smolagents)
                skill_builder_agent = self._create_skill_builder_agent(
                    api_key=effective_api_key or "",
                    org_id=org_id,
                    org_model=org_model
                )
                document_builder_agent = self._create_document_builder_agent(
                    api_key=effective_api_key or "",
                    org_id=org_id,
                    org_model=org_model
                )
                table_builder_agent = self._create_table_builder_agent(
                    api_key=effective_api_key or "",
                    org_id=org_id,
                    org_model=org_model
                )
                schema_builder_agent = self._create_schema_builder_agent(
                    api_key=effective_api_key or "",
                    org_id=org_id,
                    org_model=org_model
                )

                # Create ToolCallingAgent with managed agents
                # AIDEV-NOTE: InterruptAwareToolCallingAgent sets interrupt_switch=True
                # when detecting interrupt from managed agent, breaking the loop
                # Pass file_attachments so chat agent can see available files in session
                agent = self._create_agent_with_model_provider(
                    smolagents_tools,
                    org_model=org_model,
                    has_images=has_images,
                    managed_agents=[skill_builder_agent, document_builder_agent, table_builder_agent, schema_builder_agent],
                    session_attachments=file_attachments  # Current message files for initial agent context
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
            images = self._extract_images_from_message(last_message) if last_message else []

            # Extract current user message text (agent.memory has conversation history)
            current_task = self._extract_text_from_message(last_message) if last_message else "Continue the conversation"

            logger.info(f"🖼️ Extracted {len(images)} images from last message")
            logger.info(f"💬 Current task: {len(current_task)} chars")
            logger.info(f"🧠 Agent memory: {len(agent.memory.steps)} steps")

            # 6. Execute with ToolCallingAgent with real streaming
            # AIDEV-NOTE: skill_builder is a managed_agent - smolagents routes automatically
            # InterruptAwareToolCallingAgent handles interrupt propagation from managed agents
            logger.info("🚀 Executing ToolCallingAgent with stream=True...")

            step_index = 0
            final_answer_text = ""

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
            context = ExecutionContext(
                mode=ExecutionMode.INSTRUCTION,
                task=current_task,
                available_tools=[],
                images=[],  # Images already passed via smolagents images param
                attachments=file_attachments or [],  # Current message files (default)
                session_attachments=session_attachments,  # All session files (for explicit lookup)
            )
            AgentExecutor.set_current_context(context)
            logger.info(f"📎 Set execution context: {len(file_attachments or [])} current, {len(session_attachments)} session files")

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
                    step_data = self._extract_planning_step(step, step_index)
                    logger.info(f"🧠 Planning: {step_data['content'][:100]}...")

                elif isinstance(step, ActionStep):
                    step_data = self._extract_action_step(step, step_index)
                    logger.info(f"🔧 Action: {step_data['step_name']}")

                elif isinstance(step, (FinalAnswerStep, AgentText)):
                    # Extract final step indicator
                    step_data = self._extract_final_step(step_index)

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

                # Build descriptive message with plan content
                if plan_content:
                    message = f"## Proposed Plan\n\n{plan_content}\n\n---\n\n**Reply 'yes' or 'approve' to proceed, or provide feedback.**"
                else:
                    logger.warning("⚠️ No plan found in agent memory for interrupt message")
                    message = "Waiting for your approval to proceed."

                # Session preserved with reset=False for resumption on next message
                interrupted_response: InterruptedResponseDict = {
                    "type": "interrupted",
                    "message": message
                }
                yield interrupted_response
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
        if not self.tool_registry:
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
        return self.tool_registry.load_tools_from_configs(
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

    def _create_agent_with_model_provider(
        self,
        smolagents_tools: List[Any],
        org_model: Optional[str] = None,
        has_images: bool = False,
        managed_agents: Optional[List[Any]] = None,
        session_attachments: Optional[List[Any]] = None
    ) -> InterruptAwareToolCallingAgent:
        """
        Create Chat Planner orchestrator agent with managed agents.

        Uses create_chat_planner_agent for proper template-based instructions
        and interrupt propagation from managed agents.

        Args:
            session_attachments: Optional list of file attachments available in session
                                (displayed to agent for file reference awareness)
        """
        # Get model with smart vision selection
        model = self.model_provider.get_model(
            model_id=self.model_provider.resolve_model_selection(
                org_model=org_model,
                has_images=has_images
            )
        )

        return create_chat_planner_agent(
            tools=smolagents_tools,
            model=model,
            managed_agents=managed_agents,
            context_type="interactive",
            max_steps=10,
            session_attachments=session_attachments
        )

    def _create_skill_builder_agent(
        self,
        api_key: str,
        org_id: Optional[int],
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Skill Builder agent with native planning for HITL workflow.

        This agent runs as a TOP-LEVEL agent (not managed agent) so that
        interrupt() works natively for human-in-the-loop approval.

        AIDEV-NOTE: Changed from managed agent to top-level agent because
        smolagents wraps managed agent interrupts as errors, breaking HITL.

        AIDEV-NOTE: Uses native planning_interval + step_callbacks for human-in-the-loop:
        - planning_interval=1: Plan after first action (reading skill)
        - step_callbacks: Interrupt after planning for user approval
        - reset=False: Memory preserved between messages for resumption

        AIDEV-NOTE: Uses ToolExecutorTool to delegate tool calls to a sub-agent with
        proper instructions. The sub-agent gets tool-specific docs from build_agent_instructions
        and executor rules from tool_executor.j2 template.
        """
        # Create the CRUD tool (will be wrapped by tool_executor)
        skill_crud_tool = load_skill_crud(None, api_key, org_id)

        # Get model for the agent and sub-agent
        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        # Create tool_executor that wraps the CRUD tool
        # Sub-agent gets proper instructions via build_agent_instructions
        tool_executor = create_tool_executor(
            tools=[skill_crud_tool],
            model=model,
            max_steps=3
        )

        # Use factory function with native planning support
        # CodeAgent calls tool_executor which delegates to sub-agent
        skill_builder = create_skill_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=10
        )

        logger.info("✨ Created Skill Builder agent with ToolExecutor sub-agent")
        return skill_builder

    def _create_document_builder_agent(
        self,
        api_key: str,
        org_id: Optional[int],
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Document Builder agent with native planning for HITL workflow.

        This agent runs as a TOP-LEVEL agent (not managed agent) so that
        interrupt() works natively for human-in-the-loop approval.

        AIDEV-NOTE: Uses native planning_interval + step_callbacks for human-in-the-loop:
        - planning_interval=1: Plan after first action (reading document)
        - step_callbacks: Interrupt after planning for user approval
        - reset=False: Memory preserved between messages for resumption

        AIDEV-NOTE: Uses ToolExecutorTool to delegate tool calls to a sub-agent with
        proper instructions. The sub-agent gets tool-specific docs from build_agent_instructions
        and executor rules from tool_executor.j2 template.
        """
        # Create the CRUD tool (will be wrapped by tool_executor)
        document_crud_tool = load_document_crud(None, api_key, org_id)

        # Get model for the agent and sub-agent
        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        # Create tool_executor that wraps the CRUD tool
        # Sub-agent gets proper instructions via build_agent_instructions
        tool_executor = create_tool_executor(
            tools=[document_crud_tool],
            model=model,
            max_steps=3
        )

        # Use factory function with native planning support
        # CodeAgent calls tool_executor which delegates to sub-agent
        document_builder = create_document_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=10
        )

        logger.info("✨ Created Document Builder agent with ToolExecutor sub-agent")
        return document_builder

    def _create_table_builder_agent(
        self,
        api_key: str,
        org_id: Optional[int],
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Table Builder agent for single table operations (autonomous).

        This agent executes directly without HITL approval - designed for
        quick schema changes like adding/deleting fields.

        AIDEV-NOTE: Unlike skill_builder/document_builder which use HITL workflow,
        table_builder is autonomous because single field operations are low-risk.
        """
        from emery_agents.tools.crud_tools import load_field_crud, load_table_crud

        # Load CRUD tools for table/field operations
        field_crud_tool = load_field_crud(None, api_key, org_id)
        table_crud_tool = load_table_crud(None, api_key, org_id)

        # Get model for the agent and sub-agent
        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        # Create tool_executor that wraps the CRUD tools
        tool_executor = create_tool_executor(
            tools=[field_crud_tool, table_crud_tool],
            model=model,
            max_steps=3
        )

        # Use factory function - autonomous agent (no HITL)
        table_builder = create_table_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=6  # Smaller for single operations
        )

        logger.info("✨ Created Table Builder agent (autonomous) with ToolExecutor sub-agent")
        return table_builder

    def _create_schema_builder_agent(
        self,
        api_key: str,
        org_id: Optional[int],
        org_model: Optional[str] = None
    ) -> ToolCallingAgent:
        """
        Create a Schema Builder agent for complex schema design (HITL).

        This agent uses HITL workflow for designing schemas from requirements:
        - Analyzes unstructured data (questionnaires, forms, specs)
        - Proposes table structure with all fields
        - Waits for user approval
        - Batch creates fields on approval

        AIDEV-NOTE: Uses native planning_interval + step_callbacks for human-in-the-loop:
        - planning_interval=2: Plan after 2 actions (gathers context first)
        - step_callbacks: Interrupt after planning for user approval
        - reset=False: Memory preserved between messages for resumption
        """
        from emery_agents.tools.crud_tools import load_field_crud, load_table_crud, load_database_crud

        # Load CRUD tools for table/field/database operations
        # database_crud needed for list_databases to find existing databases
        field_crud_tool = load_field_crud(None, api_key, org_id)
        table_crud_tool = load_table_crud(None, api_key, org_id)
        database_crud_tool = load_database_crud(None, api_key, org_id)

        # Get model for the agent and sub-agent
        model = self.model_provider.get_model(model_id=org_model) if org_model else self.model_provider.get_model()

        # Create tool_executor that wraps the CRUD tools
        tool_executor = create_tool_executor(
            tools=[field_crud_tool, table_crud_tool, database_crud_tool],
            model=model,
            max_steps=8  # More steps for database listing + batch field creation
        )

        # Use factory function with native planning support (HITL)
        schema_builder = create_schema_builder_agent(
            tools=[tool_executor],
            model=model,
            max_steps=15  # More steps for analyzing and batch creating
        )

        logger.info("✨ Created Schema Builder agent (HITL) with ToolExecutor sub-agent")
        return schema_builder

    def _extract_user_api_key_from_tools(self, tools: List['agent_worker_pb2.ToolConfig']) -> Optional[str]:
        """
        Extract user API key from enriched tool configs.

        The Next.js layer enriches tool configs with user API keys for authentication.
        This extracts the key so managed agents (like skill_builder) can reuse it.

        Args:
            tools: List of ToolConfig proto objects with config maps

        Returns:
            User API key string if found, None otherwise
        """
        for tool in tools:
            if tool.config:
                api_key = tool.config.get('api_key')
                if api_key and api_key.startswith('user_'):
                    logger.debug(f"🔑 Extracted user API key from tool {tool.name}")
                    return api_key
        logger.warning("⚠️ No user API key found in tool configs")
        return None

    def _extract_file_attachments(self, message_parts: List['agent_worker_pb2.MessagePart']) -> List['agent_worker_pb2.FileAttachment']:
        """
        Extract file attachments (audio, PDFs, etc.) from message parts.

        Used to pass file context to skills that need raw file bytes (e.g., speech-to-text).

        Args:
            message_parts: List of MessagePart from the request

        Returns:
            List of FileAttachment protos with url and mime_type
        """
        attachments = []
        for part in message_parts:
            if part.HasField('file'):
                # Create FileAttachment from the file part
                attachment = agent_worker_pb2.FileAttachment(
                    url=part.file.url,
                    mime_type=part.file.mime_type
                )
                attachments.append(attachment)
        return attachments

    def _extract_images_from_message(self, message: ChatMessage) -> list[Image.Image]:
        """Extract PIL Image objects from ChatMessage content using shared utility."""
        return ImageProcessor.extract_images_from_message(message)

    def _extract_text_from_message(self, message: ChatMessage) -> str:
        """
        Extract text content from ChatMessage.

        Args:
            message: ChatMessage object with content as MessageContentList

        Returns:
            Combined text string (empty string if no text content)

        AIDEV-NOTE: Used to extract text for agent.run() task parameter.
        Content is always MessageContentList (list of content parts).
        """
        if not message or not message.content:
            return ""

        content: MessageContentList = message.content

        # Extract all text from content parts
        text_parts: list[str] = []
        for part in content:
            if part.get("type") == "text":
                text_parts.append(part["text"])

        return " ".join(text_parts).strip()

    def _build_task_with_conversation_context(
        self,
        conversation_messages: List[ChatMessage],
        system_prompt: str
    ) -> str:
        """
        Build task prompt with full conversation history.

        Since we create a NEW agent per request, agent.memory doesn't persist
        between requests. Instead, we include the full conversation history
        in the task prompt itself.

        Args:
            conversation_messages: List of ChatMessage objects (user and assistant)
            system_prompt: System prompt to include as context

        Returns:
            Formatted task string with conversation history

        AIDEV-NOTE: This is the key to context persistence - we manually format
        conversation history into the task prompt instead of relying on agent.memory
        which doesn't persist across agent instances.
        """
        if not conversation_messages:
            return "Continue the conversation"

        # Build conversation history as text
        history_parts = []

        # Add system context at the beginning
        if system_prompt:
            history_parts.append(f"SYSTEM CONTEXT:\n{system_prompt}\n")

        # Add previous conversation (all but last message)
        if len(conversation_messages) > 1:
            history_parts.append("CONVERSATION HISTORY:")
            for msg in conversation_messages[:-1]:
                role = msg.role.value.upper()
                text = self._extract_text_from_message(msg)
                if text:
                    history_parts.append(f"{role}: {text}")

        # Add current message as the task
        last_message = conversation_messages[-1]
        current_text = self._extract_text_from_message(last_message)

        if history_parts:
            # If we have history, format with clear separation
            history_str = "\n".join(history_parts)
            return f"{history_str}\n\nCURRENT USER MESSAGE:\n{current_text}"
        else:
            # First message in conversation
            return current_text

    def _extract_planning_step(self, step: PlanningStep, index: int) -> StepProgressDict:
        """
        Extract typed data from PlanningStep.

        PlanningStep has 'plan' attribute containing the planning text.
        No hasattr checks needed - smolagents guarantees this structure.
        """
        return StepProgressDict(
            type="step_progress",
            step_type="PLANNING",
            step_name="Planning",
            content=step.plan,
            metadata=StepMetadata(),
            step_index=index
        )

    def _extract_action_step(self, step: ActionStep, index: int) -> StepProgressDict:
        """
        Extract typed data from ActionStep.

        ActionStep has 'tool_calls' (list of ToolCall objects), 'code_action' (for CodeAgent),
        and 'observations'. When tool_calls is empty/None, checks for code_action (CodeAgent),
        then falls back to model_output for raw LLM response.

        AIDEV-NOTE: CodeAgent populates step.code_action with Python code, not tool_calls.
        We now handle this as a CODE_EXECUTION step type for proper UI display.
        """
        # Extract tool info from tool_calls
        tool_name = "unknown"
        tool_args = "{}"
        step_type = "ACTION"
        step_name = "Tool: unknown"
        content = ""

        if step.tool_calls and len(step.tool_calls) > 0:
            # Has valid tool calls (ToolCallingAgent)
            tool_call = step.tool_calls[0]
            tool_name = tool_call.name
            tool_args = str(tool_call.arguments)
            step_name = f"Tool: {tool_name}"

            # Format observations (truncate if too long)
            if step.observations:
                obs = str(step.observations)
                MAX_LENGTH = 500
                content = obs[:MAX_LENGTH] + "..." if len(obs) > MAX_LENGTH else obs

        elif step.code_action:
            # CodeAgent: has Python code execution instead of tool_calls
            # AIDEV-NOTE: code_action contains the Python code that was executed
            step_type = "CODE_EXECUTION"
            step_name = "Code Execution"
            tool_name = "python_interpreter"

            # Format the code (truncate if too long)
            code = str(step.code_action)
            MAX_CODE_LENGTH = 1000
            content = code[:MAX_CODE_LENGTH] + "..." if len(code) > MAX_CODE_LENGTH else code
            tool_args = code[:500]  # Store truncated code in args

            # Append observations/output if available
            if step.observations:
                obs = str(step.observations)
                MAX_OUTPUT_LENGTH = 500
                output_truncated = obs[:MAX_OUTPUT_LENGTH] + "..." if len(obs) > MAX_OUTPUT_LENGTH else obs
                content += f"\n\n--- Output ---\n{output_truncated}"

            logger.info(f"📜 CodeAgent step: code_action detected, {len(code)} chars")

        else:
            # No tool calls or code - check for raw model output
            logger.debug(f"ActionStep without tool_calls/code_action: model_output={'exists' if step.model_output else 'None'}")

            if step.model_output:
                # Use model's raw output as reasoning step
                step_type = "REASONING"
                step_name = "Model Reasoning (No Tool Call)"
                raw_output = str(step.model_output)
                MAX_LENGTH = 500
                content = raw_output[:MAX_LENGTH] + "..." if len(raw_output) > MAX_LENGTH else raw_output
            else:
                # Fallback: use observations if available
                step_name = "Agent Step"
                if step.observations:
                    obs = str(step.observations)
                    MAX_LENGTH = 500
                    content = obs[:MAX_LENGTH] + "..." if len(obs) > MAX_LENGTH else obs

        # Build metadata dict with only non-None string values (protobuf requires map<string, string>)
        metadata_dict: Dict[str, str] = {}
        if tool_name != "unknown":
            metadata_dict["tool"] = tool_name
        if tool_args != "{}":
            metadata_dict["arguments"] = tool_args
        if content:
            metadata_dict["observations"] = content

        return StepProgressDict(
            type="step_progress",
            step_type=step_type,
            step_name=step_name,
            content=content,
            metadata=metadata_dict,
            step_index=index
        )

    def _extract_final_step(self, index: int) -> StepProgressDict:
        """
        Extract typed data for final step.

        Final step is just a marker indicating response generation.
        """
        return StepProgressDict(
            type="step_progress",
            step_type="FINAL",
            step_name="Final Answer",
            content="Generating final response...",
            metadata=StepMetadata(),
            step_index=index
        )

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