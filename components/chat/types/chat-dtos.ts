/**
 * Chat DTOs for UI Boundary
 * 
 * Data Transfer Objects for clean separation between domain entities
 * and UI components. These DTOs are used by Server Actions and UI components.
 */

import type { DomainType } from '@/ddd/domain/rag/value-objects'

/**
 * Context filter for loading chat sessions
 */
export interface ChatContextDTO {
  domainType?: DomainType | 'organizations'
  domainId?: number
  organizationId: number
  userId: string
  limit?: number
  offset?: number
}

/**
 * Chat session data for UI display
 */
export interface ChatSessionDTO {
  id: string
  title: string
  description?: string
  status: 'active' | 'archived' | 'deleted'
  messageCount: number
  lastMessageAt?: Date
  createdAt: Date
  updatedAt: Date
  
  // Context information for UI
  contextMetadata?: {
    contextType?: DomainType | 'organizations'
    domainSchema?: {
      id?: number
      name?: string
      type?: string
      [key: string]: any
    }
    primaryRagWeight?: number
    lastRagUpdate?: string
  }
}

/**
 * Message data for UI display
 */
export interface ChatMessageDTO {
  id: string
  chatId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  createdAt: Date
  
  // Optional metadata for UI features
  metadata?: {
    ragSources?: any[]
    processingTime?: number
    modelUsed?: string
    [key: string]: any
  }
}

/**
 * Complete chat session with messages for loading specific chats
 */
export interface ChatWithMessagesDTO {
  session: ChatSessionDTO
  messages: ChatMessageDTO[]
  totalMessages: number
}

/**
 * Result wrapper for Server Actions
 */
export interface ChatActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Request to create a new chat session
 */
export interface CreateChatSessionDTO {
  title?: string
  domainType?: DomainType | 'organizations'
  domainId?: number
  domainName?: string
  organizationId: number
  userId: string
}