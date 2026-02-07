'use client'

import { generateId } from 'ai'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { ChatHandler, Message, type MessagePart } from '@llamaindex/chat-ui'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store'
import { createChatStreamRequest, type ChatContextOptions } from './types/chat-requests'
import { loadChatWithFullHistory, getCurrentChatSession } from '@/app/actions/chat-history'
import type { ChatMessageDTO, ChatContextDTO } from '@/app/mappers/chat-mapper'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import type { AnyAttachmentMetadata } from '@/ddd/domain/multimodal/value-objects/attachment-metadata'
import type { ExecutionStep } from '@/ddd/domain/chat/value-objects/execution-step'
import type { ExtendedChatHandler, ChatMessage, CurrentStepProgress } from './types/extended-chat-handler'
import { createTextMessage, createMultimodalMessage, getMessageContent } from '@/lib/chat/message-helpers'
import { createExecutionStep, addStepDeduped } from '@/lib/chat/step-collection'
import {
  isStepProgressEvent,
  isContentEvent,
  isMessageCompleteEvent,
  isPlanApprovalRequestEvent,
  isPlanStatusUpdateEvent,
  isAwaitingInputEvent,
  isPermissionRequestEvent,
  type PermissionRequestEvent
} from '@/lib/chat/types/sse-events'
import type { PendingPlanApproval, ActivePlanExecution, PlanExecutionStatus, AwaitingInputState } from './types/extended-chat-handler'

const logger = createDebugLogger('ChatGRPC')

/**
 * Helper to create an image MessagePart from attachment metadata
 */
function createImagePart(attachment: AnyAttachmentMetadata): MessagePart {
  return {
    type: 'data-file',
    data: {
      filename: attachment.filename,
      mediaType: attachment.mimeType,
      url: attachment.url,
    }
  }
}

/**
 * Helper to create an audio MessagePart from attachment metadata
 */
function createAudioPart(attachment: AnyAttachmentMetadata): MessagePart {
  return {
    type: 'data-file',
    data: {
      filename: attachment.filename,
      mediaType: attachment.mimeType,
      url: attachment.url,
    }
  }
}

/**
 * Helper to create a file MessagePart from attachment metadata
 */
function createFilePart(attachment: AnyAttachmentMetadata): MessagePart {
  return {
    type: 'data-file',
    data: {
      filename: attachment.filename,
      mediaType: attachment.mimeType,
      url: attachment.url,
    }
  }
}

/**
 * Extract tool references from message content
 * Finds patterns like @tool:gmail-create-draft and @skill:consultation-extraction
 * and converts them to tool configs
 */
function extractToolReferencesFromMessage(message: string): Array<{name: string, version: string, config: Record<string, unknown>}> {
  const toolReferences: Array<{name: string, version: string, config: Record<string, unknown>}> = []

  // Match @tool:xxx patterns
  const toolMatches = message.match(/@tool:([a-zA-Z0-9_-]+)/g)

  if (toolMatches) {
    for (const match of toolMatches) {
      const toolName = match.replace('@tool:', '')

      // Create basic tool config for the referenced tool
      // The Python side will resolve this to the actual tool implementation
      toolReferences.push({
        name: toolName,
        version: '', // Empty version for now
        config: {
          // Basic config that will be enriched by server with user's API key and runtime settings
          api_key: '', // Will be filled by server-side enrichment
          // AIDEV-NOTE: Don't set base_url here - Python worker reads from NEXTJS_BASE_URL environment
        }
      })
    }
  }

  // AIDEV-NOTE: @skill: mentions are NOT extracted here
  // Skills MUST be selected via UI to get proper skillId
  // If user types @skill: in message, they must select it from autocomplete
  // which adds it to selectedTools with the correct skillId

  return toolReferences
}

/**
 * Generic gRPC-based Chat Handler
 * 
 * Extracted from mission-control and generalized for use across all pages.
 * Supports context-aware chat with domain-specific functionality.
 * 
 * Uses the /api/chat/stream-grpc endpoint which:
 * - Handles database operations (sessions, messages) in Next.js
 * - Calls gRPC service for AI processing (RAG + LLM streaming)
 * - Provides the same interface as the original REST-based hook
 * 
 * AIDEV-NOTE: Generic gRPC-based chat handler that can be used across all pages
 * with domain-specific context and proper TypeScript types.
 */
export function useChatGRPC(
  contextOptions?: ChatContextOptions, 
  onChatCreated?: (chatId: string) => void
): ExtendedChatHandler {
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isClient, setIsClient] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [currentStep, setCurrentStep] = useState<{
    type: string
    name: string
    index: number
    content?: string
  } | null>(null)
  const [streamingSteps, setStreamingSteps] = useState<ExecutionStep[]>([])
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // AIDEV-NOTE: Use fine-grained store subscription instead of useLayout()
  const chatContext = useStore(uiStateStore, uiStateSelectors.chatContext)

  // Tool management state
  const [selectedTools, setSelectedTools] = useState<ToolDTO[]>([])
  const [availableTools, setAvailableTools] = useState<ToolDTO[]>([])

  // Attachment management state
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([])

  // Model selection state - can be set before first message
  const [selectedModel, setSelectedModel] = useState<string | undefined>(contextOptions?.model)

  // Plan approval workflow state
  const [pendingPlanApproval, setPendingPlanApproval] = useState<PendingPlanApproval | null>(null)
  const [activePlanExecution, setActivePlanExecution] = useState<ActivePlanExecution | null>(null)

  // Unified HITL awaiting input state (plan approval or questions)
  const [awaitingInput, setAwaitingInput] = useState<AwaitingInputState | null>(null)

  // Permission request state (when agent encounters RBAC errors)
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequestEvent | null>(null)

  // Generate domain-specific storage key for this chat session
  const chatStorageKey = `emery-chat-${contextOptions?.domainType || chatContext?.domainType || 'general'}-${contextOptions?.domainId || chatContext?.domainId || 'default'}`

  // Check if user is near bottom of scroll container (within 100px)
  const isNearBottom = () => {
    if (!scrollRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const threshold = 100 // px from bottom
    return scrollHeight - scrollTop - clientHeight < threshold
  }

  // Auto-scroll to bottom with smooth animation
  // Only scrolls if user is already near bottom (doesn't interrupt if they scrolled up)
  const scrollToBottom = () => {
    if (scrollRef.current && isNearBottom()) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  // Initialize client-side
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Load chat when chatId changes
  useEffect(() => {
    if (contextOptions?.chatId) {
      loadChatSession(contextOptions.chatId)
    } else {
      // Clear messages if no chatId (new chat)
      setMessages([])
      setCurrentChatId(undefined)
    }
  }, [contextOptions?.chatId])

  // Load a specific chat session with full history
  const loadChatSession = async (chatId: string) => {
    try {
      logger.debug('Loading chat session', { chatId })
      const result = await loadChatWithFullHistory(chatId)

      if (result.success && result.data) {
        setCurrentChatId(chatId)

        // Convert DTOs to ChatMessage format
        // Handle incomplete messages (streamingStatus === 'streaming') from interrupted streams
        const chatMessages: ChatMessage[] = result.data.messages.map(msg => {
          const isIncomplete = msg.metadata?.streamingStatus === 'streaming'

          // For incomplete messages, show content as-is if available
          let displayContent = msg.content
          if (isIncomplete) {
            const trimmed = msg.content?.trim() || ''
            if (!trimmed || trimmed === '...') {
              displayContent = '_Message generation did not complete._'
            } else {
              // Show the content without alarming "interrupted" banner
              displayContent = trimmed
            }
          }

          // Mark incomplete messages in metadata for potential UI styling
          const displayMetadata = isIncomplete
            ? { ...msg.metadata, isIncomplete: true }
            : msg.metadata

          return createTextMessage(
            displayContent,
            msg.role as 'user' | 'assistant',
            msg.id,
            displayMetadata
          )
        })

        console.log('[DEBUG] loadChatSession - messages from server:', {
          count: result.data.messages.length,
          incompleteCount: result.data.messages.filter(m => m.metadata?.streamingStatus === 'streaming').length,
          messages: result.data.messages.map(m => ({
            id: m.id,
            role: m.role,
            contentLength: m.content?.length,
            streamingStatus: m.metadata?.streamingStatus
          }))
        })
        setMessages(chatMessages)
        setSelectedModel(result.data.session.model || undefined)
        logger.summary('Loaded messages', { count: chatMessages.length, chatId })
      } else {
        logger.error('Failed to load chat session', result.error)
        loadFromLocalStorage()
      }
    } catch (error) {
      logger.error('Error loading chat session', error)
      loadFromLocalStorage()
    }
  }
  
  // Fallback to localStorage (for transition period)
  const loadFromLocalStorage = () => {
    if (typeof window !== 'undefined') {
      try {
        const savedMessages = localStorage.getItem(chatStorageKey)
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages) as ChatMessage[]
          setMessages(parsedMessages)
        }
      } catch (error) {
        logger.debug('Failed to load from localStorage', error)
      }
    }
  }

  // Auto-scroll when messages change or during active streaming
  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Auto-scroll when step panel appears or updates
  useEffect(() => {
    if (currentStep && isLoading) {
      scrollToBottom()
    }
  }, [currentStep, isLoading])

  // Persist messages when they change (client-side only)
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(messages))
      } catch (error) {
        logger.debug('Failed to persist messages', error)
      }
    }
  }, [messages, isClient, chatStorageKey])

  const append = async (message: Message, attachments?: File[]) => {
    const messageContent = getMessageContent(message)

    // Use provided attachments or pending attachments
    const filesToAttach = attachments || pendingAttachments

    // Create message with text and any attachments
    // Add file parts with blob URLs for optimistic UI display
    const userMessage = filesToAttach.length > 0
      ? createMultimodalMessage(
          [
            { type: 'text', text: messageContent },
            ...filesToAttach.map(file => ({
              type: 'data-file' as const,
              data: {
                filename: file.name,
                mediaType: file.type,
                url: URL.createObjectURL(file)  // Temporary blob URL for preview
              }
            }))
          ],
          message.role as 'user' | 'assistant'
        )
      : createTextMessage(messageContent, message.role as 'user' | 'assistant')

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setStreamingSteps([]) // Reset steps for new message

    // Set optimistic "Thinking..." state immediately for instant UX feedback
    setCurrentStep({
      type: 'PLANNING',
      name: 'Thinking...',
      content: '',
      index: 0
    })

    setInput('')

    // Clear pending attachments since we're sending them
    if (!attachments && filesToAttach.length > 0) {
      clearAttachments()
    }

    // Generate message ID for cancellation tracking
    const messageId = `msg_${Date.now()}_${generateId()}`
    setCurrentMessageId(messageId)

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      logger.debug('Calling chat API', {
        messageId,
        toolCount: selectedTools.length,
        tools: selectedTools.map(t => t.name)
      })

      // Prepare chat messages for API call - send parts array for multimodal support
      const chatMessages = [...messages, userMessage].map(m => ({
        role: m.role as 'user' | 'assistant',
        parts: m.parts, // Send parts array to API
      }))

      // Prepare context data for API call using proper UI types
      const chatContextOptions = {
        domainType: contextOptions?.domainType || chatContext?.domainType,
        domainId: contextOptions?.domainId || chatContext?.domainId,
        model: selectedModel  // Include selected model for new chats
      }

      // AIDEV-NOTE: Extract tools from both UI selection AND message content

      // 1. Get explicitly selected tools from UI
      const selectedToolData = selectedTools.map(tool => {
        // If tool has skillId, create skill_reference config
        if (tool.skillId) {
          return {
            name: tool.name,
            version: tool.version || '',
            config: {
              type: 'skill_reference',
              skill_id: tool.skillId.toString()
            }
          }
        }

        // For reference tools (tables, documents, agents, etc.), include the actual IDs
        // These are at root level of ToolDTO, not in config
        if (tool.type === 'reference') {
          return {
            name: tool.name,
            version: tool.version || '',
            config: {
              ...tool.config,
              // Include reference-specific IDs from ToolDTO root
              ...(tool.tableId !== undefined && { table_id: tool.tableId }),
              ...(tool.documentId !== undefined && { document_id: tool.documentId }),
              ...(tool.fileId !== undefined && { file_id: tool.fileId }),
              ...(tool.agentId !== undefined && { agent_id: tool.agentId }),
              ...(tool.databaseId !== undefined && { database_id: tool.databaseId }),
              ...(tool.organizationId !== undefined && { organization_id: tool.organizationId }),
              ...(tool.tableName !== undefined && { table_name: tool.tableName }),
              ...(tool.filename !== undefined && { filename: tool.filename }),
              ...(tool.mimeType !== undefined && { mime_type: tool.mimeType }),
              ...(tool.fieldId !== undefined && { field_id: tool.fieldId }),
              ...(tool.rowId !== undefined && { row_id: tool.rowId }),
            }
          }
        }

        // Regular system tool - use existing config
        return {
          name: tool.name,
          version: tool.version,
          config: tool.config
        }
      })

      // 2. Extract tool references from message content (e.g., @tool:gmail-create-draft)
      const messageToolReferences = extractToolReferencesFromMessage(messageContent)

      // 3. Combine all tools (avoid duplicates by name)
      // Use unknown to accept both ToolDefinitionData and basic configs from message parsing
      const allTools: Array<{name: string, version: string, config: unknown}> = [...selectedToolData]
      for (const toolRef of messageToolReferences) {
        if (!allTools.find(t => t.name === toolRef.name)) {
          allTools.push(toolRef)
        }
      }

      logger.debug('Tool list for gRPC', { count: allTools.length, tools: allTools.map(t => t.name) })
      logger.debug('Attachments', { count: filesToAttach.length, files: filesToAttach.map(f => f.name) })

      const requestData = {
        messages: chatMessages,
        chatId: currentChatId,
        messageId: messageId, // For cancellation tracking
        ...(chatContextOptions?.domainType ? { domainType: chatContextOptions.domainType } : {}),
        ...(chatContextOptions?.domainId ? { domainId: chatContextOptions.domainId } : {}),
        ...(chatContextOptions?.model ? { model: chatContextOptions.model } : {}),
        tools: allTools
      }

      // Use FormData if there are attachments, otherwise JSON
      let requestBody: FormData | string
      let headers: Record<string, string> = {}

      if (filesToAttach.length > 0) {
        // Use FormData for multipart/form-data with files
        const formData = new FormData()
        formData.append('data', JSON.stringify(requestData))

        // Append each file
        filesToAttach.forEach((file, index) => {
          formData.append(`file_${index}`, file)
        })

        requestBody = formData
        // Don't set Content-Type - browser will set it with boundary
      } else {
        // Use JSON for text-only messages
        requestBody = JSON.stringify(requestData)
        headers['Content-Type'] = 'application/json'
      }

      // Call the gRPC-based streaming chat API
      const response = await fetch('/api/chat/stream-grpc', {
        method: 'POST',
        headers,
        credentials: 'include', // Ensure cookies are included in the request
        signal: abortControllerRef.current?.signal, // For abort support
        body: requestBody,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No reader available')
      }

      let assistantMessage = ''
      let accumulatedSteps: ExecutionStep[] = []
      const assistantId = generateId()
      let messageCreated = false // Track if we've added the message to UI yet

      logger.debug('Starting stream read')

      // Read the stream - gRPC API returns mixed SSE events and plain text
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          logger.debug('Stream completed')
          setCurrentStep(null) // Clear step progress
          break
        }

        // Decode the chunk
        const chunk = new TextDecoder().decode(value)
        buffer += chunk

        // Process buffer for SSE events (data: {...}\n\n)
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // Keep incomplete event in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6))

              if (eventData.type === 'chat_created') {
                // AIDEV-NOTE: Backend sends chatId immediately when chat is created
                // This ensures we track the same chat from the first message
                const chatId = eventData.chatId
                logger.summary('Chat created', { chatId })
                setCurrentChatId(chatId)
                onChatCreated?.(chatId)

              } else if (isStepProgressEvent(eventData)) {
                setCurrentStep({
                  type: eventData.stepType,
                  name: eventData.stepName,
                  index: eventData.stepIndex,
                  content: eventData.content
                })

                // Accumulate step for history display with deduplication
                const executionStep = createExecutionStep(
                  eventData.stepType,
                  eventData.stepName,
                  eventData.stepIndex,
                  eventData.content || '',
                  eventData.metadata
                )
                accumulatedSteps = addStepDeduped(accumulatedSteps, executionStep)
                setStreamingSteps(prev => addStepDeduped(prev, executionStep))

              } else if (isContentEvent(eventData)) {
                // Content chunk from assistant response
                assistantMessage += eventData.text

                // Create message on first content chunk (not before)
                if (!messageCreated) {
                  setMessages((prev) => [...prev, createTextMessage(
                    assistantMessage, 'assistant', assistantId,
                    accumulatedSteps.length > 0 ? { executionSteps: accumulatedSteps } : undefined
                  )])
                  messageCreated = true
                } else {
                  // Update the assistant message in real-time, preserving metadata
                  setMessages((prev) => prev.map((msg) =>
                    msg.id === assistantId
                      ? createTextMessage(assistantMessage, 'assistant', assistantId, msg.experimental_metadata)
                      : msg
                  ))
                }
              } else if (isMessageCompleteEvent(eventData)) {
                // Handle completion with execution steps metadata
                logger.debug('Received message completion with metadata', {
                  stepCount: eventData.metadata.executionSteps?.length || 0
                })

                // Update the assistant message with final metadata
                setMessages((prev) => prev.map((msg) =>
                  msg.id === assistantId
                    ? createTextMessage(
                        assistantMessage,
                        'assistant',
                        assistantId,
                        eventData.metadata // Include execution steps and other metadata
                      )
                    : msg
                ))

                // Clear streaming steps now that metadata is persisted
                setStreamingSteps([])

              } else if (isPlanApprovalRequestEvent(eventData)) {
                // Plan approval request - agent needs user confirmation before execution
                logger.debug('Plan approval requested', {
                  planId: eventData.planId,
                  stepCount: eventData.steps.length,
                  hasContext: !!eventData.context,
                  hasAnalysis: !!eventData.analysis
                })

                setPendingPlanApproval({
                  planId: eventData.planId,
                  goal: eventData.goal,
                  steps: eventData.steps,
                  estimatedActions: eventData.estimatedActions,
                  contextTables: eventData.contextTables,
                  context: eventData.context,
                  analysis: eventData.analysis
                })

                // Initialize active plan execution in draft state
                setActivePlanExecution({
                  planId: eventData.planId,
                  status: 'awaiting_approval',
                  completedSteps: [],
                  failedSteps: []
                })

              } else if (isPlanStatusUpdateEvent(eventData)) {
                // Plan execution status update
                logger.debug('Plan status update', {
                  planId: eventData.planId,
                  status: eventData.status,
                  currentStep: eventData.currentStepIndex
                })

                setActivePlanExecution(prev => {
                  if (!prev || prev.planId !== eventData.planId) {
                    // Create new execution state if doesn't exist
                    return {
                      planId: eventData.planId,
                      status: eventData.status,
                      currentStepIndex: eventData.currentStepIndex,
                      completedSteps: eventData.completedSteps || [],
                      failedSteps: eventData.failedSteps || [],
                      error: eventData.error
                    }
                  }

                  return {
                    ...prev,
                    status: eventData.status,
                    currentStepIndex: eventData.currentStepIndex ?? prev.currentStepIndex,
                    completedSteps: eventData.completedSteps || prev.completedSteps,
                    failedSteps: eventData.failedSteps || prev.failedSteps,
                    error: eventData.error
                  }
                })

                // Clear pending approval when plan starts executing or is cancelled
                if (['executing', 'cancelled', 'failed'].includes(eventData.status)) {
                  setPendingPlanApproval(null)
                }

                // Clear execution state when plan completes
                if (['completed', 'failed', 'cancelled'].includes(eventData.status)) {
                  // Keep the state for a moment to show final status, then clear
                  setTimeout(() => {
                    setActivePlanExecution(null)
                  }, 3000)
                }

              } else if (eventData.type === 'error') {
                // Handle error event with user-friendly message + hint
                // Log technical details to console ONLY
                console.error('[Chat Error]', {
                  code: eventData.errorCode,
                  sessionReset: eventData.sessionReset,
                  canRetry: eventData.canRetry,
                  timestamp: new Date().toISOString()
                });

                // Build user-friendly error message with hint
                let displayMessage = eventData.message || 'An error occurred';
                if (eventData.hint) {
                  displayMessage += `\n\n💡 ${eventData.hint}`;
                }

                // Add error message to chat
                setMessages((prev) => [...prev, createTextMessage(displayMessage, 'assistant')]);

                // Handle session reset (clear chatId to force new chat)
                if (eventData.sessionReset) {
                  logger.debug('Session was reset due to fatal error');
                  // Optionally clear currentChatId to force new chat on next message
                  // setCurrentChatId(undefined);
                }

                logger.summary('Error received', {
                  code: eventData.errorCode,
                  canRetry: eventData.canRetry
                });

              } else if (isAwaitingInputEvent(eventData)) {
                // Unified HITL: Agent needs user input (plan approval or questions)
                logger.debug('Awaiting input', {
                  inputType: eventData.inputType,
                  title: eventData.title,
                  optionsCount: eventData.options?.length || 0,
                  hasQuestions: !!eventData.questionSections?.length
                });

                // Set awaiting input state for UI to render approval/question card
                // API route normalizes inputType to 'plan_approval' | 'questions'
                // and converts questions to questionSections format
                setAwaitingInput({
                  inputType: eventData.inputType as 'plan_approval' | 'questions',
                  title: eventData.title,
                  content: eventData.content,
                  options: eventData.options || [],
                  planJson: eventData.planJson,
                  questionSections: eventData.questionSections
                });

                // Display content in chat history (if any)
                // Note: For plan_approval, content is empty (plan shown in message already)
                // For questions, content may be empty if using questionSections UI
                if (eventData.content) {
                  const inputMessage = `\n\n**${eventData.title}**\n\n${eventData.content}`;
                  assistantMessage += inputMessage;

                  if (!messageCreated) {
                    setMessages((prev) => [...prev, createTextMessage(assistantMessage, 'assistant', assistantId)]);
                    messageCreated = true;
                  } else {
                    setMessages((prev) => prev.map((msg) =>
                      msg.id === assistantId
                        ? createTextMessage(assistantMessage, 'assistant', assistantId)
                        : msg
                    ));
                  }
                }

                logger.summary('Awaiting input set', {
                  inputType: eventData.inputType,
                  title: eventData.title
                });

              } else if (isPermissionRequestEvent(eventData)) {
                // Permission request: Agent encountered RBAC error, needs user to grant access
                logger.debug('Permission request', {
                  permission: eventData.permission,
                  resource: eventData.resource,
                  resourceId: eventData.resourceId
                });

                // Set permission request state for UI to render access request card
                setPermissionRequest(eventData);

                // Display permission request in chat message
                const permissionMessage = `\n\n**Permission Required**\n\n${eventData.context || `Agent needs '${eventData.permission}' permission to continue.`}`;
                assistantMessage += permissionMessage;

                if (!messageCreated) {
                  setMessages((prev) => [...prev, createTextMessage(assistantMessage, 'assistant', assistantId)]);
                  messageCreated = true;
                } else {
                  setMessages((prev) => prev.map((msg) =>
                    msg.id === assistantId
                      ? createTextMessage(assistantMessage, 'assistant', assistantId)
                      : msg
                  ));
                }

                logger.summary('Permission request set', {
                  permission: eventData.permission,
                  resource: eventData.resource
                });
              }
            } catch (e) {
              logger.debug('Failed to parse SSE event', e)
            }
          }
        }
      }

      logger.summary('Stream complete', { messageLength: assistantMessage.length })

      // Check for new chat creation after stream completes
      await checkForNewChat()

    } catch (error) {
      logger.error('Chat error', error)

      // Check if it was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('Message cancelled by user')
        setMessages((prev) => [...prev, createTextMessage('_Message cancelled by user_', 'assistant')])
      } else {
        // Add error message
        const errorMsg = `Sorry, there was an error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
        setMessages((prev) => [...prev, createTextMessage(errorMsg, 'assistant')])
      }
    } finally {
      setStreamingSteps([])
      setIsLoading(false)
      setCurrentStep(null)
      setCurrentMessageId(null)
      abortControllerRef.current = null
    }

    return messageContent
  }

  // Clear all messages and session state
  const clearMessages = () => {
    setMessages([])
    setCurrentChatId(undefined)
    setStreamingSteps([])
    setCurrentStep(null)
    setSelectedModel(undefined)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(chatStorageKey)
      } catch (error) {
        logger.debug('Failed to clear persisted messages', error)
      }
    }
  }

  // Switch to a different chat session
  const switchToChat = async (chatId: string) => {
    try {
      logger.debug('Switching to chat', { chatId })
      await loadChatSession(chatId)
    } catch (error) {
      logger.error('Failed to switch chat', error)
    }
  }

  // Check for new chat creation after stream completes
  const checkForNewChat = async () => {
    try {
      // Only check if we don't already have a currentChatId
      if (currentChatId) return
      
      const { data: session } = await import('next-auth/react').then(m => ({ data: m.getSession() }))
      const organizationId = (session as any)?.user?.currentOrganizationId
      const userId = (session as any)?.user?.id
      
      if (!organizationId || !userId) return
      
      // Create context for the current domain
      const context: ChatContextDTO = {
        domainType: contextOptions?.domainType === 'general' ? undefined : contextOptions?.domainType,
        domainId: contextOptions?.domainId,
        organizationId,
        userId
      }

      logger.debug('Checking for new chat', { context })

      // Get the current (most recent) chat for this context
      const result = await getCurrentChatSession(context)

      if (result.success && result.data) {
        const newChatId = result.data.id
        logger.summary('New chat created', { chatId: newChatId })

        // Update current chat ID
        setCurrentChatId(newChatId)

        // Notify parent component if callback provided
        onChatCreated?.(newChatId)
      }

    } catch (error) {
      logger.error('Failed to check for new chat', error)
    }
  }

  // Create a new chat session
  const createNewChat = async () => {
    try {
      logger.debug('Creating new chat', {
        domainType: contextOptions?.domainType || chatContext?.domainType,
        domainId: contextOptions?.domainId || chatContext?.domainId
      })

      // Clear ALL session state for clean slate
      setMessages([])
      setCurrentChatId(undefined)
      setStreamingSteps([])
      setCurrentStep(null)
      setSelectedModel(undefined)
      setAwaitingInput(null)

      // Clear localStorage for this context
      if (typeof window !== 'undefined') {
        localStorage.removeItem(chatStorageKey)
      }

      // Note: New chat sessions are created automatically by stream-grpc
      // when the first message is sent with no chatId

      logger.debug('New chat session cleared successfully')

    } catch (error) {
      logger.error('Failed to create new chat', error)
    }
  }

  // Cancel current message processing
  const cancelMessage = async () => {
    if (!currentMessageId || !abortControllerRef.current) {
      logger.debug('No message to cancel')
      return
    }

    logger.debug('Cancelling message', { messageId: currentMessageId })

    try {
      // Abort the fetch request
      abortControllerRef.current.abort()

      // Also call backend cancellation API (fire and forget)
      await fetch('/api/chat/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId: currentMessageId })
      }).catch(err => {
        logger.debug('Backend cancel failed (non-critical)', err)
      })
    } catch (error) {
      logger.error('Cancel error', error)
    }
  }

  // Plan approval functions
  const approvePlan = async () => {
    if (!pendingPlanApproval) {
      logger.debug('No pending plan to approve')
      return
    }

    logger.debug('Approving plan', { planId: pendingPlanApproval.planId })

    // Update execution status to approved
    setActivePlanExecution(prev => prev ? { ...prev, status: 'approved' } : null)

    // Send approval message to continue execution
    await append({
      role: 'user',
      content: 'Yes, proceed with the plan'
    } as any)

    // Clear pending approval (execution will start)
    setPendingPlanApproval(null)
  }

  const rejectPlan = async () => {
    if (!pendingPlanApproval) {
      logger.debug('No pending plan to reject')
      return
    }

    logger.debug('Rejecting plan', { planId: pendingPlanApproval.planId })

    // Update execution status to cancelled
    setActivePlanExecution(prev => prev ? { ...prev, status: 'cancelled' } : null)

    // Send rejection message
    await append({
      role: 'user',
      content: 'No, cancel this plan'
    } as any)

    // Clear pending approval
    setPendingPlanApproval(null)

    // Clear execution state after a moment
    setTimeout(() => {
      setActivePlanExecution(null)
    }, 1500)
  }

  // Unified HITL response function (for both plan approval and questions)
  const respondToInput = async (response: string) => {
    if (!awaitingInput) {
      logger.debug('No awaiting input to respond to')
      return
    }

    logger.debug('Responding to input', {
      inputType: awaitingInput.inputType,
      response
    })

    // Clear awaiting input state immediately
    setAwaitingInput(null)

    // Send the response as a user message to continue the conversation
    // The agent will resume with reset=false to continue from where it left off
    // AIDEV-NOTE: Must use 'parts' format, not 'content' - getMessageContent expects parts array
    await append({
      id: generateId(),
      role: 'user',
      parts: [{ type: 'text', text: response }]
    })

    logger.summary('Input response sent', {
      inputType: awaitingInput.inputType,
      response
    })
  }

  // Tool management functions
  const addTool = async (tool: ToolDTO) => {
    // No validation needed - domain objects are self-validating
    setSelectedTools(prev => {
      // Prevent duplicates
      if (prev.find(t => t.name === tool.name)) {
        return prev
      }
      return [...prev, tool]
    })
  }

  const removeTool = (tool: ToolDTO) => {
    setSelectedTools(prev => prev.filter(t => t.name !== tool.name))

    // Also remove the tool reference from input text
    if (tool.insertText) {
      const insertText = tool.insertText // TypeScript narrowing
      setInput(prev => {
        // Remove all occurrences of the tool reference (e.g., "@table:customers")
        const regex = new RegExp(insertText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        return prev.replace(regex, '').trim()
      })
      logger.debug('Removed tool reference from input', { insertText })
    }
  }

  // Attachment management functions
  const addAttachment = (file: File) => {
    setPendingAttachments(prev => [...prev, file])
    logger.debug('Added attachment', { filename: file.name, type: file.type, size: file.size })
  }

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index))
    logger.debug('Removed attachment', { index })
  }

  const clearAttachments = () => {
    setPendingAttachments([])
    logger.debug('Cleared all attachments')
  }

  return {
    // Base ChatHandler required fields
    status: isLoading ? 'streaming' : 'ready',
    sendMessage: async (msg: Message) => {
      await append(msg)
    },
    isLoading,
    append,
    messages, // Return original messages array
    setMessages,
    scrollRef,
    scrollToBottom,
    clearMessages,
    currentChatId,
    switchToChat,
    createNewChat,
    // Tool management
    selectedTools,
    availableTools,
    addTool,
    removeTool,
    // Attachment management
    pendingAttachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    // Step progress and cancellation
    currentStep,
    streamingSteps,
    cancelMessage,
    // Model selection for new chats
    selectedModel,
    setModel: setSelectedModel,
    // Plan approval workflow
    pendingPlanApproval,
    activePlanExecution,
    approvePlan,
    rejectPlan,
    // Unified HITL awaiting input
    awaitingInput,
    respondToInput,
    // Permission request (RBAC errors)
    permissionRequest,
    clearPermissionRequest: () => setPermissionRequest(null),
  }
}

