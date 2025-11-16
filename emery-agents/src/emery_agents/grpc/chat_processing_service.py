"""
ChatProcessingService Implementation

Stateful gRPC service for AI chat processing with persistent agent sessions.
Database operations (sessions, message persistence, history) are handled by Next.js.

AIDEV-NOTE: Session-based architecture with agent persistence:
- SessionManager maintains agent instances in memory
- Agents persist between messages (reset=False)
- Conversation history restored from database after restart/timeout
- Automatic cleanup (30 min idle, 4 hour max lifetime)

AI Processing features:
- RAG context retrieval
- LLM response generation
- Tool execution
- OAuth proxy operations

All database operations remain in Next.js ChatApplicationService.

AIDEV-NOTE: Refactored to use shared utilities:
- ImageProcessor for image extraction
- AgentFactory for agent creation
- TokenUsageExtractor for token tracking
- UnifiedToolLoader enhanced methods
"""

import logging
import time
import asyncio
from typing import AsyncIterator, Optional, List, Dict, Any, TypedDict, Literal

import grpc
from grpc import aio
from PIL import Image

from smolagents import ToolCallingAgent, AgentText
from smolagents.models import ChatMessage, MessageRole
from smolagents.memory import ActionStep, PlanningStep, FinalAnswerStep
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .mappers import ProtoMapper
from .mappers.message_mapper import (
    build_conversation_messages,
    has_images,
    extract_text_from_parts
)
from .mappers.message_types import MessageContentList
from ..services.model_provider import SmolagentsModelProvider
from ..services.tool_loader import UnifiedToolLoader
from ..services.session_manager import SessionManager
from ..utils.error_classifier import classify_error
from ..utils.error_messages import ErrorSeverity
from ..services.image_processor import ImageProcessor
from ..services.agent_factory import AgentFactory, AgentConfig
from ..services.token_usage_extractor import TokenUsageExtractor
from ..rag.rag_processor import RagProcessor

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


class ChatProcessingServiceImplementation(agent_worker_pb2_grpc.ChatProcessingServiceServicer):
    """
    gRPC service implementation for ChatProcessingService.
    
    Handles AI-only operations:
    - RAG context retrieval using existing DualContextRagService patterns
    - LLM response streaming using existing HuggingFace integration
    - Tool execution for agent-based responses
    
    Does NOT handle:
    - Chat session management (Next.js)
    - Message persistence (Next.js) 
    - User authentication (Next.js)
    """
    
    def __init__(self, organization_id: str):
        self.organization_id = organization_id
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
            # RAG processing (always available - no external dependencies)
            self.rag_processor = RagProcessor()
            logger.info("✅ RagProcessor initialized successfully")

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

            logger.info("✅ ChatProcessingService initialized successfully")

        except ImportError as e:
            logger.error(f"❌ Failed to import core services: {e}")
            self.rag_processor = None
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
        1. Extract RAG context based on domain/organization
        2. Build conversation context from provided history
        3. Stream LLM response using existing AI infrastructure
        4. Return processing metadata
        
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

        # Extract tools and skills from AgentConfig
        agent_config = request.agent_config if hasattr(request, 'agent_config') and request.agent_config else None

        if agent_config:
            tools_count = len(agent_config.tools) if agent_config.tools else 0
            skills_count = len(agent_config.skills) if agent_config.skills else 0
            logger.info(f"🔧 AgentConfig provided: {tools_count} tools, {skills_count} skills")
        else:
            logger.info(f"⚠️ No AgentConfig provided, using empty tools")

        try:
            # RAG context has been removed - chat is now simpler without automatic RAG
            # Tools can still be provided for specific data access if needed
            logger.debug("🔧 Processing without RAG context (RAG system removed)")

            # 2. Build Conversation Context using mapper
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

            async for response_dict in self._stream_tool_calling_agent_response(
                conversation_messages,
                tools_to_use,
                None,  # RAG context removed
                domain_context=request.context,
                org_model=org_model,
                has_images=has_image_content,
                session_id=session_id,
                user_id=user_id,
                org_id=org_id,
                conversation_history=request.conversation_history,
                agent_config=agent_config  # Pass agent_config for skill execution
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
                        chunk = response_dict.get("content", "")
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

                else:
                    # Legacy fallback for string responses (error messages)
                    total_content += str(response_dict)
                    chunk_response = agent_worker_pb2.ProcessMessageResponse(
                        content_chunk=agent_worker_pb2.ContentChunk(
                            content=str(response_dict),
                            sequence=sequence
                        ),
                        timestamp=int(time.time() * 1000)
                    )
                    yield chunk_response
                    sequence += 1

            # 4. Send completion marker
            processing_time = int((time.time() - start_time) * 1000)

            # Convert stored token usage to protobuf using shared utility
            token_usage_proto = TokenUsageExtractor.to_proto(self.last_token_usage)

            complete_response = agent_worker_pb2.ProcessMessageResponse(
                complete=agent_worker_pb2.ProcessingComplete(
                    model_used=self._get_model_name(),
                    total_tokens=sequence,
                    processing_time_ms=processing_time,
                    token_usage=token_usage_proto,
                    metadata={
                        'content_length': str(len(total_content)),
                        'rag_sources': '0',  # RAG context removed
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

    async def _get_rag_context(
        self, 
        query: str, 
        domain_type: str, 
        domain_id: int, 
        organization_id: int,
        threshold: float = 0.3,
        max_docs: int = 5,
        primary_weight: float = 0.7
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve RAG context using existing dual-context patterns.
        
        This should integrate with the same RAG service used by:
        - /api/chat/stream-grpc/route.ts (DualContextRagService)
        - Agent execution pipeline
        
        AIDEV-TODO: Implement using actual DualContextRagService patterns
        """
        
        if not self.rag_processor:
            logger.warning("⚠️ RAG processor not available - returning empty context")
            return {'sources': [], 'context_summary': 'RAG not available'}
        
        try:
            # This should mirror the logic in ddd/application/services/chat/dual-context-rag-service.ts
            # For now, return mock data that matches the expected structure
            
            logger.info(f"🔍 RAG query: {query[:50]}... for {domain_type}:{domain_id}")
            
            # AIDEV-TODO: Replace with actual RAG integration
            mock_sources = [
                {
                    'document_id': f'doc_{domain_type}_{domain_id}_1',
                    'title': f'{domain_type.title()} Documentation',
                    'similarity': 0.85,
                    'domain_type': domain_type,
                    'excerpt': f'Relevant information about {domain_type} operations...'
                }
            ]
            
            return {
                'sources': mock_sources,
                'context_summary': f'Found {len(mock_sources)} relevant {domain_type} documents',
                'total_sources': len(mock_sources)
            }
            
        except Exception as e:
            logger.error(f"❌ RAG context retrieval failed: {e}")
            return {'sources': [], 'context_summary': f'RAG failed: {str(e)}'}


    async def _stream_tool_calling_agent_response(
        self,
        conversation_messages: List[ChatMessage],
        tools: List['agent_worker_pb2.ToolConfig'],
        rag_context_data: Optional['RagContextData'],
        domain_context: Optional['agent_worker_pb2.ChatContext'] = None,
        org_model: Optional[str] = None,
        has_images: bool = False,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        org_id: Optional[int] = None,
        conversation_history: Optional[List] = None,
        agent_config: Optional['agent_worker_pb2.AgentConfig'] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Stream AI response using ToolCallingAgent with stateful session support.

        Session Management:
        - HOT PATH: Reuse existing agent from session (agent.memory persists)
        - COLD PATH: Create new agent and restore from conversation history

        AIDEV-NOTE: Accepts smolagents ChatMessage objects with PIL Image support.
        Smolagents handles conversion to HuggingFace API format internally.
        """

        try:
            # Import here to avoid circular dependencies
            # RagContextData imported from rag_processor (already imported)

            # 1. Build system prompt using RAG processor if available
            system_prompt = self._build_system_prompt_with_rag(rag_context_data, domain_context)
            logger.info(f"📝 Built system prompt: {len(system_prompt)} chars")

            # 2. Convert protobuf tools to smolagents tools
            smolagents_tools = self._convert_tools_to_smolagents(tools, agent_config=agent_config, org_model=org_model)
            logger.info(f"🔧 Converted {len(smolagents_tools)} tools for ToolCallingAgent")

            # 3. Get or create agent with session management
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

            else:
                # Agent doesn't exist - COLD PATH (create + restore from history)
                logger.info(f"✨ [COLD-PATH] Creating new agent for session {session_id}")

                # Create ToolCallingAgent with model provider
                agent = self._create_agent_with_model_provider(
                    smolagents_tools,
                    org_model=org_model,
                    has_images=has_images
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

            logger.info(f"🤖 Using ToolCallingAgent with {len(smolagents_tools)} tools")
            logger.info(f"🧠 [MEMORY-DEBUG] Final agent memory before execution: {len(agent.memory.steps)} steps")

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
            logger.info("🚀 Executing ToolCallingAgent with stream=True...")

            # Import smolagents step types for proper type checking
            from smolagents.memory import ActionStep, PlanningStep, FinalAnswerStep
            from smolagents import AgentText

            step_index = 0
            final_answer_text = ""

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
                        yield {
                            "type": "content_chunk",
                            "content": chunk
                        }

                    step_index += 1
                    continue

                # Yield step progress for non-final steps
                if step_data:
                    logger.debug(f"Yielding step {step_index}: type={step_data['step_type']}, name={step_data['step_name']}")
                    yield step_data

                step_index += 1

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
            yield {
                "type": "error",
                "error": {
                    "error_code": error_info.error_type,
                    "error_message": error_info.user_message,
                    "error_details": {
                        "severity": error_info.severity.value
                    },
                    "hint": error_info.hint or "",
                    "can_retry": error_info.can_retry,
                    "auto_retry": False,  # Auto-retry not implemented in current flow
                    "session_reset": session_was_reset
                }
            }

            logger.info(f"📨 Sent user-friendly error message (type={error_info.error_type})")

        finally:
            # Reset error count on successful completion (if we got here without error)
            if session_id and 'error_info' not in locals():
                self.session_manager.reset_error_count(session_id)

    def _build_system_prompt_with_rag(
        self,
        rag_context_data: Optional['RagContextData'],
        domain_context: Optional['agent_worker_pb2.ChatContext']
    ) -> str:
        """Build system prompt with RAG context integration."""
        if self.rag_processor and rag_context_data:
            # RagContextData imported from rag_processor (already imported)

            if isinstance(rag_context_data, RagContextData):
                domain_context_dict = {
                    'domain_type': domain_context.domain_type if domain_context else None,
                    'domain_id': domain_context.domain_id if domain_context else None
                } if domain_context else None

                return self.rag_processor.format_context_for_llm(
                    rag_context_data=rag_context_data,
                    user_query='',  # Will be added in conversation prompt
                    domain_context=domain_context_dict
                )

        return self._build_basic_system_prompt(domain_context)

    def _convert_tools_to_smolagents(
        self,
        tools: List['agent_worker_pb2.ToolConfig'],
        agent_config: Optional['agent_worker_pb2.AgentConfig'] = None,
        org_model: Optional[str] = None
    ) -> List[Any]:
        """
        Convert protobuf ToolConfig objects to smolagents tools using shared utility.

        Args:
            tools: List of ToolConfig proto objects
            agent_config: Optional AgentConfig containing skills for skill execution
            org_model: Organization default model (used as fallback for skills)

        Returns:
            List of loaded tool instances (including SkillTools)
        """
        if not self.tool_registry:
            logger.error("❌ Tool registry not available - tools cannot be loaded")
            return []

        # Create skill execution callback if agent_config has skills
        skill_executor = None
        if agent_config and agent_config.skills:
            skill_executor = self._create_skill_executor_callback(org_model=org_model)

        # Use consolidated load_tools_from_configs method
        return self.tool_registry.load_tools_from_configs(
            tool_configs=tools,
            api_key=None,  # API keys are in tool configs already
            api_key_mode="user",  # Chat system uses user API key mode
            agent_config=agent_config,
            skill_executor=skill_executor
        )

    def _create_skill_executor_callback(self, org_model: Optional[str] = None):
        """
        Create a callback function for executing skills.

        This callback is used by SkillTool to execute skills when called by the LLM.
        It creates a sub-agent with the skill's tools and executes the skill's instructions.

        Args:
            org_model: Organization default model (used as fallback if skill has no model)

        Returns:
            Callable that takes (SkillConfig, runtime_inputs) and returns result string
        """
        def execute_skill(skill_config: 'agent_worker_pb2.SkillConfig', runtime_inputs: Dict[str, Any]) -> str:
            """
            Execute a skill by creating a sub-agent.

            Args:
                skill_config: Full skill definition from proto
                runtime_inputs: Runtime inputs from LLM (matching skill.inputs)

            Returns:
                Skill execution result as string
            """
            logger.info(f"🎯 Executing skill: {skill_config.name} with inputs: {list(runtime_inputs.keys())}")

            try:
                # 1. Load skill's tools
                skill_tools = []
                if skill_config.tools:
                    skill_tools = self.tool_registry.load_tools_from_configs(
                        tool_configs=list(skill_config.tools),
                        api_key=None,
                        api_key_mode="user"
                    )
                    logger.info(f"🔧 Loaded {len(skill_tools)} tools for skill {skill_config.name}")

                # 2. Create sub-agent with skill's tools
                from ..services.agent_factory import AgentConfig as FactoryAgentConfig
                agent_config = FactoryAgentConfig(
                    tools=skill_tools,
                    skill_model=skill_config.model if skill_config.model else None,
                    org_model=org_model,
                    has_images=False,  # Skills don't support images in v1
                    max_steps=10,
                    agent_name=f"skill_{skill_config.name}",
                    agent_description=skill_config.description,
                    enable_caching=False
                )
                sub_agent = self.agent_factory.create_agent(agent_config)
                logger.info(f"✨ Created sub-agent for skill {skill_config.name}")

                # 3. Build task from instructions + inputs
                task_parts = [skill_config.instructions]

                # Add runtime inputs to task
                if runtime_inputs:
                    task_parts.append("\n\nInputs:")
                    for key, value in runtime_inputs.items():
                        task_parts.append(f"- {key}: {value}")

                task = "\n".join(task_parts)
                logger.info(f"📝 Skill task: {task[:200]}...")

                # 4. Execute skill with sub-agent
                # When stream=False, run() returns the final output directly (not an iterable)
                from smolagents.agent_types import AgentText, AgentImage, AgentAudio
                import json

                result = sub_agent.run(task=task, stream=False, reset=True)
                logger.info(f"🔍 Skill output type: {type(result).__name__}")

                # Create MessagePart based on output type
                message_parts = []

                if isinstance(result, AgentImage):
                    # Image output - save to temp and create ImageUrlPart
                    temp_path = result.to_string()  # Saves to temp directory
                    logger.info(f"📸 Skill generated image: {temp_path}")
                    # TODO: Upload image to S3 and get URL instead of temp path
                    image_part = agent_worker_pb2.ImageUrlPart(url=temp_path)
                    message_part = agent_worker_pb2.MessagePart(image_url=image_part)
                    message_parts.append(message_part)

                elif isinstance(result, AgentAudio):
                    # Audio output - save to temp and create FilePart
                    temp_path = result.to_string()  # Saves to temp directory
                    logger.info(f"🔊 Skill generated audio: {temp_path}")
                    # TODO: Upload audio to S3 and get URL instead of temp path
                    file_part = agent_worker_pb2.FilePart(
                        url=temp_path,
                        mime_type="audio/wav",
                        filename="audio.wav",
                        size=0  # TODO: Get actual file size
                    )
                    message_part = agent_worker_pb2.MessagePart(file=file_part)
                    message_parts.append(message_part)

                elif isinstance(result, AgentText) or isinstance(result, str):
                    # Text output - create TextPart
                    text_content = str(result)
                    logger.info(f"📝 Skill generated text: {text_content[:100]}...")
                    text_part = agent_worker_pb2.TextPart(text=text_content)
                    message_part = agent_worker_pb2.MessagePart(text=text_part)
                    message_parts.append(message_part)

                else:
                    # Unknown type - convert to string
                    text_content = str(result)
                    logger.info(f"❓ Skill generated unknown type, converting to text: {text_content[:100]}...")
                    text_part = agent_worker_pb2.TextPart(text=text_content)
                    message_part = agent_worker_pb2.MessagePart(text=text_part)
                    message_parts.append(message_part)

                # Serialize MessageParts to JSON for now
                # TODO: Update SkillTool and parent agent to handle MessagePart[] natively
                serialized_parts = []
                for part in message_parts:
                    if part.HasField('text'):
                        serialized_parts.append({'type': 'text', 'text': part.text.text})
                    elif part.HasField('image_url'):
                        serialized_parts.append({'type': 'image', 'url': part.image_url.url})
                    elif part.HasField('file'):
                        serialized_parts.append({
                            'type': 'file',
                            'url': part.file.url,
                            'mime_type': part.file.mime_type,
                            'filename': part.file.filename
                        })

                result_json = json.dumps({'parts': serialized_parts})
                logger.info(f"✅ Skill {skill_config.name} completed: {len(message_parts)} message parts")
                return result_json

            except Exception as e:
                error_msg = f"Skill execution error: {str(e)}"
                logger.error(f"❌ Skill {skill_config.name} failed: {e}", exc_info=True)
                return error_msg

        return execute_skill

    def _create_agent_with_model_provider(
        self,
        smolagents_tools: List[Any],
        org_model: Optional[str] = None,
        has_images: bool = False
    ) -> ToolCallingAgent:
        """Create ToolCallingAgent using AgentFactory with smart vision model selection."""
        agent_config = AgentConfig(
            tools=smolagents_tools,
            org_model=org_model,
            has_images=has_images,
            max_steps=10,
            agent_name="chat_tool_calling",
            agent_description=f"Chat agent with {len(smolagents_tools)} tools available",
            enable_caching=False
        )
        return self.agent_factory.create_agent(agent_config)

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

        ActionStep has 'tool_calls' (list of ToolCall objects) and 'observations'.
        When tool_calls is empty/None, uses model_output for raw LLM response.
        Uses proper type access instead of hasattr checks.
        """
        # Extract tool info from tool_calls
        tool_name = "unknown"
        tool_args = "{}"
        step_type = "ACTION"
        step_name = "Tool: unknown"
        content = ""

        if step.tool_calls and len(step.tool_calls) > 0:
            # Has valid tool calls
            tool_call = step.tool_calls[0]
            tool_name = tool_call.name
            tool_args = str(tool_call.arguments)
            step_name = f"Tool: {tool_name}"

            # Format observations (truncate if too long)
            if step.observations:
                obs = str(step.observations)
                MAX_LENGTH = 500
                content = obs[:MAX_LENGTH] + "..." if len(obs) > MAX_LENGTH else obs
        else:
            # No tool calls - check for raw model output
            logger.debug(f"ActionStep without tool_calls: model_output={'exists' if step.model_output else 'None'}")

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

    def _build_basic_system_prompt(self, domain_context: Optional[Any] = None) -> str:
        """Build basic system prompt without RAG context."""
        
        base_prompt = 'You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.'
        
        if domain_context and hasattr(domain_context, 'domain_type'):
            domain_type = domain_context.domain_type
            if domain_type == 'table':
                base_prompt += ' You are currently assisting with a specific table and its data.'
            elif domain_type == 'agent':
                base_prompt += ' You are currently assisting with a specific agent.'
            elif domain_type == 'file':
                base_prompt += ' You are currently assisting with a specific file.'
        
        base_prompt += ' Always be helpful, accurate, and professional.'
        return base_prompt

    def _build_rag_context_proto_from_data(self, rag_context_data) -> agent_worker_pb2.RagContext:
        """Build RagContext protobuf from RagContextData."""
        
        # Create mock sources for the protobuf response
        sources = []
        for i, source_summary in enumerate(rag_context_data.sources[:5]):  # Limit to 5 sources
            proto_source = agent_worker_pb2.RagSource(
                document_id=f'source_{i}',
                title=f'Source {i+1}',
                similarity=0.8,  # Mock similarity
                domain_type=rag_context_data.domain_type or 'organization',
                excerpt=source_summary[:100] + '...' if len(source_summary) > 100 else source_summary
            )
            sources.append(proto_source)
        
        return agent_worker_pb2.RagContext(
            sources=sources,
            context_summary=f'Found {len(rag_context_data.sources)} relevant sources from {rag_context_data.domain_type or "organization"} data',
            total_sources=len(rag_context_data.sources)
        )

    def _extract_token_usage_from_agent(self, agent) -> Optional[Any]:
        """Extract accumulated token usage from agent's memory steps using shared utility."""
        return TokenUsageExtractor.extract_from_agent_memory(
            agent=agent,
            default_model_name=self._get_model_name()
        )

    def _build_system_prompt(
        self, 
        rag_context: Optional[Dict[str, Any]], 
        domain_context: Optional[Any]
    ) -> str:
        """Build system prompt with RAG context, matching existing chat API patterns."""
        
        base_prompt = 'You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.'
        
        # Add domain-specific context
        if domain_context:
            domain_type = domain_context.domain_type
            if domain_type == 'table':
                base_prompt += ' You are currently assisting with a specific table and its data. Focus on table structure, data analysis, and table-specific operations.'
            elif domain_type == 'agent':
                base_prompt += ' You are currently assisting with a specific agent. Focus on agent capabilities, execution history, and configuration.'
            elif domain_type == 'file':
                base_prompt += ' You are currently assisting with a specific file. Focus on file content, analysis, and document-related tasks.'
            elif domain_type == 'team':
                base_prompt += ' You are currently assisting with a specific team. Focus on team dynamics, member coordination, and collaborative activities.'
            elif domain_type == 'workflow':
                base_prompt += ' You are currently assisting with a specific workflow. Focus on process optimization, execution analysis, and workflow management.'
        
        # Add RAG context if available
        if rag_context and rag_context.get('sources'):
            base_prompt += f"""

You have access to relevant context information:

{rag_context['context_summary']}

Use this context to provide accurate, specific answers. When referencing information from the context, cite the specific sources."""
        else:
            base_prompt += ' No specific context is available. Provide general guidance about database management and workflows.'
        
        base_prompt += '\n\nAlways be helpful, accurate, and professional.'
        
        return base_prompt

    def _get_model_name(self) -> str:
        """Get the AI model name being used (should match existing setup)."""
        # This should match the model used in lib/ai/models.ts
        return 'Qwen/Qwen2.5-Coder-7B-Instruct'

    def _convert_to_rag_context_proto(self, rag_data: Dict[str, Any]) -> agent_worker_pb2.RagContext:
        """Convert RAG context data to protobuf format."""
        
        sources = []
        for source in rag_data.get('sources', []):
            proto_source = agent_worker_pb2.RagSource(
                document_id=source.get('document_id', ''),
                title=source.get('title', ''),
                similarity=source.get('similarity', 0.0),
                domain_type=source.get('domain_type', ''),
                excerpt=source.get('excerpt', '')
            )
            sources.append(proto_source)
        
        return agent_worker_pb2.RagContext(
            sources=sources,
            context_summary=rag_data.get('context_summary', ''),
            total_sources=rag_data.get('total_sources', len(sources))
        )