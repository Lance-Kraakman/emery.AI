/**
 * Chat UI Request Types
 * AIDEV-NOTE: UI-specific request types for gRPC chat communication
 * These are NOT domain mappings - those belong in app/mappers/
 */

import type { DomainType } from '@/ddd/domain/rag/value-objects'

export interface ChatMessageRequest {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatStreamRequest {
  messages: ChatMessageRequest[]
  chatId?: string
  domainType?: DomainType | 'organizations' | 'general'
  domainId?: number
}

export interface ChatContextOptions {
  domainType?: DomainType | 'organizations' | 'general'
  domainId?: number
  chatId?: string
}

// Helper function to create properly structured chat requests
export function createChatStreamRequest(
  messages: ChatMessageRequest[],
  options?: ChatContextOptions,
  chatId?: string
): ChatStreamRequest {
  return {
    messages,
    chatId,
    ...(options?.domainType ? { domainType: options.domainType } : {}),
    ...(options?.domainId ? { domainId: options.domainId } : {})
  }
}