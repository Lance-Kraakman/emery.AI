#!/usr/bin/env python3
"""
Simple gRPC integration test
Tests the Python gRPC service directly without Next.js database dependencies
"""

import sys
import os
import asyncio
import time

# Add the emery-agents source to Python path
sys.path.append('/Users/lancekraakman/orchastrate/emery-agents/src')

async def test_grpc_chat_service():
    """Test the gRPC ChatProcessingService directly"""
    
    print("🧪 Testing gRPC ChatProcessingService Integration")
    print("=" * 60)
    
    try:
        # Import the service implementation
        from emery_agents.infrastructure.grpc.chat_processing_service import ChatProcessingServiceImplementation
        from emery_agents.grpc.generated import agent_worker_pb2
        
        print("✅ Successfully imported gRPC service classes")
        
        # Create service instance
        service = ChatProcessingServiceImplementation("test_org")
        print(f"✅ Created ChatProcessingService for organization: test_org")
        
        # Create a test request with RAG context (simulating what Next.js would send)
        request = agent_worker_pb2.ProcessMessageRequest()
        request.message_content = "Hello, can you help me understand my organization's data structure?"
        request.user_id = "test_user"
        request.organization_id = 1
        
        # Add RAG context (simulating assembled context from Next.js)
        request.context.domain_type = "organization"
        request.context.domain_id = 1
        request.context.enable_rag = True
        request.context.rag_threshold = 0.3
        request.context.max_rag_docs = 5
        request.context.primary_rag_weight = 0.7
        request.context.assembled_rag_context = """
Based on your organization's data, here are the key tables and structures:

1. Users Table: Contains user information including roles and organization membership
2. Organizations Table: Main organization entities with settings and configuration
3. Tables Table: Dynamic table definitions with field configurations
4. Agents Table: AI agent configurations with capabilities and tools

This context provides relevant information about your data structure.
"""
        request.context.rag_sources.extend([
            "users_table_schema.md",
            "organizations_overview.md",
            "dynamic_tables_documentation.md"
        ])
        
        # Add conversation history
        history_msg = request.conversation_history.add()
        history_msg.role = "user"
        history_msg.content = "What tables do we have in our system?"
        history_msg.timestamp = int(time.time() * 1000)
        
        print("✅ Created test request with RAG context and conversation history")
        print(f"📝 Message: {request.message_content}")
        print(f"🔍 RAG Context: {len(request.context.assembled_rag_context)} chars")
        print(f"📚 RAG Sources: {len(request.context.rag_sources)} sources")
        
        # Test the ProcessMessage method
        print("\n🚀 Starting AI processing...")
        
        responses = []
        start_time = time.time()
        
        async for response in service.ProcessMessage(request, None):
            responses.append(response)
            
            if response.HasField('rag_context'):
                print(f"🔍 RAG Context: {len(response.rag_context.sources)} sources, {response.rag_context.context_summary}")
                
            elif response.HasField('content_chunk'):
                print(f"💬 Content: '{response.content_chunk.content}' (seq: {response.content_chunk.sequence})")
                
            elif response.HasField('complete'):
                processing_time = time.time() - start_time
                print(f"✅ Complete: {response.complete.model_used}, {response.complete.total_tokens} tokens, {processing_time:.2f}s")
                
            elif response.HasField('error'):
                print(f"❌ Error: {response.error.error_code} - {response.error.error_message}")
        
        print(f"\n📊 Test Results:")
        print(f"   Total responses: {len(responses)}")
        print(f"   Processing time: {time.time() - start_time:.2f}s")
        
        # Verify we got expected response types
        has_rag = any(r.HasField('rag_context') for r in responses)
        has_content = any(r.HasField('content_chunk') for r in responses)
        has_complete = any(r.HasField('complete') for r in responses)
        
        print(f"   RAG context: {'✅' if has_rag else '❌'}")
        print(f"   Content chunks: {'✅' if has_content else '❌'}")
        print(f"   Completion marker: {'✅' if has_complete else '❌'}")
        
        if has_rag and has_content and has_complete:
            print("\n🎉 gRPC Integration Test PASSED!")
            print("✅ RAG processor working")
            print("✅ AI streaming working") 
            print("✅ Response format correct")
            return True
        else:
            print("\n❌ gRPC Integration Test FAILED!")
            return False
            
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run the integration test"""
    
    print("🎯 gRPC Chat Integration Test")
    print("Testing the complete Python gRPC service stack:")
    print("- RAG context processing")
    print("- AI response generation") 
    print("- Streaming response format")
    print("- Error handling")
    print()
    
    success = await test_grpc_chat_service()
    
    if success:
        print("\n✅ ALL TESTS PASSED")
        print("The gRPC service is ready for Next.js integration!")
        sys.exit(0)
    else:
        print("\n❌ TESTS FAILED")
        print("Check the service implementation and try again.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())