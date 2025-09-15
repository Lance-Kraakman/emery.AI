/**
 * gRPC-based Chat Streaming API Route
 * 
 * Architecture:
 * - Next.js: Handles authentication, database operations, session management
 * - gRPC Service: Handles AI processing, RAG context, LLM streaming
 * 
 * Flow:
 * 1. Next.js: Authenticate user, create/get chat session, save user message
 * 2. Next.js: Get conversation history from database
 * 3. Next.js: Call gRPC service for AI processing with message + history
 * 4. gRPC: Process RAG context, generate AI response, stream back
 * 5. Next.js: Stream response to frontend, save assistant message
 * 
 * AIDEV-NOTE: Clean separation - database stays in Next.js, AI processing in gRPC
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

// Import Value Objects for proper type safety
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Import existing chat services (DIContainer now auto-initializes)
import { getChatApplicationService, getDynamicTableRepository, getAgentRepository } from '@/ddd/application/di/container';
import type { CreateChatCommand, SendMessageCommand } from '@/ddd/application/services/chat/chat-application-service';

// Import RAG services
import { DualContextRagService, type DomainContextOptions } from '@/ddd/application/services/chat/dual-context-rag-service';

// Import gRPC client
import { getChatProcessingClient, type StreamingChatResponse, type ChatProcessingOptions } from '@/lib/grpc/chat-processing-client';
import type { HistoryMessage } from '@/lib/grpc/generated/agent_worker';

export async function POST(req: NextRequest) {
  try {
    console.log('[CHAT-GRPC-API] Starting gRPC-based chat request processing');
    
    // 1. Authentication (Next.js responsibility)
    const session = await auth();
    console.log('[CHAT-GRPC-API] Session status:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      currentOrganizationId: session?.user?.currentOrganizationId
    });
    
    // AIDEV-NOTE: Development bypass for testing - remove in production
    let userId = session?.user?.id;
    let currentOrganizationId = session?.user?.currentOrganizationId;
    
    if (!session?.user && process.env.NODE_ENV === 'development') {
      const testUserId = req.headers.get('x-test-user-id');
      if (testUserId === '550e8400-e29b-41d4-a716-446655440000') {
        userId = testUserId;
        // For testing purposes, use a default organization ID
        currentOrganizationId = 1; // Default test organization
        console.log('[CHAT-GRPC-API] Using development bypass for test user');
      } else {
        console.error('[CHAT-GRPC-API] Authentication failed - no valid session or user ID');
        return new Response(
          JSON.stringify({ error: 'Authentication required. Please log in and try again.' }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } else if (!session?.user) {
      console.error('[CHAT-GRPC-API] Authentication failed - no valid session or user ID');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in and try again.' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Parse request
    const { messages, chatId, domainType, domainId, tools = [] } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    console.log('[CHAT-GRPC-API] Request includes tools:', {
      toolCount: tools.length,
      toolNames: tools.map((t: any) => t.name)
    });
    
    if (!latestMessage) {
      return new Response(
        JSON.stringify({ error: 'No message content provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = currentOrganizationId;
    if (!organizationId) {
      console.error('[CHAT-GRPC-API] No current organization found for user:', userId);
      return new Response(
        JSON.stringify({ 
          error: 'No current organization found. Please select an organization and try again.' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. Database Operations (Next.js responsibility)
    const chatApplicationService = getChatApplicationService();
    let currentChatId = chatId;
    let currentChat: any = null;

    // Create or retrieve chat session
    if (!currentChatId && latestMessage) {
      console.log('[CHAT-GRPC-API] Creating new chat session');
      const createChatCommand: CreateChatCommand = {
        organizationId: OrganizationId.fromNumber(organizationId),
        createdBy: UserId.fromString(userId),
        domainType: domainType as any,
        domainId: domainId ? parseInt(domainId) : undefined
      };

      const chatResult = await chatApplicationService.createChat(createChatCommand);
      if (!chatResult.success) {
        return new Response(
          JSON.stringify({ error: chatResult.error || 'Failed to create chat' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      currentChatId = chatResult.data!.id;
      currentChat = chatResult.data;
      console.log(`[CHAT-GRPC-API] Created new chat session: ${currentChatId}`);
      
    } else if (currentChatId) {
      console.log('[CHAT-GRPC-API] Retrieving existing chat session');
      const chatHistory = await chatApplicationService.getChatHistory({
        chatId: currentChatId,
        userId: userId,
        organizationId,
        limit: 1
      });
      
      if (chatHistory.success) {
        currentChat = chatHistory.data?.chat;
      }
    }

    // Save user message
    if (currentChatId && latestMessage) {
      console.log('[CHAT-GRPC-API] Saving user message to database');
      const userMessageCommand: SendMessageCommand = {
        chatId: currentChatId,
        userId: UserId.fromString(userId),
        organizationId: OrganizationId.fromNumber(organizationId),
        content: latestMessage,
        role: 'user'
      };

      const messageResult = await chatApplicationService.sendMessage(userMessageCommand);
      if (!messageResult.success) {
        console.warn('[CHAT-GRPC-API] Failed to save user message:', messageResult.error);
      }
    }

    // 4. Get conversation history (Next.js database)
    let conversationHistory: HistoryMessage[] = [];
    if (currentChatId) {
      console.log('[CHAT-GRPC-API] Retrieving conversation history from database');
      const historyResult = await chatApplicationService.getChatHistory({
        chatId: currentChatId,
        userId: UserId.fromString(userId),
        organizationId: OrganizationId.fromNumber(organizationId),
        limit: 10 // Last 10 messages for context
      });
      
      if (historyResult.success && historyResult.data?.messages) {
        conversationHistory = historyResult.data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.createdAt).getTime()
        }));
        console.log(`[CHAT-GRPC-API] Retrieved ${conversationHistory.length} historical messages`);
      }
    }

    // 5. Determine processing options from contextMetadata or request params
    let resolvedDomainType = currentChat?.contextMetadata?.contextType || domainType;
    let resolvedDomainId = currentChat?.contextMetadata?.domainSchema?.id || domainId;

    // Convert 'organization' contextType to null for processing
    if (resolvedDomainType === 'organization') {
      resolvedDomainType = null;
      resolvedDomainId = null;
    }

    const processingOptions: ChatProcessingOptions = {
      domainType: resolvedDomainType,
      domainId: resolvedDomainId,
      enableRag: true, // Enable RAG by default
      ragThreshold: 0.3,
      maxRagDocs: 5,
      primaryRagWeight: 0.7,
      tools: tools // NEW: Add tools to processing options
    };

    console.log('[CHAT-GRPC-API] Chat processing options:', processingOptions);

    // 6. Set up streaming response
    let fullAssistantResponse = '';
    let ragSources: any[] = [];

    const responseStream = new TransformStream({
      start() {
        console.log('[CHAT-GRPC-API] Starting response stream transform');
      },
      
      transform(chunk: Uint8Array, controller) {
        // Pass through chunks directly to frontend
        controller.enqueue(chunk);
      },
      
      flush() {
        console.log('[CHAT-GRPC-API] Response stream complete, saving assistant message');
        
        // Save the complete assistant response asynchronously
        if (currentChatId && fullAssistantResponse.trim()) {
          const saveAssistantMessage = async () => {
            try {
              const assistantMessageCommand: SendMessageCommand = {
                chatId: currentChatId,
                userId: UserId.fromString(userId),
                organizationId: OrganizationId.fromNumber(organizationId),
                content: fullAssistantResponse.trim(),
                role: 'assistant',
                metadata: {
                  ragSources: ragSources,
                  processingTime: Date.now() - startTime,
                  modelUsed: 'qwen-coder' // This will come from gRPC response
                }
              };
              
              await chatApplicationService.sendMessage(assistantMessageCommand);
              console.log(`[CHAT-GRPC-API] Saved assistant response to chat ${currentChatId}`);
            } catch (error) {
              console.error('[CHAT-GRPC-API] Failed to save assistant response:', error);
            }
          };
          
          saveAssistantMessage();
        }
      }
    });

    // 6. Get RAG context using DualContextRagService
    console.log('[CHAT-GRPC-API] Gathering RAG context using DualContextRagService');
    let ragContextForGrpc = '';
    try {
      // Initialize dual-context RAG service
      const tableRepository = getDynamicTableRepository();
      const agentRepository = getAgentRepository();
      const dualContextRagService = new DualContextRagService(tableRepository, agentRepository);

      // Build context options
      const contextOptions: DomainContextOptions = {
        domainType: resolvedDomainType,
        domainId: resolvedDomainId,
        organizationId,
        query: latestMessage,
        primaryWeight: processingOptions.primaryRagWeight || 0.7,
        maxPrimaryDocs: 10,
        maxSecondaryDocs: 20,
        similarityThreshold: processingOptions.ragThreshold || 0.3
      };

      // Get dual-context RAG results
      const dualContextResult = await dualContextRagService.getDualContext(contextOptions);

      if (dualContextResult.totalDocuments > 0) {
        ragContextForGrpc = dualContextRagService.formatContextForSystemMessage(dualContextResult);
        ragSources = dualContextRagService.getRagSourceSummary(dualContextResult);

        // Add assembled RAG context to processing options
        processingOptions.assembledRagContext = ragContextForGrpc;
        processingOptions.ragSources = ragSources;

        console.log(`[CHAT-GRPC-API] Generated RAG context with ${dualContextResult.primaryContext.length} primary + ${dualContextResult.secondaryContext.length} secondary docs`);
        console.log(`[CHAT-GRPC-API] Context type: ${resolvedDomainType || 'organization'} chat`);
        console.log(`[CHAT-GRPC-API] RAG context size: ${ragContextForGrpc.length} chars`);
      } else {
        console.log('[CHAT-GRPC-API] No relevant RAG context found');
      }
    } catch (ragError) {
      console.error('[CHAT-GRPC-API] RAG context generation failed:', ragError);
      // Continue without RAG context
    }

    // 7. Call gRPC service for AI processing
    console.log('[CHAT-GRPC-API] Calling gRPC ChatProcessingService for AI processing');
    const startTime = Date.now();
    
    // Create readable stream for frontend
    const readableStream = new ReadableStream({
      start(controller) {
        const grpcClient = getChatProcessingClient(organizationId.toString());
        
        // Process message with gRPC service
        grpcClient.processMessage(
          latestMessage,
          userId,
          organizationId,
          conversationHistory,
          processingOptions,
          (response: StreamingChatResponse) => {
            console.log(`[CHAT-GRPC-API] Received gRPC response:`, {
              type: response.type,
              hasContent: !!response.content,
              timestamp: response.timestamp
            });

            try {
              if (response.type === 'content' && response.content) {
                // Stream content chunk to frontend
                fullAssistantResponse += response.content;
                const chunk = new TextEncoder().encode(response.content);
                controller.enqueue(chunk);

              } else if (response.type === 'rag_context' && response.ragContext) {
                // Store RAG sources for later saving to database
                ragSources = response.ragContext.sources || [];
                console.log(`[CHAT-GRPC-API] Received RAG context with ${ragSources.length} sources`);

              } else if (response.type === 'complete' && response.complete) {
                // AI processing completed
                console.log(`[CHAT-GRPC-API] AI processing completed:`, {
                  model: response.complete.model_used,
                  tokens: response.complete.total_tokens,
                  processingTime: response.complete.processing_time_ms
                });
                controller.close();
                
              } else if (response.type === 'error' && response.error) {
                // AI processing error
                console.error('[CHAT-GRPC-API] AI processing error:', response.error);
                const errorMessage = `AI processing error: ${response.error.error_message}`;
                const chunk = new TextEncoder().encode(errorMessage);
                controller.enqueue(chunk);
                controller.close();
              }
              
            } catch (streamError) {
              console.error('[CHAT-GRPC-API] Stream processing error:', streamError);
              controller.error(streamError);
            }
          }
        ).then(() => {
          console.log('[CHAT-GRPC-API] gRPC processing completed successfully');
        }).catch((error) => {
          console.error('[CHAT-GRPC-API] gRPC processing failed:', error);
          try {
            const errorMessage = `\n\n[Error: AI service unavailable. Please try again.]`;
            const chunk = new TextEncoder().encode(errorMessage);
            controller.enqueue(chunk);
            controller.close();
          } catch (streamError) {
            console.error('[CHAT-GRPC-API] Failed to send error message to stream:', streamError);
            controller.close();
          }
        });
      }
    });

    // Return streaming response
    return new Response(readableStream.pipeThrough(responseStream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    });
    
  } catch (error) {
    console.error('[CHAT-GRPC-API] Request processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}