/**
 * Drizzle Chat Repository Implementation
 * 
 * Concrete implementation of IChatRepository using Drizzle ORM.
 * Handles chat persistence with organizational scoping and table connections.
 * 
 * AIDEV-NOTE: Repository implementation for chat domain - provides data access
 * for table-connected chats with proper organizational isolation
 */

import { chats } from '@/src/lib/db/schema';
import { eq, and, desc, asc, ilike, isNull, isNotNull, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { IChatRepository } from '@/src/ddd/domain/chat/repositories/chat-repository';
import { Chat, type CreateChatData, type UpdateChatData } from '@/src/ddd/domain/chat/entities/chat';
import type { ChatId, OrganizationId, TableId, UserId } from '@/src/ddd/domain/shared/value-objects';
import type { DbClient } from '@/src/lib/db/client';

type ChatRow = InferSelectModel<typeof chats>;

export class DrizzleChatRepository implements IChatRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Create a new chat
   */
  async create(data: CreateChatData): Promise<Chat> {
    const [chat] = await this.db.insert(chats).values({
      organizationId: data.organizationId.value,
      createdBy: data.createdBy.value,
      title: data.title,
      description: data.description || null,
      contextMetadata: data.contextMetadata || null,
      status: 'active',
      messageCount: 0,
      lastMessageAt: null
    }).returning();

    return this.mapToChat(chat);
  }

  /**
   * Find a chat by ID with organization scoping
   */
  async findById(id: ChatId, organizationId: OrganizationId): Promise<Chat | null> {
    const [chat] = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.id, id.value),
        eq(chats.organizationId, organizationId.value)
      ));

    return chat ? this.mapToChat(chat) : null;
  }

  /**
   * Find all chats for an organization
   */
  async findByOrganization(organizationId: OrganizationId, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(eq(chats.organizationId, organizationId.value))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Find chats for a specific user in an organization
   */
  async findByUser(userId: UserId, organizationId: OrganizationId, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.createdBy, userId.value),
        eq(chats.organizationId, organizationId.value)
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Find chats connected to a specific table
   */
  async findByTable(tableId: TableId, organizationId: OrganizationId, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId.value),
        sql`${chats.contextMetadata}->>'contextType' = 'table' AND (${chats.contextMetadata}->'domainSchema'->>'id')::integer = ${tableId.value}`
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);
    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Find chats connected to a specific domain
   */
  async findByDomain(domainType: string, domainId: number, organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId),
        sql`${chats.contextMetadata}->>'contextType' = ${domainType} AND (${chats.contextMetadata}->'domainSchema'->>'id')::integer = ${domainId}`
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Find chats by domain type (all entities of that type)
   */
  async findByDomainType(domainType: string, organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId),
        sql`${chats.contextMetadata}->>'contextType' = ${domainType}`
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Find active chats for an organization
   */
  async findActiveByOrganization(organizationId: OrganizationId, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId.value),
        eq(chats.status, 'active')
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Update a chat
   */
  async update(id: ChatId, data: UpdateChatData, organizationId: OrganizationId): Promise<Chat | null> {
    const updateData: any = {
      updatedAt: new Date()
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.contextMetadata !== undefined) updateData.contextMetadata = data.contextMetadata;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.lastMessageAt !== undefined) updateData.lastMessageAt = data.lastMessageAt;
    if (data.messageCount !== undefined) updateData.messageCount = data.messageCount;

    const [updatedChat] = await this.db
      .update(chats)
      .set(updateData)
      .where(and(
        eq(chats.id, id.value),
        eq(chats.organizationId, organizationId.value)
      ))
      .returning();

    return updatedChat ? this.mapToChat(updatedChat) : null;
  }

  /**
   * Archive a chat (soft delete)
   */
  async archive(id: ChatId, organizationId: OrganizationId): Promise<boolean> {
    const result = await this.db
      .update(chats)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(and(
        eq(chats.id, id.value),
        eq(chats.organizationId, organizationId.value)
      ))
      .returning({ id: chats.id });

    return result.length > 0;
  }

  /**
   * Permanently delete a chat
   */
  async delete(id: ChatId, organizationId: OrganizationId): Promise<boolean> {
    const result = await this.db
      .delete(chats)
      .where(and(
        eq(chats.id, id.value),
        eq(chats.organizationId, organizationId.value)
      ))
      .returning({ id: chats.id });

    return result.length > 0;
  }

  /**
   * Check if a chat exists and user has access
   */
  async exists(id: ChatId, organizationId: OrganizationId): Promise<boolean> {
    const [chat] = await this.db
      .select({ id: chats.id })
      .from(chats)
      .where(and(
        eq(chats.id, id.value),
        eq(chats.organizationId, organizationId.value)
      ));

    return !!chat;
  }

  /**
   * Get chat statistics for an organization
   */
  async getOrganizationStats(organizationId: OrganizationId): Promise<{
    totalChats: number;
    activeChats: number;
    archivedChats: number;
    tableConnectedChats: number;
    totalMessages: number;
  }> {
    const [stats] = await this.db
      .select({
        totalChats: sql<number>`count(*)`,
        activeChats: sql<number>`count(*) filter (where status = 'active')`,
        archivedChats: sql<number>`count(*) filter (where status = 'archived')`,
        tableConnectedChats: sql<number>`count(*) filter (where context_metadata->>'contextType' = 'table')`,
        totalMessages: sql<number>`coalesce(sum(message_count), 0)`
      })
      .from(chats)
      .where(eq(chats.organizationId, organizationId.value));

    return {
      totalChats: stats?.totalChats || 0,
      activeChats: stats?.activeChats || 0,
      archivedChats: stats?.archivedChats || 0,
      tableConnectedChats: stats?.tableConnectedChats || 0,
      totalMessages: stats?.totalMessages || 0
    };
  }

  /**
   * Get recent chats for a user
   */
  async getRecentChats(userId: UserId, organizationId: OrganizationId, limit = 10): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.createdBy, userId.value),
        eq(chats.organizationId, organizationId.value),
        eq(chats.status, 'active')
      ))
      .orderBy(desc(chats.lastMessageAt), desc(chats.updatedAt))
      .limit(limit);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Search chats by title or description
   */
  async search(query: string, organizationId: OrganizationId, limit = 20, offset = 0): Promise<Chat[]> {
    const searchTerm = `%${query}%`;
    
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId.value),
        sql`(${chats.title} ilike ${searchTerm} or ${chats.description} ilike ${searchTerm})`
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map((chat: ChatRow) => this.mapToChat(chat));
  }

  /**
   * Update message count and last message timestamp
   */
  async updateMessageStats(chatId: ChatId, messageCount: number, lastMessageAt: Date): Promise<boolean> {
    const result = await this.db
      .update(chats)
      .set({
        messageCount,
        lastMessageAt,
        updatedAt: new Date()
      })
      .where(eq(chats.id, chatId.value))
      .returning({ id: chats.id });

    return result.length > 0;
  }

  /**
   * Map database row to Chat domain entity
   */
  private mapToChat(row: any): Chat {
    return Chat.fromPersistence({
      id: row.id,
      organizationId: row.organizationId,
      createdBy: row.createdBy,
      title: row.title,
      description: row.description,
      contextMetadata: row.contextMetadata,
      status: row.status,
      messageCount: row.messageCount || 0,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }
}