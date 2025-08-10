'use client'

import { generateId } from 'ai'
import { useState } from 'react'
import { ChatHandler, Message } from '@llamaindex/chat-ui'

interface ChatMessage extends Message {
  id: string
}

// Simple streaming chat handler that calls our API directly
export function useChatRSC(): ChatHandler {
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

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
  }
}
