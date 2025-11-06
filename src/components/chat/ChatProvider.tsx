'use client'

import React, { createContext, useContext } from 'react'
import { useChatGRPC } from './useChatGRPC'
import type { ChatHandler } from '@llamaindex/chat-ui'
import type { ChatContextConfig } from '@/components/layout/types'
import type { ToolDTO } from '@/app/mappers/tool-mapper'

/**
 * ChatProvider - Isolates chat state management to prevent unnecessary re-renders
 *
 * This component wraps the chat handler creation and provides it via context.
 * Only components that consume this context will re-render when chat messages update.
 *
 * This prevents the entire layout from re-rendering on every chat message,
 * while still maintaining LlamaIndex's artifact functionality via ChatSection.
 *
 * AIDEV-NOTE: Created to fix BasePage re-rendering issue. By isolating useChatGRPC()
 * inside this provider, we prevent the handler object from being recreated in the
 * parent layout component, which was causing cascade re-renders.
 */

// Extended handler interface that includes our custom methods
interface ExtendedChatHandler extends ChatHandler {
  isLoading: boolean
  messages: any[] // This shouldnt be any
  append: (message: any, attachments?: File[]) => Promise<string>
  setMessages: (messages: any[]) => void
  scrollRef?: React.RefObject<HTMLDivElement>
  scrollToBottom?: () => void
  clearMessages?: () => void
  currentChatId?: string
  switchToChat?: (chatId: string) => Promise<void>
  createNewChat?: () => Promise<void>
  selectedTools: ToolDTO[]
  availableTools: ToolDTO[]
  addTool: (tool: ToolDTO) => void
  removeTool: (tool: ToolDTO) => void
  // Attachment management
  pendingAttachments: File[]
  addAttachment: (file: File) => void
  removeAttachment: (index: number) => void
  clearAttachments: () => void
  currentStep: { type: string; name: string; index: number } | null
  cancelMessage?: () => Promise<void>
}

// Context for chat handler
const ChatHandlerContext = createContext<ExtendedChatHandler | null>(null)

interface ChatProviderProps {
  children: React.ReactNode
  chatContext?: ChatContextConfig
  onChatCreated?: (chatId: string) => void
}

export function ChatProvider({ children, chatContext, onChatCreated }: ChatProviderProps) {
  // Call useChatGRPC here - this component will re-render on message updates
  // but its children won't (if they're memoized or don't consume this context)
  const handler = useChatGRPC(
    {
      domainType: chatContext?.domainType,
      domainId: chatContext?.domainId
    },
    onChatCreated
  )

  return (
    <ChatHandlerContext.Provider value={handler as ExtendedChatHandler}>
      {children}
    </ChatHandlerContext.Provider>
  )
}

/**
 * Hook to consume chat handler from context
 * Must be used within a ChatProvider
 */
export function useChatHandler(): ExtendedChatHandler {
  const context = useContext(ChatHandlerContext)
  if (!context) {
    throw new Error('useChatHandler must be used within a ChatProvider')
  }
  return context
}
