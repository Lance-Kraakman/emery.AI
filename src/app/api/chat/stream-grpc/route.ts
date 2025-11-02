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
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// Import existing chat services (DIContainer now auto-initializes)
import { getChatApplicationService, getDynamicTableRepository, getAgentRepository, getToolConfigurationApplicationService, getUserRepository, getOrganizationRepository } from '@/ddd/application/di/container';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { getTokenUsageRepository } from '@/ddd/application/di/getters';
import type { CreateChatDTO, SendMessageDTO } from '@/app/dtos/chat.dto';
import type { EnrichToolsWithUserApiKeyCommand } from '@/ddd/application/services/tools/tool-configuration-application-service';

// Import user API key utilities
import { assignApiKeyToUser } from '@/lib/auth/user-api-keys';

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

    // 2. Parse request and get user's agent API key for tools
    const { messages, chatId, domainType, domainId, tools = [] } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    console.log('[CHAT-GRPC-API] Request includes tools:', {
      toolCount: tools.length,
      toolNames: tools.map((t: any) => t.name)
    });

    if (!currentOrganizationId) {
      console.error('[CHAT-GRPC-API] No current organization found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'No organization context available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
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

    // 2.5 Check token quota before processing
    console.log('[CHAT-GRPC-API] Checking token quota for organization:', organizationId);
    const tokenUsageRepo = getTokenUsageRepository();
    const tokenUsageService = new TokenUsageApplicationService(tokenUsageRepo);
    const quotaCheck = await tokenUsageService.checkQuota(organizationId);

    console.log('[CHAT-GRPC-API] Quota check result:', {
      allowed: quotaCheck.allowed,
      currentUsage: quotaCheck.currentUsage,
      quotaExceeded: quotaCheck.quotaExceeded,
      percentageUsed: quotaCheck.percentageUsed
    });

    if (quotaCheck.quotaExceeded) {
      console.error('[CHAT-GRPC-API] Monthly token quota exceeded for organization:', organizationId);
      return new Response(
        JSON.stringify({
          error: 'Monthly token quota exceeded',
          message: 'Your organization has exceeded its monthly token quota. Please upgrade your plan or wait until the quota resets.',
          currentUsage: quotaCheck.currentUsage,
          monthlyQuota: quotaCheck.monthlyQuota,
          percentageUsed: quotaCheck.percentageUsed
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': quotaCheck.monthlyQuota?.toString() || 'unlimited',
            'X-RateLimit-Remaining': Math.max(0, (quotaCheck.monthlyQuota || 0) - quotaCheck.currentUsage).toString(),
            'X-RateLimit-Reset': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Approximation
          }
        }
      );
    }

    // AIDEV-NOTE: Add warning headers if approaching quota limit (80% or 95%)
    const quotaWarningHeaders: Record<string, string> = {};
    if (quotaCheck.percentageUsed && quotaCheck.percentageUsed >= 80) {
      const warningLevel = quotaCheck.percentageUsed >= 95 ? 'critical' : 'warning';
      quotaWarningHeaders['X-Quota-Warning'] = warningLevel;
      quotaWarningHeaders['X-Quota-Usage'] = quotaCheck.percentageUsed.toFixed(1);
      console.log(`[CHAT-GRPC-API] Quota ${warningLevel}: ${quotaCheck.percentageUsed.toFixed(1)}% used`);
    }

    // 3. Database Operations (Next.js responsibility)
    const chatApplicationService = getChatApplicationService();
    let currentChatId = chatId;
    let currentChat: any = null;

    // Create or retrieve chat session
    if (!currentChatId && latestMessage) {
      console.log('[CHAT-GRPC-API] Creating new chat session');
      const createChatDTO: CreateChatDTO = {
        organizationId: organizationId,
        createdBy: userId,
        domainType: domainType as any,
        domainId: domainId ? parseInt(domainId) : undefined
      };

      const chatResult = await chatApplicationService.createChat(createChatDTO);
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
        currentChat = chatHistory.data;
      }
    }

    // Save user message
    if (currentChatId && latestMessage) {
      console.log('[CHAT-GRPC-API] Saving user message to database');
      const userMessageDTO: SendMessageDTO = {
        chatId: currentChatId,
        userId: userId,
        organizationId: organizationId,
        content: latestMessage,
        role: 'user'
      };

      const messageResult = await chatApplicationService.sendMessage(userMessageDTO);
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
        userId: userId,
        organizationId: organizationId,
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

    // 5.5 Get organization's default AI model
    console.log('[CHAT-GRPC-API] Fetching organization default model');
    const orgRepository = getOrganizationRepository();
    const organization = await orgRepository.findById(OrganizationId.fromNumber(organizationId));
    const defaultModel = organization?.defaultModel || null;
    console.log('[CHAT-GRPC-API] Organization default model:', defaultModel || 'not set (will use system default)');

    // 5.1 Enrich tools with user API key for chat-based tool execution
    let enrichedTools: any[] = tools;
    if (tools.length > 0 && userId) {
      try {
        console.log('[CHAT-GRPC-API] Starting tool enrichment with user API key');

        // Get user's API key from repository
        const userRepository = getUserRepository();
        const user = await userRepository.findById(UserId.fromString(userId));

        let userApiKey: string | null = null;
        if (user && user.apiKey) {
          userApiKey = user.apiKey.value;
          console.log('[CHAT-GRPC-API] Found existing user API key');
        } else {
          console.log('[CHAT-GRPC-API] No user API key found, generating new one');
          // Generate API key for user if they don't have one
          userApiKey = await assignApiKeyToUser(userId);
          console.log('[CHAT-GRPC-API] Generated new user API key');
        }

        if (userApiKey) {
          // Convert plain tools to ToolConfig Value Objects
          const toolConfigs = tools.map((tool: any) => ToolConfig.fromPlain(tool));

          // Use application service to enrich tools with user API key
          const toolConfigService = getToolConfigurationApplicationService();
          const enrichCommand: EnrichToolsWithUserApiKeyCommand = {
            tools: toolConfigs,
            userApiKey: userApiKey
          };

          const enrichResult = await toolConfigService.enrichToolsWithUserApiKey(enrichCommand);

          if (enrichResult.success && enrichResult.data) {
            // Convert back to plain objects for gRPC transmission
            enrichedTools = enrichResult.data.enrichedTools.map((tc: ToolConfig) => tc.toPlain());

            console.log('[CHAT-GRPC-API] Tool enrichment result:', {
              toolCount: enrichedTools.length,
              userApiKeyProvided: enrichResult.data.userApiKeyProvided,
              toolNames: enrichedTools.map(t => t.name)
            });

            // Debug: Log first tool's config to verify api_key is present
            if (enrichedTools.length > 0) {
              console.log('[CHAT-GRPC-API] First enriched tool config sample:', {
                name: enrichedTools[0].name,
                hasApiKey: !!enrichedTools[0].config?.api_key,
                apiKeyPresent: enrichedTools[0].config?.api_key ? 'YES' : 'NO',
                configKeys: Object.keys(enrichedTools[0].config || {})
              });
            }
          } else {
            console.error('[CHAT-GRPC-API] Failed to enrich tools with user API key:', enrichResult.error);
            // Continue with original tools if enrichment fails
          }
        } else {
          console.warn('[CHAT-GRPC-API] Could not obtain user API key for tool enrichment');
        }
      } catch (error) {
        console.error('[CHAT-GRPC-API] Error during tool enrichment:', error);
        // Continue with original tools if enrichment fails
      }
    }

    const processingOptions: ChatProcessingOptions = {
      domainType: resolvedDomainType,
      domainId: resolvedDomainId,
      enableRag: true, // Enable RAG by default
      ragThreshold: 0.3,
      maxRagDocs: 5,
      primaryRagWeight: 0.7,
      tools: enrichedTools, // DDD-enriched tools with user API key authentication
      defaultModel: defaultModel // Organization's default AI model
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
              const assistantMessageDTO: SendMessageDTO = {
                chatId: currentChatId,
                userId: userId,
                organizationId: organizationId,
                content: fullAssistantResponse.trim(),
                role: 'assistant',
                metadata: {
                  ragSources: ragSources,
                  processingTime: Date.now() - startTime,
                  modelUsed: 'qwen-coder' // This will come from gRPC response
                }
              };

              await chatApplicationService.sendMessage(assistantMessageDTO);
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
                  model: response.complete.modelUsed,
                  tokens: response.complete.totalTokens,
                  processingTime: response.complete.processingTimeMs,
                  tokenUsage: response.complete.tokenUsage
                });

                // Record token usage for billing
                if (response.complete.tokenUsage) {
                  const tokenUsage = response.complete.tokenUsage;
                  tokenUsageService.recordTokenUsage({
                    organizationId: organizationId,
                    userId: userId,
                    entityType: 'chat' as const,
                    entityId: currentChatId,
                    modelName: tokenUsage.modelName,
                    inputTokens: tokenUsage.inputTokens,
                    outputTokens: tokenUsage.outputTokens,
                    processingTimeMs: response.complete.processingTimeMs,
                    metadata: {
                      chatContext: 'streaming'
                    }
                  }).catch((error) => {
                    console.error('[CHAT-GRPC-API] Failed to record token usage:', error);
                    // Don't fail the request if token recording fails
                  });
                }

                controller.close();
                
              } else if (response.type === 'error' && response.error) {
                // AI processing error
                console.error('[CHAT-GRPC-API] AI processing error:', response.error);
                const errorMessage = `AI processing error: ${response.error.errorMessage}`;
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

    // Return streaming response with quota warning headers if applicable
    return new Response(readableStream.pipeThrough(responseStream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        ...quotaWarningHeaders, // Include quota warning headers if approaching limit
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