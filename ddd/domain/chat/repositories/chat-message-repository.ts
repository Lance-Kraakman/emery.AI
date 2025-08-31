/**
 * ChatMessage Repository Interface
 * 
 * Defines the contract for chat message data persistence and retrieval.
 * Supports message ordering, threading, and RAG source tracking.
 * 
 * AIDEV-NOTE: Repository interface for chat message domain - defines data access patterns
 * for conversation flow management and RAG source tracking
 */

import { ChatId, ChatMessageId } from '../../shared/value-objects';
import type { ChatMessage, CreateChatMessageData, UpdateChatMessageData } from '../entities/chat-message';

export interface IChatMessageRepository {
  /**
   * Create a new chat message
   */
  create(data: CreateChatMessageData): Promise<ChatMessage>;

  /**
   * Find a message by ID
   */
  findById(id: ChatMessageId): Promise<ChatMessage | null>;

  /**
   * Find all messages for a chat, ordered by message index
   */
  findByChatId(chatId: ChatId, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Find messages by chat with role filtering
   */
  findByChatIdAndRole(chatId: ChatId, role: 'user' | 'assistant' | 'system', limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Find the latest message in a chat
   */
  findLatestByChatId(chatId: ChatId): Promise<ChatMessage | null>;

  /**
   * Find messages that are replies to a specific message
   */
  findReplies(parentMessageId: ChatMessageId): Promise<ChatMessage[]>;

  /**
   * Update a message
   */
  update(id: ChatMessageId, data: UpdateChatMessageData): Promise<ChatMessage | null>;

  /**
   * Delete a message
   */
  delete(id: ChatMessageId): Promise<boolean>;

  /**
   * Get the next message index for a chat
   */
  getNextMessageIndex(chatId: ChatId): Promise<number>;

  /**
   * Get message count for a chat
   */
  getMessageCount(chatId: ChatId): Promise<number>;

  /**
   * Find messages with RAG sources
   */
  findMessagesWithRagSources(chatId: ChatId, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Find messages by content search
   */
  searchMessageContent(chatId: ChatId, query: string, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Get conversation context (recent messages) for AI processing
   */
  getConversationContext(chatId: ChatId, contextSize: number): Promise<ChatMessage[]>;

  /**
   * Find assistant messages with errors
   */
  findErrorMessages(chatId: ChatId, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Get message statistics for a chat
   */
  getChatMessageStats(chatId: ChatId): Promise<{
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    messagesWithRag: number;
    averageProcessingTime: number | null;
  }>;

  /**
   * Bulk create messages (for importing conversations)
   */
  createBulk(messages: CreateChatMessageData[]): Promise<ChatMessage[]>;

  /**
   * Delete all messages for a chat (cascade delete)
   */
  deleteByChatId(chatId: ChatId): Promise<number>; // Returns count of deleted messages
}