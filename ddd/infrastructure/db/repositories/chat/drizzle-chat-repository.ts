/**
 * Drizzle Chat Repository Implementation
 * 
 * Concrete implementation of IChatRepository using Drizzle ORM.
 * Handles chat persistence with organizational scoping and table connections.
 * 
 * AIDEV-NOTE: Repository implementation for chat domain - provides data access
 * for table-connected chats with proper organizational isolation
 */

import type { DbClient } from '@/lib/db/client';
import { chats } from '@/lib/db/schema';
import { eq, and, desc, asc, ilike, isNull, isNotNull, sql } from 'drizzle-orm';
import type { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import type { Chat, CreateChatData, UpdateChatData } from '@/ddd/domain/chat/entities/chat';

export class DrizzleChatRepository implements IChatRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Create a new chat
   */
  async create(data: CreateChatData): Promise<Chat> {
    const [chat] = await this.db.insert(chats).values({
      organizationId: data.organizationId,
      createdBy: data.createdBy,
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
  async findById(id: string, organizationId: number): Promise<Chat | null> {
    const [chat] = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.id, id),
        eq(chats.organizationId, organizationId)
      ));

    return chat ? this.mapToChat(chat) : null;
  }

  /**
   * Find all chats for an organization
   */
  async findByOrganization(organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(eq(chats.organizationId, organizationId))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map(chat => this.mapToChat(chat));
  }

  /**
   * Find chats for a specific user in an organization
   */
  async findByUser(userId: string, organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.createdBy, userId),
        eq(chats.organizationId, organizationId)
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map(chat => this.mapToChat(chat));
  }

  /**
   * Find chats connected to a specific table
   */
  async findByTable(tableId: number, organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId),
        sql`${chats.contextMetadata}->>'contextType' = 'table' AND (${chats.contextMetadata}->'domainSchema'->>'id')::integer = ${tableId}`
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map(chat => this.mapToChat(chat));
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

    return results.map(chat => this.mapToChat(chat));
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

    return results.map(chat => this.mapToChat(chat));
  }

  /**
   * Find active chats for an organization
   */
  async findActiveByOrganization(organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId),
        eq(chats.status, 'active')
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map(chat => this.mapToChat(chat));
  }

  /**
   * Update a chat
   */
  async update(id: string, data: UpdateChatData, organizationId: number): Promise<Chat | null> {
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
        eq(chats.id, id),
        eq(chats.organizationId, organizationId)
      ))
      .returning();

    return updatedChat ? this.mapToChat(updatedChat) : null;
  }

  /**
   * Archive a chat (soft delete)
   */
  async archive(id: string, organizationId: number): Promise<boolean> {
    const result = await this.db
      .update(chats)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(and(
        eq(chats.id, id),
        eq(chats.organizationId, organizationId)
      ))
      .returning({ id: chats.id });

    return result.length > 0;
  }

  /**
   * Permanently delete a chat
   */
  async delete(id: string, organizationId: number): Promise<boolean> {
    const result = await this.db
      .delete(chats)
      .where(and(
        eq(chats.id, id),
        eq(chats.organizationId, organizationId)
      ))
      .returning({ id: chats.id });

    return result.length > 0;
  }

  /**
   * Check if a chat exists and user has access
   */
  async exists(id: string, organizationId: number): Promise<boolean> {
    const [chat] = await this.db
      .select({ id: chats.id })
      .from(chats)
      .where(and(
        eq(chats.id, id),
        eq(chats.organizationId, organizationId)
      ));

    return !!chat;
  }

  /**
   * Get chat statistics for an organization
   */
  async getOrganizationStats(organizationId: number): Promise<{
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
      .where(eq(chats.organizationId, organizationId));

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
  async getRecentChats(userId: string, organizationId: number, limit = 10): Promise<Chat[]> {
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.createdBy, userId),
        eq(chats.organizationId, organizationId),
        eq(chats.status, 'active')
      ))
      .orderBy(desc(chats.lastMessageAt), desc(chats.updatedAt))
      .limit(limit);

    return results.map(chat => this.mapToChat(chat));
  }

  /**
   * Search chats by title or description
   */
  async search(query: string, organizationId: number, limit = 20, offset = 0): Promise<Chat[]> {
    const searchTerm = `%${query}%`;
    
    const results = await this.db
      .select()
      .from(chats)
      .where(and(
        eq(chats.organizationId, organizationId),
        sql`(${chats.title} ilike ${searchTerm} or ${chats.description} ilike ${searchTerm})`
      ))
      .orderBy(desc(chats.updatedAt))
      .limit(limit)
      .offset(offset);

    return results.map(chat => this.mapToChat(chat));
  }

  /**
   * Update message count and last message timestamp
   */
  async updateMessageStats(chatId: string, messageCount: number, lastMessageAt: Date): Promise<boolean> {
    const result = await this.db
      .update(chats)
      .set({
        messageCount,
        lastMessageAt,
        updatedAt: new Date()
      })
      .where(eq(chats.id, chatId))
      .returning({ id: chats.id });

    return result.length > 0;
  }

  /**
   * Map database row to Chat domain entity
   */
  private mapToChat(row: any): Chat {
    return {
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
    };
  }
}