/**
 * ChatMessage Repository Interface
 * 
 * Defines the contract for chat message data persistence and retrieval.
 * Supports message ordering, threading, and RAG source tracking.
 * 
 * AIDEV-NOTE: Repository interface for chat message domain - defines data access patterns
 * for conversation flow management and RAG source tracking
 */

import type { ChatMessage, CreateChatMessageData, UpdateChatMessageData } from '../entities/chat-message';

export interface IChatMessageRepository {
  /**
   * Create a new chat message
   */
  create(data: CreateChatMessageData): Promise<ChatMessage>;

  /**
   * Find a message by ID
   */
  findById(id: string): Promise<ChatMessage | null>;

  /**
   * Find all messages for a chat, ordered by message index
   */
  findByChatId(chatId: string, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Find messages by chat with role filtering
   */
  findByChatIdAndRole(chatId: string, role: 'user' | 'assistant' | 'system', limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Find the latest message in a chat
   */
  findLatestByChatId(chatId: string): Promise<ChatMessage | null>;

  /**
   * Find messages that are replies to a specific message
   */
  findReplies(parentMessageId: string): Promise<ChatMessage[]>;

  /**
   * Update a message
   */
  update(id: string, data: UpdateChatMessageData): Promise<ChatMessage | null>;

  /**
   * Delete a message
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get the next message index for a chat
   */
  getNextMessageIndex(chatId: string): Promise<number>;

  /**
   * Get message count for a chat
   */
  getMessageCount(chatId: string): Promise<number>;

  /**
   * Find messages with RAG sources
   */
  findMessagesWithRagSources(chatId: string, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Find messages by content search
   */
  searchMessageContent(chatId: string, query: string, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Get conversation context (recent messages) for AI processing
   */
  getConversationContext(chatId: string, contextSize: number): Promise<ChatMessage[]>;

  /**
   * Find assistant messages with errors
   */
  findErrorMessages(chatId: string, limit?: number, offset?: number): Promise<ChatMessage[]>;

  /**
   * Get message statistics for a chat
   */
  getChatMessageStats(chatId: string): Promise<{
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
  deleteByChatId(chatId: string): Promise<number>; // Returns count of deleted messages
}