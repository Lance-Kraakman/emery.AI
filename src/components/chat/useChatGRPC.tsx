'use client'

import { generateId } from 'ai'
import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { ChatHandler, Message, type MessagePart } from '@llamaindex/chat-ui'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store'
import { createChatStreamRequest, type ChatContextOptions } from './types/chat-requests'
import { loadChatWithFullHistory, getCurrentChatSession } from '@/app/actions/chat-history'
import type { ChatMessageDTO, ChatContextDTO } from '@/app/mappers/chat-mapper'
import type { ToolDTO } from '@/app/mappers/tool-mapper'
import { createDebugLogger } from '@/lib/utils/debug-logger'

const logger = createDebugLogger('ChatGRPC')

interface ChatMessage extends Message {
  id: string
}

/**
 * Helper to extract text content from Message parts
 */
function getMessageContent(message: Message): string {
  if (!message.parts || message.parts.length === 0) return ''

  // Find the first text part
  const textPart = message.parts.find((part: MessagePart) => typeof part === 'string' || (typeof part === 'object' && part?.type === 'text'))

  if (typeof textPart === 'string') return textPart
  if (textPart && typeof textPart === 'object' && 'text' in textPart) return textPart.text

  // Fallback: convert first part to string
  return String(message.parts[0] || '')
}

/**
 * Helper to create a Message with text content
 */
function createTextMessage(content: string, role: 'user' | 'assistant' | 'system', id?: string): ChatMessage {
  return {
    id: id || generateId(),
    role,
    parts: [{ type: 'text', text: content }],
  }
}

/**
 * Extract tool references from message content
 * Finds patterns like @tool:gmail-create-draft and converts them to tool configs
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

  return toolReferences
}

// Extended ChatHandler interface with scroll functionality, persistence, and tool management
interface ExtendedChatHandler extends ChatHandler {
  // Base ChatHandler fields
  isLoading: boolean
  messages: ChatMessage[]
  append: (message: Message) => Promise<string>
  setMessages: (messages: ChatMessage[]) => void
  // Custom fields
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
  clearMessages?: () => void
  currentChatId?: string
  switchToChat?: (chatId: string) => Promise<void>
  createNewChat?: () => Promise<void>
  // Tool management
  selectedTools: ToolDTO[]
  availableTools: ToolDTO[]
  addTool: (tool: ToolDTO) => void
  removeTool: (tool: ToolDTO) => void
  // Step progress tracking
  currentStep: { type: string; name: string; index: number } | null
  // Cancellation
  cancelMessage?: () => Promise<void>
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
  } | null>(null)
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // AIDEV-NOTE: Use fine-grained store subscription instead of useLayout()
  const chatContext = useStore(uiStateStore, uiStateSelectors.chatContext)

  // Tool management state
  const [selectedTools, setSelectedTools] = useState<ToolDTO[]>([])
  const [availableTools, setAvailableTools] = useState<ToolDTO[]>([])
  
  // Generate domain-specific storage key for this chat session
  const chatStorageKey = `emery-chat-${contextOptions?.domainType || chatContext?.domainType || 'general'}-${contextOptions?.domainId || chatContext?.domainId || 'default'}`

  // Auto-scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
        const chatMessages: ChatMessage[] = result.data.messages.map(msg =>
          createTextMessage(msg.content, msg.role as 'user' | 'assistant', msg.id)
        )

        setMessages(chatMessages)
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

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const append = async (message: Message) => {
    const messageContent = getMessageContent(message)
    const userMessage = createTextMessage(messageContent, message.role as 'user' | 'assistant')

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setInput('')

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

      // Prepare chat messages for API call
      const chatMessages = [...messages, userMessage].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: getMessageContent(m),
      }))

      // Prepare context data for API call using proper UI types
      const chatContextOptions = {
        domainType: contextOptions?.domainType || chatContext?.domainType,
        domainId: contextOptions?.domainId || chatContext?.domainId
      }

      // AIDEV-NOTE: Extract tools from both UI selection AND message content

      // 1. Get explicitly selected tools from UI
      const selectedToolData = selectedTools.map(tool => ({
        name: tool.name,
        version: tool.version,
        config: tool.config
      }))

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

      const requestBody = {
        messages: chatMessages,
        chatId: currentChatId,
        messageId: messageId, // For cancellation tracking
        ...(chatContextOptions?.domainType ? { domainType: chatContextOptions.domainType } : {}),
        ...(chatContextOptions?.domainId ? { domainId: chatContextOptions.domainId } : {}),
        tools: allTools
      }

      // Call the gRPC-based streaming chat API
      const response = await fetch('/api/chat/stream-grpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are included in the request
        signal: abortControllerRef.current?.signal, // For abort support
        body: JSON.stringify(requestBody),
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

              if (eventData.type === 'step_progress') {
                setCurrentStep({
                  type: eventData.stepType,
                  name: eventData.stepName,
                  index: eventData.stepIndex
                })
              } else if (eventData.type === 'content') {
                // Content chunk from assistant response
                assistantMessage += eventData.text

                // Create message on first content chunk (not before)
                if (!messageCreated) {
                  setMessages((prev) => [...prev, createTextMessage(assistantMessage, 'assistant', assistantId)])
                  messageCreated = true
                } else {
                  // Update the assistant message in real-time
                  setMessages((prev) => prev.map((msg) =>
                    msg.id === assistantId
                      ? createTextMessage(assistantMessage, 'assistant', assistantId)
                      : msg
                  ))
                }
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
      setIsLoading(false)
      setCurrentStep(null)
      setCurrentMessageId(null)
      abortControllerRef.current = null
    }

    return messageContent
  }

  // Clear all messages and localStorage
  const clearMessages = () => {
    setMessages([])
    setCurrentChatId(undefined)
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

      // Clear current session
      setMessages([])
      setCurrentChatId(undefined)

      // Clear localStorage for this context
      if (typeof window !== 'undefined') {
        localStorage.removeItem(chatStorageKey)
      }

      // Note: New chat sessions are created automatically by stream-grpc
      // when the first message is sent with no chatId

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
  }

  return {
    // Base ChatHandler required fields
    status: isLoading ? 'streaming' : 'ready',
    sendMessage: async (msg: Message) => {
      await append(msg)
    },
    isLoading,
    append,
    messages, // Messages already have the correct structure with id and parts
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
    // Step progress and cancellation
    currentStep,
    cancelMessage,
  }
}

/**
 * Hook factory for page-specific chat contexts
 * Creates pre-configured chat hooks for different page types
 */
export const useChatForPage = {
  missionControl: () => useChatGRPC({ 
    domainType: 'general' 
  }),
  
  agents: (agentId?: number) => useChatGRPC({ 
    domainType: 'agents',
    domainId: agentId 
  }),
  
  teams: (teamId?: number) => useChatGRPC({ 
    domainType: 'teams',
    domainId: teamId 
  }),
  
  data: (tableId?: number) => useChatGRPC({ 
    domainType: 'tables',
    domainId: tableId
  }),
  
  organization: () => useChatGRPC({ 
    domainType: 'organizations'
  }),
  
}