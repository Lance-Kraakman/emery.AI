'use client'

import { generateId } from 'ai'
import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { ChatHandler, Message } from '@llamaindex/chat-ui'
import type { DomainType } from '@/ddd/domain/rag/value-objects'
import { useLayout } from '@/components/layout/LayoutProvider'
import { createChatStreamRequest, type ChatContextOptions } from './types/chat-requests'
import { loadChatWithFullHistory, getCurrentChatSession } from '@/app/actions/chat-history'
import type { ChatMessageDTO, ChatContextDTO } from '@/app/mappers/chat-mapper'
import type { ToolConfig } from '@/lib/grpc/generated/agent_worker'

interface ChatMessage extends Message {
  id: string
}

// Extended ChatHandler interface with scroll functionality, persistence, and tool management
interface ExtendedChatHandler extends ChatHandler {
  append: (message: Message) => Promise<string>
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
  clearMessages?: () => void
  currentChatId?: string
  switchToChat?: (chatId: string) => Promise<void>
  createNewChat?: () => Promise<void>
  onChatCreated?: (chatId: string) => void
  // Tool management
  selectedTools: ToolConfig[]
  availableTools: ToolConfig[]
  addTool: (tool: ToolConfig) => void
  removeTool: (toolName: string) => void
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const { chatContext } = useLayout()

  // Tool management state
  const [selectedTools, setSelectedTools] = useState<ToolConfig[]>([])
  const [availableTools, setAvailableTools] = useState<ToolConfig[]>([])
  
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
      console.log('[CHAT-GRPC-HOOK] Loading chat session:', chatId)
      const result = await loadChatWithFullHistory(chatId)
      
      if (result.success && result.data) {
        setCurrentChatId(chatId)
        
        // Convert DTOs to ChatMessage format
        const chatMessages: ChatMessage[] = result.data.messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role as 'user' | 'assistant'
        }))
        
        setMessages(chatMessages)
        console.log(`[CHAT-GRPC-HOOK] Loaded ${chatMessages.length} messages for chat ${chatId}`)
      } else {
        console.error('[CHAT-GRPC-HOOK] Failed to load chat session:', result.error)
        // Fall back to localStorage for this context
        loadFromLocalStorage()
      }
    } catch (error) {
      console.error('[CHAT-GRPC-HOOK] Error loading chat session:', error)
      // Fall back to localStorage for this context
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
        console.warn('[CHAT-GRPC-HOOK] Failed to load from localStorage:', error)
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
        console.warn('[CHAT-GRPC-HOOK] Failed to persist messages:', error)
      }
    }
  }, [messages, isClient, chatStorageKey])

  const append = async (message: Message) => {
    const userMessage: ChatMessage = {
      id: generateId(),
      content: message.content,
      role: message.role as 'user' | 'assistant',
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setInput('')

    try {
      console.log('[CHAT-GRPC-HOOK] Calling gRPC-based chat API with tools:', {
        selectedTools: selectedTools.length,
        toolNames: selectedTools.map(t => t.name)
      })

      // Prepare chat messages for API call
      const chatMessages = [...messages, userMessage].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      // Prepare context data for API call using proper UI types
      const chatContextOptions = {
        domainType: contextOptions?.domainType || chatContext?.domainType,
        domainId: contextOptions?.domainId || chatContext?.domainId
      }

      // AIDEV-NOTE: Use helper function for consistent request structure with tools
      const requestBody = createChatStreamRequest(chatMessages, chatContextOptions, currentChatId, selectedTools)
      
      // Call the gRPC-based streaming chat API
      const response = await fetch('/api/chat/stream-grpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are included in the request
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

      // Add empty assistant message that we'll stream into
      setMessages((prev) => [...prev, {
        id: assistantId,
        content: '',
        role: 'assistant' as const,
      }])

      console.log('[CHAT-GRPC-HOOK] Starting to read gRPC streaming response')

      // Read the stream - gRPC API returns plain text stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[CHAT-GRPC-HOOK] Stream reading completed')
          break
        }

        // Decode the chunk - it's plain text from gRPC processing
        const chunk = new TextDecoder().decode(value)
        
        if (chunk) {
          assistantMessage += chunk
          
          // Update the assistant message in real-time
          setMessages((prev) => prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: assistantMessage }
              : msg
          ))
        }
      }

      console.log('[CHAT-GRPC-HOOK] Final assistant message length:', assistantMessage.length)

      // Check for new chat creation after stream completes
      await checkForNewChat()

    } catch (error) {
      console.error('[CHAT-GRPC-HOOK] Chat error:', error)
      
      // Add error message
      setMessages((prev) => [...prev, {
        id: generateId(),
        content: `Sorry, there was an error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        role: 'assistant' as const,
      }])
    } finally {
      setIsLoading(false)
    }

    return message.content as string
  }

  // Clear all messages and localStorage
  const clearMessages = () => {
    setMessages([])
    setCurrentChatId(undefined)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(chatStorageKey)
      } catch (error) {
        console.warn('[CHAT-GRPC-HOOK] Failed to clear persisted messages:', error)
      }
    }
  }

  // Switch to a different chat session
  const switchToChat = async (chatId: string) => {
    try {
      console.log('[CHAT-GRPC-HOOK] Switching to chat:', chatId)
      await loadChatSession(chatId)
    } catch (error) {
      console.error('[CHAT-GRPC-HOOK] Failed to switch chat:', error)
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
      
      console.log('[CHAT-GRPC-HOOK] Checking for new chat creation:', context)
      
      // Get the current (most recent) chat for this context
      const result = await getCurrentChatSession(context)
      
      if (result.success && result.data) {
        const newChatId = result.data.id
        console.log('[CHAT-GRPC-HOOK] Found new chat created:', newChatId)
        
        // Update current chat ID
        setCurrentChatId(newChatId)
        
        // Notify parent component if callback provided
        onChatCreated?.(newChatId)
      }
      
    } catch (error) {
      console.error('[CHAT-GRPC-HOOK] Failed to check for new chat:', error)
    }
  }

  // Create a new chat session
  const createNewChat = async () => {
    try {
      console.log('[CHAT-GRPC-HOOK] Creating new chat for context:', {
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
      console.error('[CHAT-GRPC-HOOK] Failed to create new chat:', error)
    }
  }

  // Tool management functions
  const addTool = (tool: ToolConfig) => {
    setSelectedTools(prev => {
      // Prevent duplicates
      if (prev.find(t => t.name === tool.name)) {
        return prev
      }
      return [...prev, tool]
    })
  }

  const removeTool = (toolName: string) => {
    setSelectedTools(prev => prev.filter(t => t.name !== toolName))
  }

  return {
    input,
    setInput,
    isLoading,
    append,
    messages,
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