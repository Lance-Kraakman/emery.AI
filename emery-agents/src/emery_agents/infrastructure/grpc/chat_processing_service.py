"""
ChatProcessingService Implementation

Stateless gRPC service for AI chat processing operations only.
Database operations (sessions, message persistence, history) are handled by Next.js.

AIDEV-NOTE: Clean separation - this service only handles AI processing:
- RAG context retrieval
- LLM response generation  
- Tool execution
- OAuth proxy operations

All database operations remain in Next.js ChatApplicationService.
"""

import logging
import time
import uuid
from typing import AsyncIterator, Optional, List, Dict, Any

import grpc
from grpc import aio

from ...grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc
from .mappers import ProtoMapper

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
        
        # Initialize AI processing services - no database dependencies
        logger.info("Initializing ChatProcessingService for AI operations only")
        
        # Import services at runtime to avoid circular dependencies
        try:
            # AI model integration (existing HuggingFace setup)
            from ...core.ai.model_factory import ModelFactory
            self.model_factory = ModelFactory()
            
            # RAG processing (reuse existing patterns from agent execution)
            from ...core.rag.rag_processor import RagProcessor
            self.rag_processor = RagProcessor()
            
            logger.info("✅ ChatProcessingService initialized successfully")
            
        except ImportError as e:
            logger.error(f"❌ Failed to import AI services: {e}")
            # These services will be implemented to match existing patterns
            self.model_factory = None
            self.rag_processor = None

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
        message_content = request.message_content
        user_id = request.user_id
        org_id = request.organization_id
        
        logger.info(f"🚀 Processing message for user {user_id} in org {org_id}")
        logger.info(f"📝 Message preview: {message_content[:100]}...")
        
        try:
            # 1. RAG Context Retrieval (if enabled)
            rag_context_data = None
            if request.context and request.context.enable_rag:
                logger.info("🔍 Retrieving RAG context...")
                
                rag_context_data = await self._get_rag_context(
                    query=message_content,
                    domain_type=request.context.domain_type,
                    domain_id=request.context.domain_id,
                    organization_id=org_id,
                    threshold=request.context.rag_threshold or 0.3,
                    max_docs=request.context.max_rag_docs or 5,
                    primary_weight=request.context.primary_rag_weight or 0.7
                )
                
                if rag_context_data and rag_context_data['sources']:
                    # Send RAG context to client
                    rag_response = agent_worker_pb2.ProcessMessageResponse(
                        rag_context=self._convert_to_rag_context_proto(rag_context_data),
                        timestamp=int(time.time() * 1000)
                    )
                    yield rag_response
                    logger.info(f"✅ Sent RAG context with {len(rag_context_data['sources'])} sources")

            # 2. Build Conversation Context
            conversation_messages = []
            
            # Add conversation history (passed from Next.js)
            for hist_msg in request.conversation_history:
                conversation_messages.append({
                    'role': hist_msg.role,
                    'content': hist_msg.content
                })
            
            # Add current user message
            conversation_messages.append({
                'role': 'user',
                'content': message_content
            })
            
            logger.info(f"💬 Built conversation with {len(conversation_messages)} messages")

            # 3. Generate AI Response (streaming)
            sequence = 0
            total_content = ""
            
            async for chunk in self._stream_ai_response(
                conversation_messages, 
                rag_context_data,
                domain_context=request.context
            ):
                total_content += chunk
                
                # Send content chunk
                chunk_response = agent_worker_pb2.ProcessMessageResponse(
                    content_chunk=agent_worker_pb2.ContentChunk(
                        content=chunk,
                        sequence=sequence
                    ),
                    timestamp=int(time.time() * 1000)
                )
                yield chunk_response
                sequence += 1

            # 4. Send completion marker
            processing_time = int((time.time() - start_time) * 1000)
            complete_response = agent_worker_pb2.ProcessMessageResponse(
                complete=agent_worker_pb2.ProcessingComplete(
                    model_used=self._get_model_name(),
                    total_tokens=sequence,
                    processing_time_ms=processing_time,
                    metadata={
                        'content_length': str(len(total_content)),
                        'rag_sources': str(len(rag_context_data['sources']) if rag_context_data else 0),
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
        - /api/chat/stream/route.ts (DualContextRagService)
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

    async def _stream_ai_response(
        self, 
        conversation_messages: List[Dict[str, str]], 
        rag_context: Optional[Dict[str, Any]],
        domain_context: Optional[Any] = None
    ) -> AsyncIterator[str]:
        """
        Stream AI response using existing HuggingFace integration.
        
        This should reuse the same AI model setup as:
        - Agent execution (SmolAgents integration)
        - Current chat API (/api/chat/stream/route.ts)
        
        AIDEV-TODO: Integrate with actual HuggingFace model setup
        """
        
        if not self.model_factory:
            logger.warning("⚠️ Model factory not available - using mock response")
            # Mock streaming response for testing
            mock_response = "I understand your question about the system. Let me help you with that information."
            for i, word in enumerate(mock_response.split()):
                yield word + " "
                if i < len(mock_response.split()) - 1:
                    # Simulate streaming delay
                    import asyncio
                    await asyncio.sleep(0.05)
            return

        try:
            # Build system prompt with RAG context
            system_prompt = self._build_system_prompt(rag_context, domain_context)
            
            # Prepare messages for model
            messages = [{'role': 'system', 'content': system_prompt}] + conversation_messages
            
            logger.info(f"🤖 Streaming AI response using {self._get_model_name()}")
            
            # AIDEV-TODO: Replace with actual streaming model call
            # This should mirror the streamText() call in app/api/chat/stream/route.ts
            # async for chunk in self.model_factory.stream_response(messages):
            #     yield chunk
            
            # Mock streaming for now
            mock_response = "Based on the context provided, I can help you understand the system better. Let me provide detailed information about your request."
            for word in mock_response.split():
                yield word + " "
                import asyncio
                await asyncio.sleep(0.02)
                
        except Exception as e:
            logger.error(f"❌ AI streaming failed: {e}")
            yield f"I apologize, but I encountered an error processing your request: {str(e)}"

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
        return 'Qwen/Qwen2.5-Coder-32B-Instruct'

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