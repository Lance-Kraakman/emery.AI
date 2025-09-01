/**
 * Drizzle ChatMessage Repository Implementation
 * 
 * Concrete implementation of IChatMessageRepository using Drizzle ORM.
 * Handles message persistence with conversation flow and RAG source tracking.
 * 
 * AIDEV-NOTE: Repository implementation for chat message domain - provides data access
 * for conversation management with RAG source tracking and message ordering
 */

import { chatMessages } from '@/lib/db/schema';
import { eq, and, desc, asc, ilike, sql, max, count } from 'drizzle-orm';
import type { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import type { ChatMessage, CreateChatMessageData, UpdateChatMessageData } from '@/ddd/domain/chat/entities/chat-message';
import { ChatId, ChatMessageId } from '@/ddd/domain/shared/value-objects';
import type { DbClient } from '@/lib/db/client';

export class DrizzleChatMessageRepository implements IChatMessageRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Create a new chat message
   */
  async create(data: CreateChatMessageData): Promise<ChatMessage> {
    const [message] = await this.db.insert(chatMessages).values({
      chatId: data.chatId,
      role: data.role,
      content: data.content,
      metadata: data.metadata || null,
      messageIndex: data.messageIndex,
      parentMessageId: data.parentMessageId || null
    }).returning();

    return this.mapToChatMessage(message);
  }

  /**
   * Find a message by ID
   */
  async findById(id: ChatMessageId): Promise<ChatMessage | null> {
    const [message] = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id.value));

    return message ? this.mapToChatMessage(message) : null;
  }

  /**
   * Find all messages for a chat, ordered by message index
   */
  async findByChatId(chatId: ChatId, limit = 50, offset = 0): Promise<ChatMessage[]> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value))
      .orderBy(asc(chatMessages.messageIndex))
      .limit(limit)
      .offset(offset);

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Find messages by chat with role filtering
   */
  async findByChatIdAndRole(chatId: ChatId, role: 'user' | 'assistant' | 'system', limit = 50, offset = 0): Promise<ChatMessage[]> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.chatId, chatId.value),
        eq(chatMessages.role, role)
      ))
      .orderBy(asc(chatMessages.messageIndex))
      .limit(limit)
      .offset(offset);

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Find the latest message in a chat
   */
  async findLatestByChatId(chatId: ChatId): Promise<ChatMessage | null> {
    const [message] = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value))
      .orderBy(desc(chatMessages.messageIndex))
      .limit(1);

    return message ? this.mapToChatMessage(message) : null;
  }

  /**
   * Find messages that are replies to a specific message
   */
  async findReplies(parentMessageId: ChatMessageId): Promise<ChatMessage[]> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.parentMessageId, parentMessageId.value))
      .orderBy(asc(chatMessages.messageIndex));

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Update a message
   */
  async update(id: ChatMessageId, data: UpdateChatMessageData): Promise<ChatMessage | null> {
    const updateData: any = {};

    if (data.content !== undefined) updateData.content = data.content;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const [updatedMessage] = await this.db
      .update(chatMessages)
      .set(updateData)
      .where(eq(chatMessages.id, id.value))
      .returning();

    return updatedMessage ? this.mapToChatMessage(updatedMessage) : null;
  }

  /**
   * Delete a message
   */
  async delete(id: ChatMessageId): Promise<boolean> {
    const result = await this.db
      .delete(chatMessages)
      .where(eq(chatMessages.id, id.value))
      .returning({ id: chatMessages.id });

    return result.length > 0;
  }

  /**
   * Get the next message index for a chat
   */
  async getNextMessageIndex(chatId: ChatId): Promise<number> {
    const [result] = await this.db
      .select({
        maxIndex: max(chatMessages.messageIndex)
      })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value));

    return (result?.maxIndex ?? -1) + 1;
  }

  /**
   * Get message count for a chat
   */
  async getMessageCount(chatId: ChatId): Promise<number> {
    const [result] = await this.db
      .select({
        count: count()
      })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value));

    return result?.count || 0;
  }

  /**
   * Find messages with RAG sources
   */
  async findMessagesWithRagSources(chatId: ChatId, limit = 20, offset = 0): Promise<ChatMessage[]> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.chatId, chatId.value),
        sql`${chatMessages.metadata}->>'ragSources' is not null`
      ))
      .orderBy(desc(chatMessages.messageIndex))
      .limit(limit)
      .offset(offset);

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Find messages by content search
   */
  async searchMessageContent(chatId: ChatId, query: string, limit = 20, offset = 0): Promise<ChatMessage[]> {
    const searchTerm = `%${query}%`;
    
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.chatId, chatId.value),
        ilike(chatMessages.content, searchTerm)
      ))
      .orderBy(desc(chatMessages.messageIndex))
      .limit(limit)
      .offset(offset);

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Get conversation context (recent messages) for AI processing
   */
  async getConversationContext(chatId: ChatId, contextSize: number): Promise<ChatMessage[]> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value))
      .orderBy(desc(chatMessages.messageIndex))
      .limit(contextSize);

    // Return in chronological order (oldest first)
    return results.reverse().map(message => this.mapToChatMessage(message));
  }

  /**
   * Find assistant messages with errors
   */
  async findErrorMessages(chatId: ChatId, limit = 10, offset = 0): Promise<ChatMessage[]> {
    const results = await this.db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.chatId, chatId.value),
        eq(chatMessages.role, 'assistant'),
        sql`${chatMessages.metadata}->>'error' is not null`
      ))
      .orderBy(desc(chatMessages.messageIndex))
      .limit(limit)
      .offset(offset);

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Get message statistics for a chat
   */
  async getChatMessageStats(chatId: ChatId): Promise<{
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    messagesWithRag: number;
    averageProcessingTime: number | null;
  }> {
    const [stats] = await this.db
      .select({
        totalMessages: count(),
        userMessages: sql<number>`count(*) filter (where role = 'user')`,
        assistantMessages: sql<number>`count(*) filter (where role = 'assistant')`,
        systemMessages: sql<number>`count(*) filter (where role = 'system')`,
        messagesWithRag: sql<number>`count(*) filter (where metadata->>'ragSources' is not null)`,
        averageProcessingTime: sql<number>`avg((metadata->>'processingTime')::numeric) filter (where metadata->>'processingTime' is not null)`
      })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value));

    return {
      totalMessages: stats?.totalMessages || 0,
      userMessages: stats?.userMessages || 0,
      assistantMessages: stats?.assistantMessages || 0,
      systemMessages: stats?.systemMessages || 0,
      messagesWithRag: stats?.messagesWithRag || 0,
      averageProcessingTime: stats?.averageProcessingTime || null
    };
  }

  /**
   * Bulk create messages (for importing conversations)
   */
  async createBulk(messages: CreateChatMessageData[]): Promise<ChatMessage[]> {
    const insertData = messages.map(msg => ({
      chatId: msg.chatId,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata || null,
      messageIndex: msg.messageIndex,
      parentMessageId: msg.parentMessageId || null
    }));

    const results = await this.db
      .insert(chatMessages)
      .values(insertData)
      .returning();

    return results.map(message => this.mapToChatMessage(message));
  }

  /**
   * Delete all messages for a chat (cascade delete)
   */
  async deleteByChatId(chatId: ChatId): Promise<number> {
    const result = await this.db
      .delete(chatMessages)
      .where(eq(chatMessages.chatId, chatId.value))
      .returning({ id: chatMessages.id });

    return result.length;
  }

  /**
   * Map database row to ChatMessage domain entity
   */
  private mapToChatMessage(row: any): ChatMessage {
    return {
      id: row.id,
      chatId: row.chatId,
      role: row.role,
      content: row.content,
      metadata: row.metadata,
      messageIndex: row.messageIndex,
      parentMessageId: row.parentMessageId,
      createdAt: row.createdAt
    };
  }
}