/**
 * Chat UI Request Types
 * AIDEV-NOTE: UI-specific request types for gRPC chat communication
 * These are NOT domain mappings - those belong in app/mappers/
 */

import type { DomainType } from '@/ddd/domain/rag/value-objects'
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config'

export interface ChatMessageRequest {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatStreamRequest {
  messages: ChatMessageRequest[]
  chatId?: string
  domainType?: DomainType | 'organizations' | 'general'
  domainId?: number
  tools: ToolConfig[]  // Always present, can be empty array
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
  chatId?: string,
  tools: ToolConfig[] = []
): ChatStreamRequest {
  return {
    messages,
    chatId,
    ...(options?.domainType ? { domainType: options.domainType } : {}),
    ...(options?.domainId ? { domainId: options.domainId } : {}),
    tools
  }
}