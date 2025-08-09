'use client'

import { generateId, CoreMessage } from 'ai'
import { useActions, useUIState } from 'ai/rsc'
import { useState } from 'react'
import { AIProvider, ClientMessage } from './ai'
import { ChatHandler, Message } from '@llamaindex/chat-ui'

function UserMessage({ content }: { content: string }) {
  return (
    <div className="bg-primary text-primary-foreground ml-auto w-fit max-w-[80%] rounded-xl px-3 py-2 shadow-sm border border-primary/20">
      {content}
    </div>
  )
}

// simple hook to create chat handler from RSC actions
// then we can easily use it with @llamaindex/chat-ui
export function useChatRSC(): ChatHandler {
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [messages, setMessages] = useUIState<typeof AIProvider>()
  const { chatAction } = useActions()

  // similar append function as useChat hook
  const append = async (message: Message) => {
    const newMsg: CoreMessage = {
      content: message.content,
      role: message.role as "user" | "assistant",
    }

    setIsLoading(true)
    try {
      setMessages((prev: ClientMessage[]) => [
        ...prev,
        {
          id: generateId(),
          ...newMsg,
          display: <UserMessage content={message.content as string}/>,
        },
      ])
      const assistantMsg = await chatAction(newMsg.content as string)
      setMessages((prev: ClientMessage[]) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          display: assistantMsg,
        },
      ])
    } catch (error) {
      console.error(error)
    }
    setIsLoading(false)
    setInput('')

    return message.content as string
  }

  return {
    input,
    setInput,
    isLoading,
    append,
    messages: messages.map(m => ({
      ...m,
      role: m.role,
      content: (m.display as any)?.props?.content || '',
    })),
    setMessages: setMessages as any,
  }
}
