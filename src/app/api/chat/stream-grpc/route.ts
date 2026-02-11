/**
 * gRPC-based Chat Streaming API Route
 *
 * Architecture:
 * - Next.js: Handles authentication, database operations, session management
 * - gRPC Service: Handles AI processing, LLM streaming
 *
 * Flow:
 * 1. Next.js: Authenticate user, create/get chat session, save user message
 * 2. Next.js: Get conversation history from database
 * 3. Next.js: Call gRPC service for AI processing with message + history
 * 4. gRPC: Generate AI response, stream back
 * 5. Next.js: Stream response to frontend, save assistant message
 *
 * AIDEV-NOTE: Clean separation - database stays in Next.js, AI processing in gRPC
 */

// AIDEV-NOTE: Extend serverless function timeout for long-running AI tasks
// Vercel Pro allows up to 300s (5 min), Hobby plan allows 60s
// This prevents premature timeout for complex multi-step agent executions
export const maxDuration = 300; // 5 minutes

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

// Import Value Objects for proper type safety
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { contextManager } from '@/ddd/infrastructure/db/context-manager';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// Import existing chat services (DIContainer now auto-initializes)
import { getChatApplicationService, getToolConfigurationApplicationService, getOrganizationRepository, getStorageQuotaApplicationService, getAuditApplicationService } from '@/ddd/application/di/container';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { getTokenUsageRepository } from '@/ddd/application/di/getters';
import type { CreateChatDTO, SendMessageDTO, UpdateMessageDTO, ExecutionStep } from '@/app/dtos/chat.dto';
import type { EnrichToolsWithUserApiKeyCommand } from '@/ddd/application/services/tools/tool-configuration-application-service';

// Import user API key utilities
import { ensureFreshUserApiKey } from '@/lib/auth/user-api-keys';

// Import shared chat utilities
import { getMessageContent } from '@/lib/chat/message-helpers';
import { processStepProgress, processContentChunk, processCompletion, encodeSSEEvent } from '@/lib/chat/event-processors';
import { formatPlanToMarkdown, formatQuestionsForChat } from '@/lib/chat/format-utils';
import { generateChatTitleFromMessage } from '@/lib/utils/chat-title';

// Import gRPC client
import { getChatProcessingClient, type StreamingChatResponse, type ChatProcessingOptions } from '@/ddd/infrastructure/grpc/chat-processing-client';
import type { HistoryMessage } from '@/ddd/infrastructure/grpc/generated/agent_worker';
import type { MessagePart } from '@llamaindex/chat-ui';
import { s3ChatAttachmentService } from '@/ddd/infrastructure/multimodal/s3-chat-attachment-service';
import type { AnyAttachmentMetadata } from '@/ddd/domain/multimodal/value-objects/attachment-metadata';
import { messageWithAttachmentsToProtoParts } from '@/ddd/infrastructure/grpc/mappers/message-part-mapper';

/**
 * Debounce utility for incremental message saves during streaming
 * AIDEV-NOTE: Schedules updates with a delay, flushes on demand for final save
 */
function createDebouncedUpdater(delayMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingUpdate: (() => Promise<void>) | null = null;

  return {
    schedule(updateFn: () => Promise<void>) {
      pendingUpdate = updateFn;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (pendingUpdate) {
          try {
            await pendingUpdate();
          } catch (error) {
            console.error('[CHAT-GRPC-API] Debounced update failed:', error);
          }
          pendingUpdate = null;
        }
      }, delayMs);
    },
    async flush() {
      if (timeoutId) clearTimeout(timeoutId);
      if (pendingUpdate) {
        try {
          await pendingUpdate();
        } catch (error) {
          console.error('[CHAT-GRPC-API] Flush update failed:', error);
        }
        pendingUpdate = null;
      }
    }
  };
}

export async function POST(req: NextRequest) {
  try {
    console.log('[CHAT-GRPC-API] Starting gRPC-based chat request processing');
    
    // 1. Authentication (Next.js responsibility)
    const session = await auth();
    console.log('[CHAT-GRPC-API] Session status:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasOrganization: !!session?.user?.currentOrganizationId
    });
    
    // SECURITY: Require authenticated session - no bypass
    const userId = session?.user?.id;
    const currentOrganizationId = session?.user?.currentOrganizationId;

    if (!session?.user || !userId) {
      console.error('[CHAT-GRPC-API] Authentication failed - no valid session or user ID');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in and try again.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Parse request (handle both JSON and FormData with file uploads)
    const contentType = req.headers.get('content-type') || '';
    let messages: any[];
    let chatId: string | undefined;
    let messageId: string;
    let domainType: string | undefined;
    let domainId: number | undefined;
    let requestModel: string | undefined;  // Model override from frontend
    let tools: any[] = [];
    const uploadedFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with file uploads
      console.log('[CHAT-GRPC-API] Parsing FormData request with attachments');
      const formData = await req.formData();

      // Parse JSON data field
      const dataField = formData.get('data');
      if (!dataField || typeof dataField !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid data field in FormData' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const parsedData = JSON.parse(dataField);
      messages = parsedData.messages;
      chatId = parsedData.chatId;
      messageId = parsedData.messageId;
      domainType = parsedData.domainType;
      domainId = parsedData.domainId;
      requestModel = parsedData.model;
      tools = parsedData.tools || [];

      // Extract uploaded files
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file_') && value instanceof File) {
          uploadedFiles.push(value);
        }
      }

      console.log('[CHAT-GRPC-API] Extracted attachments:', {
        count: uploadedFiles.length,
        files: uploadedFiles.map(f => ({ name: f.name, type: f.type, size: f.size }))
      });
    } else {
      // Handle standard JSON request
      const body = await req.json();
      messages = body.messages;
      chatId = body.chatId;
      messageId = body.messageId;
      domainType = body.domainType;
      domainId = body.domainId;
      requestModel = body.model;
      tools = body.tools || [];

      console.log('[CHAT-GRPC-API] [DEBUG] Received tools from frontend:', tools.map((t: any) => t.name));
    }

    const latestMessage = getMessageContent(messages[messages.length - 1]);

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

    // AIDEV-NOTE: Set RLS context for all subsequent database operations
    // Uses asyncLocalStorage.enterWith() to set context for entire async chain
    contextManager.setContext(
      OrganizationId.fromNumber(organizationId),
      UserId.fromString(userId)
    );

    // 2.5 Check token quota before processing
    console.log('[CHAT-GRPC-API] Checking token quota for organization:', organizationId);
    const tokenUsageRepo = getTokenUsageRepository();
    const orgRepo = getOrganizationRepository();
    const tokenUsageService = new TokenUsageApplicationService(tokenUsageRepo, orgRepo);
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

      // Generate title from first user message (lightweight heuristic)
      const autoTitle = generateChatTitleFromMessage(latestMessage);
      console.log(`[CHAT-GRPC-API] Auto-generated title: "${autoTitle}"`);

      const createChatDTO: CreateChatDTO = {
        organizationId: organizationId,
        createdBy: userId,
        title: autoTitle,
        domainType: domainType as any,
        domainId: domainId ? domainId : undefined
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
        // Debug logging to diagnose model retrieval
        console.log('[CHAT-GRPC-API] DEBUG - Retrieved chat data:', {
          hasChatHistory: !!currentChat,
          hasSession: !!currentChat?.session,
          sessionModel: currentChat?.session?.model,
          directModel: (currentChat as any)?.model
        });
      }
    }

    // Normalize currentChat to extract session for consistent access
    // NEW chats: chatResult.data is ChatSessionDTO (no wrapper)
    // EXISTING chats: chatHistory.data is ChatWithMessagesDTO (has session wrapper)
    const chatSession = (currentChat as any)?.session || currentChat;

    // Upload attachments to S3 if present
    const attachmentMetadata: AnyAttachmentMetadata[] = [];
    if (uploadedFiles.length > 0 && currentChatId) {
      console.log('[CHAT-GRPC-API] Uploading attachments to S3');

      // Check storage quota before uploading chat attachments
      const storageQuotaService = getStorageQuotaApplicationService();
      const totalUploadSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

      const quotaCheckResult = await storageQuotaService.checkQuota({
        organizationId,
        uploadSizeBytes: totalUploadSize,
        category: 'chat'
      });

      if (!quotaCheckResult.success || !quotaCheckResult.data?.allowed) {
        throw new Error(quotaCheckResult.data?.reason || 'Storage quota exceeded. Unable to upload attachments.');
      }

      for (const file of uploadedFiles) {
        try {
          // Determine attachment type from MIME type
          let attachmentType: 'image' | 'audio' | 'document' | 'file' = 'file';
          if (file.type.startsWith('image/')) {
            attachmentType = 'image';
          } else if (file.type.startsWith('audio/')) {
            attachmentType = 'audio';
          } else if (file.type === 'application/pdf' || file.type.includes('document')) {
            attachmentType = 'document';
          }

          const result = await s3ChatAttachmentService.uploadAttachment({
            file,
            organizationId,
            chatId: currentChatId,
            messageId: messageId || `msg_${Date.now()}`,
            type: attachmentType
          });

          attachmentMetadata.push(result.metadata);

          console.log('[CHAT-GRPC-API] Uploaded attachment:', {
            filename: file.name,
            type: attachmentType,
            s3Key: result.s3Key
          });
        } catch (error) {
          console.error('[CHAT-GRPC-API] Failed to upload attachment:', file.name, error);
          // Continue with other files even if one fails
        }
      }

      // Increment storage usage after successful uploads
      if (attachmentMetadata.length > 0) {
        await storageQuotaService.incrementUsage({
          organizationId,
          uploadSizeBytes: totalUploadSize,
          category: 'chat'
        });
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
        role: 'user',
        metadata: attachmentMetadata.length > 0
          ? { attachments: attachmentMetadata }
          : undefined
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
        limit: parseInt(process.env.CHAT_HISTORY_CONTEXT_LIMIT || '20') // Configurable context for resumed chats
      });

      if (historyResult.success && historyResult.data?.messages) {
        // Process messages with URL regeneration for attachments
        conversationHistory = await Promise.all(
          historyResult.data.messages.map(async (msg) => {
            // Convert message with attachments to protobuf MessagePart format
            const attachments = msg.metadata?.attachments || [];

            // Regenerate presigned URLs for attachments (they expire after 1 hour)
            const refreshedAttachments = await Promise.all(
              attachments.map(async (att: any) => {
                if (att.s3Key) {
                  try {
                    // Generate fresh presigned URL from S3 key
                    const freshUrl = await s3ChatAttachmentService.generateAttachmentUrl(att.s3Key);
                    return { ...att, url: freshUrl };
                  } catch (error) {
                    console.warn(`[CHAT-GRPC-API] Failed to refresh URL for ${att.s3Key}:`, error);
                    return att; // Fall back to stored URL
                  }
                }
                return att;
              })
            );

            const contentParts = messageWithAttachmentsToProtoParts(
              msg.content,
              refreshedAttachments.map((att: any) => ({
                type: att.type,
                url: att.url,
                mimeType: att.mimeType
              }))
            );

            return {
              role: msg.role,
              contentParts: contentParts,
              timestamp: new Date(msg.createdAt).getTime()
            };
          })
        );
        console.log(`[CHAT-GRPC-API] Retrieved ${conversationHistory.length} historical messages (URLs refreshed)`);
      }
    }

    // 5. Domain context removed from execution
    // agentId is now resolved from skill.agent_id in Python backend
    // domainType/domainId kept only for chat session metadata (UI filtering)

    // 5.5 Get AI model: request model takes priority over chat/organization defaults
    console.log('[CHAT-GRPC-API] Fetching AI model configuration');
    const orgRepository = getOrganizationRepository();
    const organization = await orgRepository.findById(OrganizationId.fromNumber(organizationId));
    const organizationModel = organization?.defaultModel || null;

    // Model hierarchy: request.model → chat.model → organization.defaultModel → System Default
    // requestModel: sent from frontend (for new chats with pre-selected model)
    // chatSession.model: saved in database (for existing chats)
    const chatModel = chatSession?.model || null;
    const defaultModel = requestModel || chatModel || organizationModel;
    console.log('[CHAT-GRPC-API] Model configuration:', {
      requestModel: requestModel || 'not set',
      chatModel: chatModel || 'not set',
      organizationModel: organizationModel || 'not set',
      resolved: defaultModel || 'will use system default'
    });

    // AIDEV-NOTE: Skills removed from gRPC - Python discovers and executes skills dynamically via API
    // The skill_crud tool allows LLM to list and execute skills at runtime
    const regularTools = tools;

    console.log('[CHAT-GRPC-API] Tools:', {
      totalTools: tools.length,
      toolNames: tools.map((t: any) => t.name)
    });

    // 5.1 Always fetch user API key for managed agents (skill_builder, etc.)
    // This is needed even when there are no tools configured
    // Always generates a fresh key (hash stored, plaintext returned for injection)
    let userApiKey: string | null = null;
    if (userId) {
      try {
        userApiKey = await ensureFreshUserApiKey(userId);
      } catch (error) {
        console.error('[CHAT-GRPC-API] Error generating user API key:', error);
        // Don't silently continue - fail early with clear error
        return new Response(
          JSON.stringify({ error: 'Failed to generate API credentials for chat session' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5.2 Enrich regular tools with user API key for chat-based tool execution
    let enrichedRegularTools: any[] = regularTools;
    if (regularTools.length > 0 && userApiKey) {
      try {
        console.log('[CHAT-GRPC-API] Starting tool enrichment with user API key');

        // Convert plain tools to ToolConfig Value Objects (only regular tools, NOT skill references)
        const toolConfigs = regularTools.map((tool: any) => ToolConfig.fromPlain(tool));

        // Use application service to enrich tools with user API key
        const toolConfigService = getToolConfigurationApplicationService();
        const enrichCommand: EnrichToolsWithUserApiKeyCommand = {
          tools: toolConfigs,
          userApiKey: userApiKey
        };

        const enrichResult = await toolConfigService.enrichToolsWithUserApiKey(enrichCommand);

        if (enrichResult.success && enrichResult.data) {
          // Convert back to plain objects for gRPC transmission
          enrichedRegularTools = enrichResult.data.enrichedTools.map((tc: ToolConfig) => tc.toPlain());

          console.log('[CHAT-GRPC-API] Tool enrichment result:', {
            toolCount: enrichedRegularTools.length,
            userApiKeyProvided: enrichResult.data.userApiKeyProvided,
            toolNames: enrichedRegularTools.map(t => t.name)
          });

          // Debug: Log first tool's config to verify api_key is present
          if (enrichedRegularTools.length > 0) {
            console.log('[CHAT-GRPC-API] First enriched tool config sample:', {
              name: enrichedRegularTools[0].name,
              hasApiKey: !!enrichedRegularTools[0].config?.api_key,
              apiKeyPresent: enrichedRegularTools[0].config?.api_key ? 'YES' : 'NO',
              configKeys: Object.keys(enrichedRegularTools[0].config || {})
            });
          }
        } else {
          console.error('[CHAT-GRPC-API] Failed to enrich tools with user API key:', enrichResult.error);
          // Continue with original tools if enrichment fails
        }
      } catch (error) {
        console.error('[CHAT-GRPC-API] Error during tool enrichment:', error);
        // Continue with original tools if enrichment fails
      }
    }

    // AIDEV-NOTE: Skills removed - Python discovers and executes skills dynamically via API
    // Task creation for skill execution now happens in Python when skills are invoked

    const processingOptions: ChatProcessingOptions = {
      tools: enrichedRegularTools, // DDD-enriched tools with user API key authentication
      defaultModel: defaultModel, // Organization's default AI model
      userApiKey: userApiKey || undefined, // User API key for managed agents and skill_crud
      userName: session.user.name || session.user.email || '', // User display name for audit trail
    };

    console.log('[CHAT-GRPC-API] Processing options:', {
      toolCount: enrichedRegularTools.length,
      defaultModel: defaultModel || 'system default'
    });

    // 6. Set up streaming response
    let fullAssistantResponse = '';
    let collectedSteps: ExecutionStep[] = [];
    let messagePlan: any = null; // Plan from completion metadata (for persistence)
    let messageAwaitingInput: any = null; // HITL awaiting input state (for UI)
    let assistantMessageId: string | null = null; // Track message ID for incremental updates
    let messageFinalized = false; // Guard against double-finalization between error handlers and flush()

    // Create debounced updater for incremental saves (2.5 second delay)
    const debouncedUpdater = createDebouncedUpdater(2500);

    const responseStream = new TransformStream({
      start() {
        console.log('[CHAT-GRPC-API] Starting response stream transform');
      },

      transform(chunk: Uint8Array, controller) {
        // Pass through chunks directly to frontend
        controller.enqueue(chunk);
      },

      async flush() {
        // Skip if message was already finalized by error/catch handlers
        if (messageFinalized) {
          console.log('[CHAT-GRPC-API] Message already finalized, skipping flush');
          return;
        }
        console.log('[CHAT-GRPC-API] Response stream complete, finalizing assistant message');

        // Flush any pending incremental update first
        await debouncedUpdater.flush();

        // Update the placeholder message with final content and complete status
        if (assistantMessageId && currentChatId) {
          try {
            // Build metadata with optional plan and awaitingInput
            const messageMetadata: any = {
              processingTime: Date.now() - startTime,
              modelUsed: 'qwen-coder', // This will come from gRPC response
              executionSteps: collectedSteps, // Persist execution steps
              streamingStatus: 'complete' // Mark as complete
            };

            // Add plan if present (from completion metadata)
            if (messagePlan) {
              messageMetadata.plan = messagePlan;
              console.log(`[CHAT-GRPC-API] Including plan in message metadata: ${messagePlan.id}`);
            }

            // Add awaitingInput if present (for HITL resumption)
            if (messageAwaitingInput) {
              messageMetadata.awaitingInput = messageAwaitingInput;
              console.log(`[CHAT-GRPC-API] Including awaitingInput in message metadata: ${messageAwaitingInput.type}`);
            }

            const updateDTO: UpdateMessageDTO = {
              messageId: assistantMessageId,
              chatId: currentChatId,
              organizationId: organizationId,
              content: fullAssistantResponse.trim() || '[Empty response]',
              metadata: messageMetadata
            };

            await chatApplicationService.updateMessage(updateDTO);
            console.log(`[CHAT-GRPC-API] Finalized assistant message ${assistantMessageId} with ${collectedSteps.length} execution steps`);
          } catch (error) {
            console.error('[CHAT-GRPC-API] Failed to finalize assistant message:', error);
          }
        } else if (currentChatId && fullAssistantResponse.trim() && !assistantMessageId) {
          // Fallback: Create new message if placeholder wasn't created (shouldn't happen normally)
          console.warn('[CHAT-GRPC-API] No placeholder message ID, creating new message as fallback');
          try {
            const messageMetadata: any = {
              processingTime: Date.now() - startTime,
              modelUsed: 'qwen-coder',
              executionSteps: collectedSteps,
              streamingStatus: 'complete'
            };

            if (messagePlan) messageMetadata.plan = messagePlan;
            if (messageAwaitingInput) messageMetadata.awaitingInput = messageAwaitingInput;

            const assistantMessageDTO: SendMessageDTO = {
              chatId: currentChatId,
              userId: userId,
              organizationId: organizationId,
              content: fullAssistantResponse.trim(),
              role: 'assistant',
              metadata: messageMetadata
            };

            await chatApplicationService.sendMessage(assistantMessageDTO);
            console.log(`[CHAT-GRPC-API] Saved assistant response (fallback) to chat ${currentChatId}`);
          } catch (error) {
            console.error('[CHAT-GRPC-API] Fallback save failed:', error);
          }
        }
      }
    });

    // 7. Prepare current user message with attachments as MessagePart[]
    // AIDEV-NOTE: Frontend sends blob URLs for UI preview which cannot be downloaded server-side.
    // We filter out blob URLs and use only S3 URLs from uploaded attachments.
    const frontendParts: MessagePart[] = messages[messages.length - 1].parts || [];

    // Filter out blob URLs from frontend parts (blob: URLs are browser-local and can't be downloaded)
    // Keep only text parts from frontend, images/files will come from S3 uploads
    const filteredParts: MessagePart[] = frontendParts.filter((part: any) => {
      if (part.type === 'text') return true;
      if (part.type === 'data-file' || part.type === 'image') {
        const url = part.data?.url || part.image || '';
        if (url.startsWith('blob:')) {
          console.log('[CHAT-GRPC-API] Filtering out blob URL:', url.substring(0, 50) + '...');
          return false;
        }
        return true;
      }
      return true;
    });

    // Start with filtered frontend parts, or create text-only if no parts
    const currentMessageParts: MessagePart[] = filteredParts.length > 0
      ? filteredParts
      : [{ type: 'text' as const, text: latestMessage }];

    // Add uploaded attachment URLs to message parts (these have real S3 URLs)
    // AIDEV-NOTE: Supports all attachment types (images, PDFs, audio, documents)
    // Python file_processor.py handles PDF text extraction and audio transcription
    if (attachmentMetadata.length > 0) {
      console.log('[CHAT-GRPC-API] Adding S3 attachment URLs to current message parts');
      for (const attachment of attachmentMetadata) {
        if (attachment.url) {
          currentMessageParts.push({
            type: 'data-file' as const,
            data: {
              url: attachment.url,
              mediaType: attachment.mimeType,
              filename: attachment.filename,
              size: attachment.sizeBytes
            }
          } as MessagePart);

          console.log(`[CHAT-GRPC-API] Added attachment: ${attachment.filename} (${attachment.type}, ${attachment.sizeBytes} bytes)`);
        }
      }
    }

    console.log('[CHAT-GRPC-API] Current message has', currentMessageParts.length, 'parts');

    // 8. Call gRPC service for AI processing
    console.log('[CHAT-GRPC-API] Calling gRPC ChatProcessingService for AI processing');
    const startTime = Date.now();

    // Create readable stream for frontend
    const readableStream = new ReadableStream({
      async start(controller) {
        // AIDEV-NOTE: Send chat_created event immediately to notify frontend of chatId
        // This ensures frontend tracks the same chat session from the first message
        if (currentChatId) {
          console.log(`[CHAT-GRPC-API] Sending chat_created event with chatId: ${currentChatId}`);
          const chatCreatedEvent = {
            type: 'chat_created',
            chatId: currentChatId
          };
          controller.enqueue(encodeSSEEvent(chatCreatedEvent));

          // AIDEV-NOTE: Create placeholder assistant message at stream START (optimistic save)
          // This ensures message exists in DB even if user reloads mid-stream
          try {
            const placeholderDTO: SendMessageDTO = {
              chatId: currentChatId,
              userId: userId,
              organizationId: organizationId,
              content: '...', // Placeholder content - will be replaced with actual response
              role: 'assistant',
              metadata: {
                streamingStatus: 'streaming',
                processingTime: 0,
                modelUsed: 'unknown' // Will be updated on completion
              }
            };

            const placeholderResult = await chatApplicationService.sendMessage(placeholderDTO);
            if (placeholderResult.success && placeholderResult.data) {
              assistantMessageId = placeholderResult.data.id;
              console.log(`[CHAT-GRPC-API] Created placeholder assistant message: ${assistantMessageId}`);
            } else {
              console.warn('[CHAT-GRPC-API] Failed to create placeholder message:', placeholderResult.error);
            }
          } catch (error) {
            console.error('[CHAT-GRPC-API] Error creating placeholder message:', error);
          }
        }

        const grpcClient = getChatProcessingClient(organizationId.toString());

        // AIDEV-NOTE: Task creation removed from per-message flow
        // Tasks are now created per agent invocation/skill execution, not per chat message
        // This prevents database bloat and aligns with the domain model where:
        // - 1 task = 1 agent invocation (which may run multiple skills)
        // - 1 task = 1 direct skill execution
        // Task creation happens in Python when skills are executed

        // Pass assistantMessageId to Python so tasks can link to ChatMessage for ExecutionSteps
        if (assistantMessageId) {
          processingOptions.assistantMessageId = assistantMessageId;
        }

        // Process message with gRPC service (now accepts MessagePart[])
        grpcClient.processMessage(
          currentMessageParts,
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
              if (response.type === 'step_progress' && response.stepProgress) {
                // Real-time step execution progress
                const step = response.stepProgress;

                // Convert metadata to plain object if it's a Map
                const plainMetadata = step.metadata ? { ...step.metadata } : {};

                // Process step progress and update collection
                const { event: stepEvent, updatedSteps } = processStepProgress(
                  step.stepType,
                  step.stepName,
                  step.stepIndex,
                  step.content,
                  plainMetadata,
                  collectedSteps
                );
                collectedSteps = updatedSteps;

                console.log(`[CHAT-GRPC-API] Step progress [${step.stepIndex}]:`, {
                  type: stepEvent.stepType,
                  name: stepEvent.stepName,
                  contentLength: stepEvent.content?.length || 0
                });

                // Send step progress event to frontend
                try {
                  controller.enqueue(encodeSSEEvent(stepEvent));
                } catch (jsonError) {
                  console.error('[CHAT-GRPC-API] Failed to serialize step event:', jsonError);
                  console.error('[CHAT-GRPC-API] Problematic metadata:', step.metadata);
                }

                // Schedule debounced incremental save for steps too
                // This ensures steps are saved even during long thinking phases
                if (assistantMessageId && currentChatId) {
                  debouncedUpdater.schedule(async () => {
                    const updateDTO: UpdateMessageDTO = {
                      messageId: assistantMessageId!,
                      chatId: currentChatId!,
                      organizationId: organizationId,
                      content: fullAssistantResponse,
                      metadata: {
                        streamingStatus: 'streaming',
                        executionSteps: collectedSteps
                      }
                    };
                    await chatApplicationService.updateMessage(updateDTO);
                    console.log(`[CHAT-GRPC-API] Incremental save (steps): ${collectedSteps.length} steps`);
                  });
                }

              } else if (response.type === 'content' && response.content) {
                // Process content chunk and update response
                const { event: contentEvent, updatedResponse } = processContentChunk(
                  response.content,
                  fullAssistantResponse
                );
                fullAssistantResponse = updatedResponse;

                // Send content event to frontend
                controller.enqueue(encodeSSEEvent(contentEvent));

                // Schedule debounced incremental save (every ~2.5 seconds)
                if (assistantMessageId && currentChatId) {
                  debouncedUpdater.schedule(async () => {
                    const updateDTO: UpdateMessageDTO = {
                      messageId: assistantMessageId!,
                      chatId: currentChatId!,
                      organizationId: organizationId,
                      content: fullAssistantResponse,
                      metadata: {
                        streamingStatus: 'streaming',
                        executionSteps: collectedSteps
                      }
                    };
                    await chatApplicationService.updateMessage(updateDTO);
                    console.log(`[CHAT-GRPC-API] Incremental save: ${fullAssistantResponse.length} chars`);
                  });
                }

              } else if (response.type === 'complete' && response.complete) {
                // AI processing completed
                console.log(`[CHAT-GRPC-API] AI processing completed:`, {
                  model: response.complete.modelUsed,
                  tokens: response.complete.totalTokens,
                  processingTime: response.complete.processingTimeMs,
                  tokenUsage: response.complete.tokenUsage,
                  hasPlan: !!response.complete.metadata?.plan
                });

                // Extract plan from completion metadata (for persistence)
                // AIDEV-NOTE: Plan sent as JSON string in metadata.plan field
                if (response.complete.metadata?.plan) {
                  try {
                    messagePlan = JSON.parse(response.complete.metadata.plan);
                    console.log(`[CHAT-GRPC-API] Extracted plan from completion: ${messagePlan.id}`);
                  } catch (parseError) {
                    console.error('[CHAT-GRPC-API] Failed to parse plan JSON:', parseError);
                  }
                }

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

                // Log chat execution audit event
                const completionMeta = response.complete.metadata || {};
                const agentIdFromExecution = completionMeta.agent_id && completionMeta.agent_id !== 'none' ? completionMeta.agent_id : null;
                const agentNameFromExecution = completionMeta.agent_name || null;

                const auditService = getAuditApplicationService();
                auditService.logEvent(OrganizationId.fromNumber(organizationId), {
                  eventType: 'agent',
                  eventCategory: 'chat_execution',
                  eventAction: 'complete',
                  actorType: agentIdFromExecution ? 'agent' : 'user',
                  actorId: agentIdFromExecution || userId,
                  actorName: agentIdFromExecution
                    ? (agentNameFromExecution || undefined)
                    : (session!.user.name || session!.user.email || undefined),
                  resourceType: 'chat',
                  resourceId: currentChatId || 'unknown',
                  eventData: {
                    messageId,
                    model: defaultModel,
                    ...(response.complete.tokenUsage && {
                      inputTokens: response.complete.tokenUsage.inputTokens,
                      outputTokens: response.complete.tokenUsage.outputTokens,
                    }),
                  },
                  metadata: agentIdFromExecution ? {
                    triggeredByUserId: userId,
                    triggeredByUserName: session!.user.name || session!.user.email || undefined,
                    triggerType: 'manual' as const,
                    agentId: agentIdFromExecution,
                    agentName: agentNameFromExecution || undefined,
                  } : undefined,
                  durationMs: Date.now() - startTime,
                  success: true,
                });

                // Send completion event with execution steps metadata to frontend
                const completionEvent = processCompletion(
                  response.complete.modelUsed,
                  response.complete.totalTokens,
                  collectedSteps,
                  response.complete.tokenUsage ? {
                    inputTokens: response.complete.tokenUsage.inputTokens,
                    outputTokens: response.complete.tokenUsage.outputTokens,
                    totalTokens: response.complete.tokenUsage.totalTokens,
                    modelName: response.complete.tokenUsage.modelName,
                    costUsd: response.complete.tokenUsage.costUsd
                  } : undefined
                );

                try {
                  controller.enqueue(encodeSSEEvent(completionEvent));
                  console.log(`[CHAT-GRPC-API] Sent completion event with ${collectedSteps.length} execution steps`);
                } catch (jsonError) {
                  console.error('[CHAT-GRPC-API] Failed to send completion event:', jsonError);
                }

                controller.close();
                
              } else if (response.type === 'awaiting_input' && response.awaitingInput) {
                // HITL: Agent needs user input (plan approval, question, or permission)
                console.log(`[CHAT-GRPC-API] Agent awaiting input:`, {
                  inputType: response.awaitingInput.inputType,
                  title: response.awaitingInput.title,
                  optionsCount: response.awaitingInput.options?.length || 0
                });

                // Special handling for permission_request - emit dedicated event type
                // AIDEV-NOTE: Permission requests are sent as awaiting_input from Python
                // but converted to permission_request SSE events for the frontend
                if (response.awaitingInput.inputType === 'permission_request') {
                  try {
                    const permissionData = JSON.parse(response.awaitingInput.planJson || '{}');
                    const permissionEvent = {
                      type: 'permission_request',
                      permission: permissionData.permission || 'unknown',
                      resource: permissionData.resource || undefined,
                      resourceId: permissionData.resourceId || undefined,
                      action: permissionData.action || 'access',
                      context: permissionData.context || response.awaitingInput.content,
                    };
                    controller.enqueue(encodeSSEEvent(permissionEvent));
                    console.log(`[CHAT-GRPC-API] Sent permission_request event (permission=${permissionData.permission})`);
                  } catch (parseError) {
                    console.error('[CHAT-GRPC-API] Failed to parse permission data:', parseError);
                    // Fallback to generic awaiting_input
                    const fallbackEvent = {
                      type: 'awaiting_input',
                      inputType: response.awaitingInput.inputType,
                      title: response.awaitingInput.title,
                      content: response.awaitingInput.content,
                      options: response.awaitingInput.options || [],
                      planJson: response.awaitingInput.planJson || null
                    };
                    controller.enqueue(encodeSSEEvent(fallbackEvent));
                  }
                  return; // Don't fall through to generic awaiting_input handling
                }

                // Store awaiting input state for message persistence
                // AIDEV-NOTE: This allows UI to show approval/question UI on page reload
                messageAwaitingInput = {
                  type: response.awaitingInput.inputType,
                  title: response.awaitingInput.title,
                  content: response.awaitingInput.content,
                  options: response.awaitingInput.options || []
                };

                // If plan_approval, parse and store the plan too
                if (response.awaitingInput.inputType === 'plan_approval' && response.awaitingInput.planJson) {
                  try {
                    messagePlan = JSON.parse(response.awaitingInput.planJson);
                    console.log(`[CHAT-GRPC-API] Extracted plan from awaiting_input: ${messagePlan.id}`);
                  } catch (parseError) {
                    console.error('[CHAT-GRPC-API] Failed to parse plan JSON from awaiting_input:', parseError);
                  }
                }

                // Send awaiting_input event to frontend
                // Normalize inputType to just 'plan_approval' or 'questions'
                const isPlanApproval = response.awaitingInput.inputType === 'plan_approval';
                const normalizedInputType = isPlanApproval ? 'plan_approval' : 'questions';

                // For questions type, parse JSON content and convert to questionSections
                let questionSections: Array<{agentName: string; stepId: string; questions: any[]}> | undefined;
                let displayContent = response.awaitingInput.content;

                if (!isPlanApproval && response.awaitingInput.content) {
                  try {
                    // Content contains JSON array of questions
                    const questions = JSON.parse(response.awaitingInput.content);
                    if (Array.isArray(questions) && questions.length > 0) {
                      questionSections = [{
                        agentName: 'assistant',
                        stepId: 'clarification',
                        questions: questions
                      }];
                      // Format questions as markdown for chat history display
                      displayContent = formatQuestionsForChat(questionSections);
                    }
                  } catch {
                    // Not JSON, keep as-is (legacy format)
                  }
                }

                // For plan_approval, generate markdown content from planJson if available
                const planDisplayContent = isPlanApproval && response.awaitingInput.planJson
                  ? formatPlanToMarkdown(response.awaitingInput.planJson)
                  : '';

                const awaitingInputEvent = {
                  type: 'awaiting_input',
                  inputType: normalizedInputType,
                  title: response.awaitingInput.title,
                  content: isPlanApproval ? planDisplayContent : displayContent,
                  options: response.awaitingInput.options || [],
                  planJson: response.awaitingInput.planJson || null,
                  questionSections: questionSections
                };

                controller.enqueue(encodeSSEEvent(awaitingInputEvent));
                console.log(`[CHAT-GRPC-API] Sent awaiting_input event (type=${normalizedInputType}, questions=${questionSections?.length || 0})`);

              } else if (response.type === 'error' && response.error) {
                // AI processing error with user-friendly message
                // Log technical details to console ONLY (never show to user)
                console.error('[CHAT-GRPC-API] AI processing error:', {
                  code: response.error.errorCode,
                  severity: response.error.errorDetails?.severity,
                  sessionReset: response.error.sessionReset,
                  timestamp: new Date().toISOString()
                });

                // Record partial token usage if available (even on error)
                if (response.error.tokenUsage) {
                  const tokenUsage = response.error.tokenUsage;
                  console.log('[CHAT-GRPC-API] Recording partial token usage from error:', tokenUsage);
                  tokenUsageService.recordTokenUsage({
                    organizationId: organizationId,
                    userId: userId,
                    entityType: 'chat' as const,
                    entityId: currentChatId,
                    modelName: tokenUsage.modelName,
                    inputTokens: tokenUsage.inputTokens,
                    outputTokens: tokenUsage.outputTokens,
                    processingTimeMs: Date.now() - startTime,
                    metadata: {
                      chatContext: 'streaming_error'
                    }
                  }).catch((error) => {
                    console.error('[CHAT-GRPC-API] Failed to record partial token usage:', error);
                  });
                }

                // Update message with error status if we have a placeholder
                if (assistantMessageId && currentChatId) {
                  // Set flag immediately to prevent flush() from overwriting
                  messageFinalized = true;
                  const errorUpdateDTO: UpdateMessageDTO = {
                    messageId: assistantMessageId,
                    chatId: currentChatId,
                    organizationId: organizationId,
                    content: fullAssistantResponse || '[Error occurred during generation]',
                    metadata: {
                      streamingStatus: 'error',
                      error: response.error.errorMessage,
                      executionSteps: collectedSteps
                    }
                  };
                  chatApplicationService.updateMessage(errorUpdateDTO)
                    .then(() => console.log(`[CHAT-GRPC-API] Updated message with error status: ${assistantMessageId}`))
                    .catch((updateError) => console.error('[CHAT-GRPC-API] Failed to update message with error status:', updateError));
                }

                // Send error as SSE event with user-friendly message + hint
                const errorEvent = {
                  type: 'error',
                  errorCode: response.error.errorCode,
                  message: response.error.errorMessage,
                  hint: response.error.hint || null,
                  canRetry: response.error.canRetry,
                  sessionReset: response.error.sessionReset
                };

                controller.enqueue(encodeSSEEvent(errorEvent));
                console.log(`[CHAT-GRPC-API] Sent error event (code=${response.error.errorCode})`);
              }
              
            } catch (streamError) {
              console.error('[CHAT-GRPC-API] Stream processing error:', streamError);
              controller.error(streamError);
            }
          },
          messageId, // Pass messageId for cancellation tracking
          currentChatId // Pass chatId as sessionId for stateful agent persistence
        ).then(() => {
          console.log('[CHAT-GRPC-API] gRPC processing completed successfully');
        }).catch(async (error) => {
          console.error('[CHAT-GRPC-API] gRPC processing failed:', error);

          // Finalize message in DB before closing stream (don't rely on flush)
          if (assistantMessageId && currentChatId) {
            try {
              await chatApplicationService.updateMessage({
                messageId: assistantMessageId,
                chatId: currentChatId,
                organizationId: organizationId,
                content: fullAssistantResponse || '[Error occurred during generation]',
                metadata: {
                  streamingStatus: 'error',
                  error: error.message || 'AI service unavailable',
                  executionSteps: collectedSteps
                }
              });
              messageFinalized = true;
              console.log(`[CHAT-GRPC-API] Finalized message on gRPC error: ${assistantMessageId}`);
            } catch (dbError) {
              console.error('[CHAT-GRPC-API] Failed to finalize message on gRPC error:', dbError);
            }
          }

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