/**
 * Chat DTOs
 *
 * Data Transfer Objects for chat domain operations.
 * Uses primitives at boundaries, Value Objects used internally by application services.
 */

import type { DomainType } from '@/ddd/domain/shared/types/domain-type';
import type { ChatMessageMetadata } from '@/ddd/domain/chat/entities/chat-message';

// Re-export response DTOs from mapper to avoid duplication
export type {
  ChatContextDTO,
  ChatSessionDTO,
  ChatMessageDTO,
  ChatWithMessagesDTO,
  CreateChatSessionDTO
} from '@/app/mappers/chat-mapper';

/**
 * DTO for creating a new chat session
 */
export interface CreateChatDTO {
  organizationId: number;
  createdBy: string;
  title?: string;
  description?: string;
  domainType?: DomainType;
  domainId?: number;
}

/**
 * DTO for sending a message to a chat
 */
export interface SendMessageDTO {
  chatId: string;
  userId: string;
  organizationId: number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: ChatMessageMetadata;
}

/**
 * DTO for querying chat history
 */
export interface GetChatHistoryDTO {
  chatId: string;
  userId: string;
  organizationId: number;
  limit?: number;
  offset?: number;
}

/**
 * DTO for querying chats list
 */
export interface GetChatsDTO {
  userId?: string;
  organizationId: number;
  tableId?: number;
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

// Re-export execution step types from domain for convenience
export type {
  ExecutionStep,
  ExecutionStepMetadata
} from '@/ddd/domain/chat/value-objects/execution-step';

// Re-export ChatMessageMetadata from domain for convenience
export type { ChatMessageMetadata } from '@/ddd/domain/chat/entities/chat-message';
