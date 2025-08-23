'use client'

import { generateId } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { ChatHandler, Message } from '@llamaindex/chat-ui'

interface ChatMessage extends Message {
  id: string
}

// Extended ChatHandler interface with scroll functionality
interface ExtendedChatHandler extends ChatHandler {
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
}

// Simple streaming chat handler that calls our API directly
export function useChatRSC(): ExtendedChatHandler {
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
      // Call our streaming chat API
      const response = await fetch('/api/chat/stream', {
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
        throw new Error(`HTTP error! status: ${response.status}`)
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

      // Read the stream - AI SDK v5 returns plain text stream
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode the chunk - it's plain text now, not SSE format
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
      console.error('Chat error:', error)
      
      // Add error message
      setMessages((prev) => [...prev, {
        id: generateId(),
        content: 'Sorry, there was an error processing your message. Please check your OpenAI API key and try again.',
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
