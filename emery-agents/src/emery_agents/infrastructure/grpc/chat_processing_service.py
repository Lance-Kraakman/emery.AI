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
import asyncio
from typing import AsyncIterator, Optional, List, Dict, Any

import grpc
from grpc import aio

from smolagents import ToolCallingAgent
from ...grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc
from .mappers import ProtoMapper
from ...core.entities import ToolConfig as CoreToolConfig
from ...domain.ai.services.model_provider_service import IModelProviderService
from ...infrastructure.ai.smolagents_model_provider import SmolagentsModelProvider

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
            # RAG processing (always available - no external dependencies)
            from ...core.rag.rag_processor import RagProcessor
            self.rag_processor = RagProcessor()
            logger.info("✅ RagProcessor initialized successfully")

            # AI model integration (may not be available yet)
            try:
                from ...core.ai.model_factory import ModelFactory
                self.model_factory = ModelFactory()
                logger.info("✅ ModelFactory initialized successfully")
            except ImportError as model_error:
                logger.warning(f"⚠️ ModelFactory not available: {model_error}")
                self.model_factory = None

            # Tool registry for converting ToolConfig to smolagents tools
            try:
                from ...execution.tools.tool_registry import ToolRegistry
                self.tool_registry = ToolRegistry()
                logger.info("✅ ToolRegistry initialized successfully")
            except ImportError as tool_error:
                logger.warning(f"⚠️ ToolRegistry not available: {tool_error}")
                self.tool_registry = None

            logger.info("✅ ChatProcessingService initialized successfully")

        except ImportError as e:
            logger.error(f"❌ Failed to import core services: {e}")
            self.rag_processor = None
            self.model_factory = None
            self.tool_registry = None

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

        # Always use ToolCallingAgent - handles empty tools gracefully
        tools_count = len(request.tools) if request.tools else 0
        logger.info(f"🔧 Tools provided: {tools_count}, always using ToolCallingAgent")

        try:
            # 1. RAG Context Processing (pre-assembled from Next.js)
            rag_context_data = None
            if request.context and request.context.assembled_rag_context:
                logger.info("🔍 Processing pre-assembled RAG context from Next.js...")
                
                # Import RagProcessor classes
                from ...core.rag.rag_processor import RagContextData
                
                # Create RAG context data from the pre-assembled context
                rag_context_data = RagContextData(
                    assembled_context=request.context.assembled_rag_context,
                    sources=list(request.context.rag_sources) if request.context.rag_sources else [],
                    domain_type=request.context.domain_type if request.context.domain_type else None,
                    domain_id=request.context.domain_id if request.context.domain_id else None
                )
                
                logger.info(f"✅ Processed RAG context: {len(rag_context_data.assembled_context)} chars, {len(rag_context_data.sources)} sources")
                
                # Send RAG acknowledgment to client (optional - could be removed)
                if rag_context_data.sources:
                    rag_response = agent_worker_pb2.ProcessMessageResponse(
                        rag_context=self._build_rag_context_proto_from_data(rag_context_data),
                        timestamp=int(time.time() * 1000)
                    )
                    yield rag_response
                    logger.info(f"✅ Sent RAG context acknowledgment with {len(rag_context_data.sources)} sources")

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

            # 3. Generate AI Response using ToolCallingAgent (always)
            sequence = 0
            total_content = ""

            # Always use ToolCallingAgent - handles RAG context and tools
            async for chunk in self._stream_tool_calling_agent_response(
                conversation_messages,
                request.tools if request.tools else [],
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

    async def _stream_ai_response(
        self, 
        conversation_messages: List[Dict[str, str]], 
        rag_context_data: Optional[Any],
        domain_context: Optional[Any] = None
    ) -> AsyncIterator[str]:
        """
        Stream AI response using RAG processor and HuggingFace integration.
        
        This method now uses the real RagProcessor to format context
        and will integrate with actual AI models when available.
        """
        
        # Import here to avoid circular dependencies
        from ...core.rag.rag_processor import RagContextData
        
        try:
            # Build system prompt using real RAG processor
            if self.rag_processor and rag_context_data and isinstance(rag_context_data, RagContextData):
                # Use the real RAG processor for context formatting
                domain_context_dict = {
                    'domain_type': domain_context.domain_type if domain_context else None,
                    'domain_id': domain_context.domain_id if domain_context else None
                } if domain_context else None
                
                system_prompt = self.rag_processor.format_context_for_llm(
                    rag_context_data=rag_context_data,
                    user_query=conversation_messages[-1]['content'] if conversation_messages else '',
                    domain_context=domain_context_dict
                )
                
                logger.info(f"✅ Generated system prompt using RAG processor: {len(system_prompt)} chars")
                
                # Get context metadata for logging
                context_metadata = self.rag_processor.extract_context_metadata(rag_context_data)
                logger.info(f"📊 RAG context metadata: {context_metadata}")
                
            else:
                # Fallback to basic system prompt if no RAG context
                system_prompt = self._build_basic_system_prompt(domain_context)
                logger.info("Using basic system prompt (no RAG context)")

            # Prepare messages for model
            messages = [{'role': 'system', 'content': system_prompt}] + conversation_messages
            
            # Use real AI model streaming
            if self.model_factory:
                logger.info(f"🤖 Streaming AI response using real {self._get_model_name()}")
                
                # Stream response from real AI model
                async for chunk in self.model_factory.stream_response(messages, model_name='chat'):
                    yield chunk
                
            else:
                logger.warning("⚠️ Model factory not available - using enhanced mock response")
                
                # Fallback enhanced mock response
                if rag_context_data and rag_context_data.assembled_context:
                    mock_response = f"Based on the relevant context from your organization's data (found {len(rag_context_data.sources)} sources), I can help you with your request. Let me provide you with specific information from the available documentation and data."
                else:
                    mock_response = "I understand your question. Let me provide you with general guidance about your request."
                
                # Stream the fallback response word by word
                for word in mock_response.split():
                    yield word + " "
                    await asyncio.sleep(0.02)
                
        except Exception as e:
            logger.error(f"❌ AI streaming failed: {e}")
            yield f"I apologize, but I encountered an error processing your request: {str(e)}"

    async def _stream_tool_calling_agent_response(
        self,
        conversation_messages: List[Dict[str, str]],
        tools: List['agent_worker_pb2.ToolConfig'],
        rag_context_data: Optional['RagContextData'],
        domain_context: Optional['agent_worker_pb2.ChatContext'] = None
    ) -> AsyncIterator[str]:
        """
        Stream AI response using ToolCallingAgent with proper streaming support.
        Handles both tool execution and regular chat with RAG context.

        AIDEV-NOTE: Consolidated method that always uses ToolCallingAgent approach,
        whether tools are provided or not. Uses direct model streaming for chat-like
        responses while supporting tool execution when needed.
        """

        try:
            # Import here to avoid circular dependencies
            from ...core.rag.rag_processor import RagContextData

            # Build system prompt using RAG processor if available
            system_prompt = ""
            if self.rag_processor and rag_context_data and isinstance(rag_context_data, RagContextData):
                # Use the real RAG processor for context formatting
                domain_context_dict = {
                    'domain_type': domain_context.domain_type if domain_context else None,
                    'domain_id': domain_context.domain_id if domain_context else None
                } if domain_context else None

                system_prompt = self.rag_processor.format_context_for_llm(
                    rag_context_data=rag_context_data,
                    user_query=conversation_messages[-1]['content'] if conversation_messages else '',
                    domain_context=domain_context_dict
                )

                logger.info(f"✅ Generated system prompt using RAG processor: {len(system_prompt)} chars")
            else:
                # Fallback to basic system prompt if no RAG context
                system_prompt = self._build_basic_system_prompt(domain_context)
                logger.info("Using basic system prompt (no RAG context)")

            # Convert ToolConfig protobuf objects to smolagents tools using tool registry
            smolagents_tools = []
            tool_names = []
            if tools and self.tool_registry:
                logger.info(f"🔧 Processing {len(tools)} tools for ToolCallingAgent")

                # Convert protobuf ToolConfig to core.entities.ToolConfig

                core_tool_configs = []
                for tool_config in tools:
                    tool_names.append(tool_config.name)
                    logger.info(f"Tool: {tool_config.name} (version: {tool_config.version})")

                    # Convert protobuf ToolConfig to core ToolConfig
                    core_config = CoreToolConfig(
                        name=tool_config.name,
                        version=tool_config.version,
                        config=dict(tool_config.config) if tool_config.config else {}
                    )
                    core_tool_configs.append(core_config)

                # Load tools using tool registry (same as agents use)
                try:
                    smolagents_tools = self.tool_registry.load_tools(core_tool_configs)
                    logger.info(f"✅ Loaded {len(smolagents_tools)} smolagents tools via tool registry")
                except Exception as tool_error:
                    logger.error(f"❌ Failed to load tools via registry: {tool_error}")
                    smolagents_tools = []

            elif tools and not self.tool_registry:
                logger.warning("⚠️ Tools provided but tool registry not available")
                tool_names = [tool.name for tool in tools]

            # Use model factory for streaming if available
            if self.model_factory:
                logger.info(f"🤖 Always using ToolCallingAgent approach (with {len(smolagents_tools)} tools)")

                # Always create ToolCallingAgent - handles empty tools gracefully
                try:
                    # Use model provider like the capability router does
                    model_provider = SmolagentsModelProvider()
                    model = model_provider.get_default_model_for_capability()

                    # Create ToolCallingAgent (works with empty tools list)
                    agent = ToolCallingAgent(
                        tools=smolagents_tools,  # Can be empty list
                        model=model,
                        max_steps=10
                    )
                    agent.name = "chat_tool_calling"
                    agent.description = f"Chat agent with {len(smolagents_tools)} tools available"

                    # Build full prompt with system context + user message
                    full_prompt = system_prompt + "\n\n"
                    for msg in conversation_messages:
                        role_prefix = msg['role'].upper() + ": "
                        full_prompt += role_prefix + msg['content'] + "\n"

                    logger.info(f"🚀 Executing ToolCallingAgent with prompt length: {len(full_prompt)} chars")

                    # Execute with ToolCallingAgent - note: this is not streaming yet
                    # AIDEV-TODO: Implement actual streaming when smolagents supports it
                    result = agent.run(full_prompt)

                    # Stream the result word by word to simulate streaming
                    for word in result.split():
                        yield word + " "
                        await asyncio.sleep(0.02)

                except Exception as agent_error:
                    logger.error(f"❌ ToolCallingAgent execution failed: {agent_error}")
                    # Fall back to direct model streaming as last resort
                    logger.info("Falling back to direct model streaming")

                    messages = []
                    if system_prompt:
                        messages.append({'role': 'system', 'content': system_prompt})
                    messages.extend(conversation_messages)

                    async for chunk in self.model_factory.stream_response(messages, model_name='chat'):
                        yield chunk

            else:
                logger.error("❌ Model factory not available - cannot stream response")
                raise RuntimeError("Model factory required for streaming responses")

        except Exception as e:
            logger.error(f"❌ ToolCallingAgent streaming failed: {e}")
            yield f"I apologize, but I encountered an error processing your request: {str(e)}"

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