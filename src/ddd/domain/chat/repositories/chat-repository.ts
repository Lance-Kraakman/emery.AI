/**
 * Chat Repository Interface
 * 
 * Defines the contract for chat data persistence and retrieval.
 * Supports organizational scoping and table-connected chats.
 * 
 * AIDEV-NOTE: Repository interface for chat domain - defines data access patterns
 * for table-connected chats with organizational isolation
 */

import type { Chat, CreateChatData, UpdateChatData } from '../entities/chat';
import type { ChatId, OrganizationId, TableId, UserId } from '@/src/ddd/domain/shared/value-objects';

export interface IChatRepository {
  /**
   * Create a new chat
   */
  create(data: CreateChatData): Promise<Chat>;

  /**
   * Find a chat by ID with organization scoping
   */
  findById(id: ChatId, organizationId: OrganizationId): Promise<Chat | null>;

  /**
   * Find all chats for an organization
   */
  findByOrganization(organizationId: OrganizationId, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Find chats for a specific user in an organization
   */
  findByUser(userId: UserId, organizationId: OrganizationId, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Find chats connected to a specific table
   */
  findByTable(tableId: TableId, organizationId: OrganizationId, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Find active chats for an organization
   */
  findActiveByOrganization(organizationId: OrganizationId, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Update a chat
   */
  update(id: ChatId, data: UpdateChatData, organizationId: OrganizationId): Promise<Chat | null>;

  /**
   * Archive a chat (soft delete)
   */
  archive(id: ChatId, organizationId: OrganizationId): Promise<boolean>;

  /**
   * Permanently delete a chat
   */
  delete(id: ChatId, organizationId: OrganizationId): Promise<boolean>;

  /**
   * Check if a chat exists and user has access
   */
  exists(id: ChatId, organizationId: OrganizationId): Promise<boolean>;

  /**
   * Get chat statistics for an organization
   */
  getOrganizationStats(organizationId: OrganizationId): Promise<{
    totalChats: number;
    activeChats: number;
    archivedChats: number;
    tableConnectedChats: number;
    totalMessages: number;
  }>;

  /**
   * Get recent chats for a user
   */
  getRecentChats(userId: UserId, organizationId: OrganizationId, limit?: number): Promise<Chat[]>;

  /**
   * Search chats by title or description
   */
  search(query: string, organizationId: OrganizationId, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Update message count and last message timestamp
   */
  updateMessageStats(chatId: ChatId, messageCount: number, lastMessageAt: Date): Promise<boolean>;
}