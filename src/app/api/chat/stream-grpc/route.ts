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

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

// Import Value Objects for proper type safety
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// Import existing chat services (DIContainer now auto-initializes)
import { getChatApplicationService, getDynamicTableRepository, getAgentRepository, getToolConfigurationApplicationService, getUserRepository, getOrganizationRepository, getSkillApplicationService, getStorageQuotaApplicationService } from '@/ddd/application/di/container';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { getTokenUsageRepository } from '@/ddd/application/di/getters';
import type { CreateChatDTO, SendMessageDTO, ExecutionStep, ExecutionStepMetadata } from '@/app/dtos/chat.dto';
import type { EnrichToolsWithUserApiKeyCommand } from '@/ddd/application/services/tools/tool-configuration-application-service';

// Import user API key utilities
import { assignApiKeyToUser } from '@/lib/auth/user-api-keys';

// Import shared chat utilities
import { getMessageContent } from '@/lib/chat/message-helpers';
import { processStepProgress, processContentChunk, processCompletion, encodeSSEEvent } from '@/lib/chat/event-processors';

// Import gRPC client
import { getChatProcessingClient, type StreamingChatResponse, type ChatProcessingOptions } from '@/lib/grpc/chat-processing-client';
import type { HistoryMessage } from '@/lib/grpc/generated/agent_worker';
import type { MessagePart } from '@llamaindex/chat-ui';
import { s3ChatAttachmentService } from '@/ddd/infrastructure/multimodal/s3-chat-attachment-service';
import type { AnyAttachmentMetadata } from '@/ddd/domain/multimodal/value-objects/attachment-metadata';
import { messageWithAttachmentsToProtoParts } from '@/lib/grpc/mappers/message-part-mapper';

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

    // 2. Parse request (handle both JSON and FormData with file uploads)
    const contentType = req.headers.get('content-type') || '';
    let messages: any[];
    let chatId: string | undefined;
    let messageId: string;
    let domainType: string | undefined;
    let domainId: number | undefined;
    let tools: any[] = [];
    let uploadedFiles: File[] = [];

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
      tools = body.tools || [];

      console.log('[CHAT-GRPC-API] [DEBUG] Received tools from frontend:', JSON.stringify(tools, null, 2));
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
      const createChatDTO: CreateChatDTO = {
        organizationId: organizationId,
        createdBy: userId,
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
      }
    }

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
        limit: 10 // Last 10 messages for context
      });

      if (historyResult.success && historyResult.data?.messages) {
        conversationHistory = historyResult.data.messages.map(msg => {
          // Convert message with attachments to protobuf MessagePart format
          const attachments = msg.metadata?.attachments || [];
          const contentParts = messageWithAttachmentsToProtoParts(
            msg.content,
            attachments.map((att: any) => ({
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
        });
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

    // 5.1 Separate skill references from regular tools BEFORE enrichment
    // This prevents skill_reference type from being overwritten during enrichment
    const skillReferenceTools = tools.filter((t: any) => t.config?.type === 'skill_reference');
    const regularTools = tools.filter((t: any) => t.config?.type !== 'skill_reference');

    console.log('[CHAT-GRPC-API] Separated tools:', {
      totalTools: tools.length,
      skillReferences: skillReferenceTools.length,
      regularTools: regularTools.length
    });

    console.log('[CHAT-GRPC-API] [DEBUG] Skill reference tools:', JSON.stringify(skillReferenceTools, null, 2));
    console.log('[CHAT-GRPC-API] [DEBUG] Regular tools:', JSON.stringify(regularTools.map(t => ({ name: t.name, configType: t.config?.type })), null, 2));

    // 5.1 Enrich regular tools with user API key for chat-based tool execution
    let enrichedRegularTools: any[] = regularTools;
    if (regularTools.length > 0 && userId) {
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
        } else {
          console.warn('[CHAT-GRPC-API] Could not obtain user API key for tool enrichment');
        }
      } catch (error) {
        console.error('[CHAT-GRPC-API] Error during tool enrichment:', error);
        // Continue with original tools if enrichment fails
      }
    }

    // Combine enriched regular tools with unchanged skill references
    const enrichedTools = [...enrichedRegularTools, ...skillReferenceTools];

    // 5.2 Enrich skill references with full skill definitions
    let enrichedSkills: any[] = [];
    // Use the already-separated skillReferenceTools (preserves type: 'skill_reference')
    const skillTools = skillReferenceTools;

    if (skillTools.length > 0) {
      try {
        console.log('[CHAT-GRPC-API] Loading skills by ID:', skillTools.map(s => s.config.skill_id));

        const skillService = getSkillApplicationService();

        for (const skillTool of skillTools) {
          // Extract skill ID from config - MUST be provided by frontend
          const skillId = parseInt(skillTool.config.skill_id, 10);

          // Direct ID lookup - fast, no ambiguity
          const skillResult = await skillService.getSkill(skillId);

          if (skillResult.success && skillResult.data) {
            const skill = skillResult.data;

            // Convert skill to enriched format with full data
            enrichedSkills.push({
              id: skill.id,
              name: skill.name,
              description: skill.description,
              instructions: skill.instructions,
              inputs: skill.inputs,
              outputs: skill.outputs,
              tools: skill.tools,
              content: skill.content || [], // Message parts (attachments)
              model: skill.model || null // Model override for this skill
            });

            console.log('[CHAT-GRPC-API] Loaded skill by ID:', {
              skillId: skillId,
              name: skill.name,
              hasInstructions: !!skill.instructions,
              toolCount: skill.tools?.length || 0,
              contentCount: skill.content?.length || 0
            });
          } else {
            console.warn('[CHAT-GRPC-API] Skill not found for ID:', skillId);
          }
        }

        console.log('[CHAT-GRPC-API] Enriched skills:', enrichedSkills.length);
      } catch (error) {
        console.error('[CHAT-GRPC-API] Error loading skills:', error);
        // Continue without skills if enrichment fails
      }
    }

    // Filter out skills from tools array (they go in separate skills array)
    const nonSkillTools = enrichedTools.filter((t: any) => t.config?.type !== 'skill_reference');

    const processingOptions: ChatProcessingOptions = {
      domainType: resolvedDomainType,
      domainId: resolvedDomainId,
      tools: nonSkillTools, // DDD-enriched tools with user API key authentication (excluding skills)
      skills: enrichedSkills, // Fully resolved skill definitions
      defaultModel: defaultModel // Organization's default AI model
    };

    console.log('[CHAT-GRPC-API] [DEBUG] Processing options - nonSkillTools:', JSON.stringify(nonSkillTools.map(t => ({ name: t.name, configType: t.config?.type, configKeys: Object.keys(t.config || {}) })), null, 2));
    console.log('[CHAT-GRPC-API] [DEBUG] Processing options - enrichedSkills:', JSON.stringify(enrichedSkills.map(s => ({ id: s.id, name: s.name })), null, 2));

    // 6. Set up streaming response
    let fullAssistantResponse = '';
    let ragSources: any[] = [];
    let collectedSteps: ExecutionStep[] = [];

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
                  modelUsed: 'qwen-coder', // This will come from gRPC response
                  executionSteps: collectedSteps // Persist execution steps
                }
              };

              await chatApplicationService.sendMessage(assistantMessageDTO);
              console.log(`[CHAT-GRPC-API] Saved assistant response to chat ${currentChatId} with ${collectedSteps.length} execution steps`);
            } catch (error) {
              console.error('[CHAT-GRPC-API] Failed to save assistant response:', error);
            }
          };

          saveAssistantMessage();
        }
      }
    });

    // 7. Prepare current user message with attachments as MessagePart[]
    const currentMessageParts: MessagePart[] = messages[messages.length - 1].parts || [
      { type: 'text' as const, text: latestMessage }
    ];

    // Add uploaded attachment URLs to message parts
    // AIDEV-NOTE: Supports all attachment types (images, PDFs, audio, documents)
    // Python file_processor.py handles PDF text extraction and audio transcription
    if (attachmentMetadata.length > 0) {
      console.log('[CHAT-GRPC-API] Adding attachment URLs to current message parts');
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
      start(controller) {
        // AIDEV-NOTE: Send chat_created event immediately to notify frontend of chatId
        // This ensures frontend tracks the same chat session from the first message
        if (currentChatId) {
          console.log(`[CHAT-GRPC-API] Sending chat_created event with chatId: ${currentChatId}`);
          const chatCreatedEvent = {
            type: 'chat_created',
            chatId: currentChatId
          };
          controller.enqueue(encodeSSEEvent(chatCreatedEvent));
        }

        const grpcClient = getChatProcessingClient(organizationId.toString());

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

              } else if (response.type === 'content' && response.content) {
                // Process content chunk and update response
                const { event: contentEvent, updatedResponse } = processContentChunk(
                  response.content,
                  fullAssistantResponse
                );
                fullAssistantResponse = updatedResponse;

                // Send content event to frontend
                controller.enqueue(encodeSSEEvent(contentEvent));

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

                // Send completion event with execution steps metadata to frontend
                const completionEvent = processCompletion(
                  response.complete.modelUsed,
                  response.complete.totalTokens,
                  collectedSteps,
                  ragSources
                );

                try {
                  controller.enqueue(encodeSSEEvent(completionEvent));
                  console.log(`[CHAT-GRPC-API] Sent completion event with ${collectedSteps.length} execution steps`);
                } catch (jsonError) {
                  console.error('[CHAT-GRPC-API] Failed to send completion event:', jsonError);
                }

                controller.close();
                
              } else if (response.type === 'error' && response.error) {
                // AI processing error with user-friendly message
                // Log technical details to console ONLY (never show to user)
                console.error('[CHAT-GRPC-API] AI processing error:', {
                  code: response.error.errorCode,
                  severity: response.error.errorDetails?.severity,
                  sessionReset: response.error.sessionReset,
                  timestamp: new Date().toISOString()
                });

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