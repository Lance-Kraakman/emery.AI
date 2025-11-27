import { generateId } from 'ai'
import type { Message, MessagePart } from '@llamaindex/chat-ui'
import type { ChatMessage } from '@/components/chat/types/extended-chat-handler'

/**
 * Create a text-only message with optional metadata
 */
export function createTextMessage(
  content: string,
  role: 'user' | 'assistant' | 'system',
  id?: string,
  metadata?: any
): ChatMessage {
  return {
    id: id || generateId(),
    role,
    parts: [{ type: 'text', text: content }],
    experimental_metadata: metadata
  }
}

/**
 * Create a multimodal message with multiple parts (text, images, audio, files)
 */
export function createMultimodalMessage(
  parts: MessagePart[],
  role: 'user' | 'assistant' | 'system',
  id?: string,
  metadata?: any
): ChatMessage {
  return {
    id: id || generateId(),
    role,
    parts,
    experimental_metadata: metadata
  }
}

/**
 * Extract text content from a Message
 */
export function getMessageContent(message: Message): string {
  if (!message.parts || message.parts.length === 0) return ''

  // Find the first text part
  const textPart = message.parts.find((part): part is { type: 'text'; text: string } =>
    part.type === 'text'
  )

  return textPart?.text || ''
}
