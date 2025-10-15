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

            # Tool registry repository for converting ToolConfig to smolagents tools
            try:
                from ...infrastructure.db.repositories.tools.tool_registry_repository import ToolRegistryRepository
                self.tool_registry = ToolRegistryRepository()
                logger.info("✅ ToolRegistryRepository initialized successfully")
            except ImportError as tool_error:
                logger.warning(f"⚠️ ToolRegistryRepository not available: {tool_error}")
                self.tool_registry = None

            logger.info("✅ ChatProcessingService initialized successfully")

        except ImportError as e:
            logger.error(f"❌ Failed to import core services: {e}")
            self.rag_processor = None
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
        tools_count = len(request.tools) if hasattr(request, 'tools') and request.tools else 0
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
            tools_to_use = request.tools if hasattr(request, 'tools') and request.tools else []
            logger.info(f"📨 Request tools received: {len(tools_to_use)} tools")
            if tools_to_use:
                for i, tool in enumerate(tools_to_use):
                    logger.info(f"  Tool {i}: name={tool.name}, config_keys={list(tool.config.keys()) if tool.config else 'none'}")
            else:
                logger.info("  No tools received from frontend")

            async for chunk in self._stream_tool_calling_agent_response(
                conversation_messages,
                tools_to_use,
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
                        'rag_sources': str(len(rag_context_data.sources) if rag_context_data else 0),
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


    async def _stream_tool_calling_agent_response(
        self,
        conversation_messages: List[Dict[str, str]],
        tools: List['agent_worker_pb2.ToolConfig'],
        rag_context_data: Optional['RagContextData'],
        domain_context: Optional['agent_worker_pb2.ChatContext'] = None
    ) -> AsyncIterator[str]:
        """
        Stream AI response using ToolCallingAgent with proper streaming support.
        Always uses ToolCallingAgent approach whether tools are provided or not.

        AIDEV-NOTE: Uses agent.run() and simulates streaming by chunking the result
        since smolagents doesn't natively support streaming.
        """

        try:
            # Import here to avoid circular dependencies
            from ...core.rag.rag_processor import RagContextData

            # 1. Build system prompt using RAG processor if available
            system_prompt = self._build_system_prompt_with_rag(rag_context_data, domain_context)
            logger.info(f"📝 Built system prompt: {len(system_prompt)} chars")

            # 2. Convert protobuf tools to smolagents tools
            smolagents_tools = self._convert_tools_to_smolagents(tools)
            logger.info(f"🔧 Converted {len(smolagents_tools)} tools for ToolCallingAgent")

            # 3. Create ToolCallingAgent with model provider
            agent = self._create_agent_with_model_provider(smolagents_tools)
            logger.info(f"🤖 Created ToolCallingAgent with {len(smolagents_tools)} tools")

            # 4. Build conversation prompt
            full_prompt = self._build_conversation_prompt(system_prompt, conversation_messages)
            logger.info(f"💬 Built conversation prompt: {len(full_prompt)} chars")

            # 5. Execute with ToolCallingAgent (synchronous) and stream result
            logger.info("🚀 Executing ToolCallingAgent...")
            result = agent.run(full_prompt)  # This is synchronous in smolagents
            logger.info(f"✅ Execution completed: {len(result)} chars")

            # 6. Stream the result by chunks to simulate streaming
            async for chunk in self._stream_text_chunks(result):
                yield chunk

        except Exception as e:
            logger.error(f"❌ ToolCallingAgent execution failed: {e}")
            yield f"I apologize, but I encountered an error processing your request: {str(e)}"

    def _build_system_prompt_with_rag(
        self,
        rag_context_data: Optional['RagContextData'],
        domain_context: Optional['agent_worker_pb2.ChatContext']
    ) -> str:
        """Build system prompt with RAG context integration."""
        if self.rag_processor and rag_context_data:
            from ...core.rag.rag_processor import RagContextData

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

    def _convert_tools_to_smolagents(self, tools: List['agent_worker_pb2.ToolConfig']) -> List[Any]:
        """Convert protobuf ToolConfig objects to smolagents tools."""
        if not tools:
            logger.info("No tools provided to convert")
            return []

        if not self.tool_registry:
            logger.error("❌ Tool registry not available - tools cannot be loaded")
            return []

        try:
            core_tool_configs = []
            logger.info(f"🔧 Converting {len(tools)} tools to smolagents format...")

            for tool_config in tools:
                logger.info(f"Converting tool: {tool_config.name}")
                logger.info(f"  Config keys: {list(tool_config.config.keys()) if tool_config.config else 'none'}")
                logger.info(f"  Config values: {dict(tool_config.config) if tool_config.config else {}}")

                # Keep original tool name - let UnifiedToolLoader handle name resolution
                tool_name = tool_config.name

                core_config = CoreToolConfig(
                    name=tool_name,
                    version=tool_config.version or '',
                    config=dict(tool_config.config) if tool_config.config else {}
                )
                core_tool_configs.append(core_config)
                logger.info(f"  Created CoreToolConfig: name={core_config.name}, config={core_config.config}")

            logger.info(f"🚀 Calling tool_registry.load_tools with {len(core_tool_configs)} configs...")
            smolagents_tools = []

            for core_config in core_tool_configs:
                try:
                    logger.info(f"🔧 Loading individual tool: {core_config.name}")
                    # For chat system, use user API key mode - extract API key from enriched config
                    api_key = core_config.config.get('api_key', '')
                    logger.info(f"  Extracted API key from config: present={bool(api_key)}")
                    tool_instance = self.tool_registry.load_tool(core_config, api_key=api_key, api_key_mode="user")
                    smolagents_tools.append(tool_instance)
                    logger.info(f"✅ Successfully loaded tool: {core_config.name}")
                except Exception as tool_error:
                    logger.error(f"❌ Failed to load tool {core_config.name}: {tool_error}")
                    logger.error(f"❌ Tool config was: {core_config.config}")
                    import traceback
                    logger.error(f"❌ Tool loading traceback: {traceback.format_exc()}")

            logger.info(f"✅ Successfully converted {len(smolagents_tools)} out of {len(tools)} tools")
            return smolagents_tools

        except Exception as tool_error:
            logger.error(f"❌ Failed to convert tools: {tool_error}")
            import traceback
            logger.error(f"❌ Tool conversion traceback: {traceback.format_exc()}")
            return []

    def _create_agent_with_model_provider(self, smolagents_tools: List[Any]) -> ToolCallingAgent:
        """Create ToolCallingAgent using simplified model provider."""
        # Use simplified model provider
        model_provider = SmolagentsModelProvider()
        model = model_provider.get_model('tool_calling')

        agent = ToolCallingAgent(
            tools=smolagents_tools,  # Can be empty list
            model=model,
            max_steps=10
        )
        agent.name = "chat_tool_calling"
        agent.description = f"Chat agent with {len(smolagents_tools)} tools available"

        return agent

    def _build_conversation_prompt(self, system_prompt: str, conversation_messages: List[Dict[str, str]]) -> str:
        """Build full conversation prompt for ToolCallingAgent."""
        full_prompt = system_prompt + "\n\n" if system_prompt else ""

        for msg in conversation_messages:
            role_prefix = msg['role'].upper() + ": "
            full_prompt += role_prefix + msg['content'] + "\n"

        return full_prompt.strip()

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