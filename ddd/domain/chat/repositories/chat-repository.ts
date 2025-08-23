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

export interface IChatRepository {
  /**
   * Create a new chat
   */
  create(data: CreateChatData): Promise<Chat>;

  /**
   * Find a chat by ID with organization scoping
   */
  findById(id: string, organizationId: number): Promise<Chat | null>;

  /**
   * Find all chats for an organization
   */
  findByOrganization(organizationId: number, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Find chats for a specific user in an organization
   */
  findByUser(userId: string, organizationId: number, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Find chats connected to a specific table
   */
  findByTable(tableId: number, organizationId: number, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Find active chats for an organization
   */
  findActiveByOrganization(organizationId: number, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Update a chat
   */
  update(id: string, data: UpdateChatData, organizationId: number): Promise<Chat | null>;

  /**
   * Archive a chat (soft delete)
   */
  archive(id: string, organizationId: number): Promise<boolean>;

  /**
   * Permanently delete a chat
   */
  delete(id: string, organizationId: number): Promise<boolean>;

  /**
   * Check if a chat exists and user has access
   */
  exists(id: string, organizationId: number): Promise<boolean>;

  /**
   * Get chat statistics for an organization
   */
  getOrganizationStats(organizationId: number): Promise<{
    totalChats: number;
    activeChats: number;
    archivedChats: number;
    tableConnectedChats: number;
    totalMessages: number;
  }>;

  /**
   * Get recent chats for a user
   */
  getRecentChats(userId: string, organizationId: number, limit?: number): Promise<Chat[]>;

  /**
   * Search chats by title or description
   */
  search(query: string, organizationId: number, limit?: number, offset?: number): Promise<Chat[]>;

  /**
   * Update message count and last message timestamp
   */
  updateMessageStats(chatId: string, messageCount: number, lastMessageAt: Date): Promise<boolean>;
}