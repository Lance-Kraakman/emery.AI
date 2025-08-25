'use client'

import { generateId } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { ChatHandler, Message } from '@llamaindex/chat-ui'
import type { DomainType } from '@/ddd/domain/chat/entities/chat'
import { useLayout } from '@/components/layout/LayoutProvider'

interface ChatMessage extends Message {
  id: string
}

// Extended ChatHandler interface with scroll functionality and persistence
interface ExtendedChatHandler extends ChatHandler {
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
  clearMessages?: () => void
}

// Chat context options for domain-specific functionality
interface ChatContextOptions {
  domainType?: DomainType | 'organization' | 'general'
  domainId?: number
  tableId?: number // Legacy support
  organizationId?: number
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
export function useChatGRPC(contextOptions?: ChatContextOptions): ExtendedChatHandler {
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isClient, setIsClient] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { chatContext } = useLayout()
  
  // Generate a consistent storage key for this chat session
  const chatStorageKey = 'emery-chat-messages'

  // Auto-scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  // Initialize client-side and load persisted messages
  useEffect(() => {
    setIsClient(true)
    
    // Load persisted messages from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedMessages = localStorage.getItem(chatStorageKey)
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages) as ChatMessage[]
          setMessages(parsedMessages)
        }
      } catch (error) {
        console.warn('[CHAT-GRPC-HOOK] Failed to load persisted messages:', error)
      }
    }
  }, [chatStorageKey])

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
      console.log('[CHAT-GRPC-HOOK] Calling gRPC-based chat API with context:', {
        contextOptions,
        chatContext,
        domainType: contextOptions?.domainType || chatContext?.domainType
      })
      
      // Prepare context data for API call
      const requestBody = {
        messages: [...messages, userMessage].map(m => ({
          role: m.role,
          content: m.content,
        })),
        // Include context from both hook params and layout context
        domainType: contextOptions?.domainType || chatContext?.domainType,
        domainId: contextOptions?.domainId || chatContext?.domainId,
        tableId: contextOptions?.tableId, // Legacy support
        organizationId: contextOptions?.organizationId
      }
      
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(chatStorageKey)
      } catch (error) {
        console.warn('[CHAT-GRPC-HOOK] Failed to clear persisted messages:', error)
      }
    }
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
    domainType: 'agent',
    domainId: agentId 
  }),
  
  teams: (teamId?: number) => useChatGRPC({ 
    domainType: 'team',
    domainId: teamId 
  }),
  
  data: (tableId?: number) => useChatGRPC({ 
    domainType: 'table',
    domainId: tableId,
    tableId // Legacy support
  }),
  
  organization: (organizationId?: number) => useChatGRPC({ 
    domainType: 'organization',
    organizationId 
  }),
  
  workflow: (workflowId?: number) => useChatGRPC({ 
    domainType: 'workflow',
    domainId: workflowId 
  })
}