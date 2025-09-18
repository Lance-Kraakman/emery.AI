/**
 * Chat Mapper
 * 
 * Maps between Chat domain entities and DTOs for UI boundary.
 * Provides consistent conversion patterns following established architecture.
 */

import type { Chat } from '@/src/ddd/domain/chat/entities/chat';
import type { ChatMessage } from '@/src/ddd/domain/chat/entities/chat-message';
import type { DomainType } from '@/src/ddd/domain/rag/value-objects';

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

export class ChatMapper {
  /**
   * Convert Chat domain entity to ChatSessionDTO
   */
  static toSessionDTO(chat: Chat): ChatSessionDTO {
    return {
      id: chat.id.value,
      title: chat.title,
      description: chat.description,
      status: chat.status,
      messageCount: chat.messageCount,
      lastMessageAt: chat.lastMessageAt,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      contextMetadata: chat.contextMetadata
    };
  }

  /**
   * Convert ChatMessage domain entity to ChatMessageDTO
   */
  static toMessageDTO(message: ChatMessage): ChatMessageDTO {
    return {
      id: message.id.value,
      chatId: message.chatId.value,
      content: message.content,
      role: message.role,
      createdAt: message.createdAt,
      metadata: message.metadata
    };
  }

  /**
   * Convert array of ChatMessage entities to ChatMessageDTOs
   */
  static toMessageDTOs(messages: ChatMessage[]): ChatMessageDTO[] {
    return messages.map(message => this.toMessageDTO(message));
  }

  /**
   * Create ChatWithMessagesDTO from chat and messages
   */
  static toChatWithMessagesDTO(
    chat: Chat, 
    messages: ChatMessage[], 
    totalMessages?: number
  ): ChatWithMessagesDTO {
    return {
      session: this.toSessionDTO(chat),
      messages: this.toMessageDTOs(messages),
      totalMessages: totalMessages ?? messages.length
    };
  }
}