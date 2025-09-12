'use client'

import { generateId } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { ChatHandler, Message } from '@llamaindex/chat-ui'

interface ChatMessage extends Message {
  id: string
}

// Extended ChatHandler interface with scroll functionality
interface ExtendedChatHandler extends ChatHandler {
  append: (message: Message) => Promise<string>
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
}

/**
 * gRPC-based Chat Handler
 * 
 * Uses the new /api/chat/stream-grpc endpoint which:
 * - Handles database operations (sessions, messages) in Next.js
 * - Calls gRPC service for AI processing (RAG + LLM streaming)
 * - Provides the same interface as the original REST-based hook
 * 
 * AIDEV-NOTE: gRPC-based chat handler that leverages
 * the new gRPC architecture while maintaining the same React interface.
 */
export function useChatGRPC(): ExtendedChatHandler {
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      console.log('[CHAT-GRPC-HOOK] Calling gRPC-based chat API')
      
      // Call the new gRPC-based streaming chat API
      const response = await fetch('/api/chat/stream-grpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are included in the request
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      // Handle streaming response (same as original implementation)
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

      // Read the stream - gRPC API returns plain text stream (same as original)
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

  return {
    input,
    setInput,
    isLoading,
    append,
    messages,
    setMessages,
    scrollRef,
    scrollToBottom,
  }
}

/**
 * Enhanced hook with additional gRPC-specific features
 */
export function useChatGRPCWithContext(
  chatId?: string,
  domainType?: string,
  domainId?: number,
  tableId?: number
): ExtendedChatHandler {
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
      console.log('[CHAT-GRPC-CONTEXT-HOOK] Calling gRPC chat API with context:', {
        chatId,
        domainType,
        domainId,
        tableId
      })

      // Call gRPC API with context information
      const response = await fetch('/api/chat/stream-grpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          chatId,
          domainType,
          domainId,
          tableId
        }),
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

      // Read the stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

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

    } catch (error) {
      console.error('[CHAT-GRPC-CONTEXT-HOOK] Chat error:', error)
      
      // Add error message
      setMessages((prev) => [...prev, {
        id: generateId(),
        content: `Sorry, there was an error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your connection and try again.`,
        role: 'assistant' as const,
      }])
    } finally {
      setIsLoading(false)
    }

    return message.content as string
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
  }
}