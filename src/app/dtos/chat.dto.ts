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

/**
 * Metadata for execution steps
 */
export interface ExecutionStepMetadata {
  tool?: string
  arguments?: string
  observations?: string
  error?: string
}

/**
 * Execution step from agent processing
 *
 * Steps are collected during agent execution and persisted in message metadata.
 * They provide transparency into the agent's reasoning and tool usage.
 */
export interface ExecutionStep {
  type: 'PLANNING' | 'ACTION' | 'REASONING' | 'FINAL'
  name: string
  content: string
  index: number
  timestamp: number
  metadata?: ExecutionStepMetadata
}
