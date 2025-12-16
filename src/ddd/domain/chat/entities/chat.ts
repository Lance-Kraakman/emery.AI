/**
 * Chat Domain Entity
 * 
 * Represents a chat session connected to any domain type (tables, agents, files, teams, etc.).
 * Manages chat metadata, RAG context, and domain-specific functionality.
 * 
 * AIDEV-NOTE: Domain entity for chat sessions - contains business rules for
 * domain-connected chats with dual-context RAG integration and organizational scoping
 */

import { ChatId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { DomainType } from '@/ddd/domain/shared/types/domain-type';

export interface ChatContextMetadata {
  contextType?: DomainType | 'organizations';
  domainSchema?: {
    id?: number;        // Domain entity ID (replaces domainId/tableId)
    name?: string;      // Domain entity name
    type?: string;      // Additional type info if needed
    [key: string]: any; // Flexible domain-specific data
  };
}

export type ChatStatus = 'active' | 'archived' | 'deleted';

export class Chat {
  private constructor(
    private readonly _id: ChatId,
    private readonly _organizationId: OrganizationId,
    private readonly _createdBy: UserId,
    private _title: string,
    private _description: string | undefined,
    private _model: string | undefined,
    private _contextMetadata: ChatContextMetadata | undefined,
    private _status: ChatStatus,
    private _messageCount: number,
    private _lastMessageAt: Date | undefined,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Getters
  get id(): ChatId { return this._id; }
  get organizationId(): OrganizationId { return this._organizationId; }
  get createdBy(): UserId { return this._createdBy; }
  get title(): string { return this._title; }
  get description(): string | undefined { return this._description; }
  get model(): string | undefined { return this._model; }
  get contextMetadata(): ChatContextMetadata | undefined { return this._contextMetadata; }
  get status(): ChatStatus { return this._status; }
  get messageCount(): number { return this._messageCount; }
  get lastMessageAt(): Date | undefined { return this._lastMessageAt; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // Business methods - only keep what's actually used

  /**
   * Check if user can access this chat
   */
  canUserAccess(userId: UserId, userOrganizationId: OrganizationId): boolean {
    // User must be in same organization
    if (!userOrganizationId.equals(this._organizationId)) {
      return false;
    }

    // Chat must be active (not deleted)
    if (this._status === 'deleted') {
      return false;
    }

    return true;
  }

  /**
   * Check if user can edit this chat
   */
  canUserEdit(userId: UserId): boolean {
    // Only the chat creator can edit
    return this._createdBy.equals(userId);
  }

  /**
   * Check if user can send messages to this chat
   */
  canUserMessage(userId: UserId, userOrganizationId: OrganizationId): boolean {
    // Must have access and chat must be active
    return this.canUserAccess(userId, userOrganizationId) && this._status === 'active';
  }

  // Factory methods - entity only created from persistence with real ID
  static fromPersistence(data: {
    id: string;
    organizationId: number;
    createdBy: string;
    title: string;
    description?: string;
    model?: string;
    contextMetadata?: ChatContextMetadata;
    status: ChatStatus;
    messageCount: number;
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }): Chat {
    return new Chat(
      ChatId.fromString(data.id),
      OrganizationId.fromNumber(data.organizationId),
      UserId.fromString(data.createdBy),
      data.title,
      data.description,
      data.model,
      data.contextMetadata,
      data.status,
      data.messageCount,
      data.lastMessageAt,
      data.createdAt,
      data.updatedAt
    );
  }

  // Convert to plain object for persistence
  toPersistence(): {
    id: string;
    organizationId: number;
    createdBy: string;
    title: string;
    description?: string;
    model?: string;
    contextMetadata?: ChatContextMetadata;
    status: ChatStatus;
    messageCount: number;
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      createdBy: this._createdBy.value,
      title: this._title,
      description: this._description,
      model: this._model,
      contextMetadata: this._contextMetadata,
      status: this._status,
      messageCount: this._messageCount,
      lastMessageAt: this._lastMessageAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}

export interface CreateChatData {
  organizationId: OrganizationId;
  createdBy: UserId;
  title: string;
  description?: string;
  
  contextMetadata?: ChatContextMetadata;
}

export interface UpdateChatData {
  title?: string;
  description?: string;
  model?: string | null; // null to clear, undefined to keep unchanged
  contextMetadata?: ChatContextMetadata;
  status?: ChatStatus;
  lastMessageAt?: Date;
  messageCount?: number;
}

/**
 * Static utility methods for chat validation and context metadata creation
 */
export class ChatUtils {
  /**
   * Validate chat data before creation/update
   */
  static validateChatData(data: CreateChatData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.organizationId) {
      errors.push('Organization ID is required');
    }

    if (!data.createdBy) {
      errors.push('Created by user ID is required');
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Chat title is required');
    }

    if (data.title && data.title.length > 200) {
      errors.push('Chat title must be less than 200 characters');
    }

    if (data.description && data.description.length > 1000) {
      errors.push('Chat description must be less than 1000 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create context metadata for domain-connected chats
   */
  static createDomainContextMetadata(
    domainType: DomainType,
    domainId: number,
    domainName: string,
    additionalSchema?: any
  ): ChatContextMetadata {
    return {
      contextType: domainType,
      domainSchema: {
        id: domainId,
        name: domainName,
        ...additionalSchema
      }
    };
  }

  /**
   * Create default context metadata for organization-wide chats
   */
  static createOrganizationContextMetadata(): ChatContextMetadata {
    return {
      contextType: 'organizations'
    };
  }

  /**
   * Generate a context-aware title if not provided
   */
  static generateContextTitle(contextMetadata?: ChatContextMetadata): string {
    if (contextMetadata?.contextType && contextMetadata.domainSchema?.name) {
      const domainType = contextMetadata.contextType;
      const domainName = contextMetadata.domainSchema.name;
      
      switch (domainType) {
        case 'tables': return `Table Chat: ${domainName}`;
        case 'agents': return `Agent Chat: ${domainName}`;
        case 'files': return `File Chat: ${domainName}`;
        case 'teams': return `Team Chat: ${domainName}`;
      }
    }
    
    return `Organization Chat - ${new Date().toLocaleDateString()}`;
  }
}

// Export Chat as ChatEntity for backward compatibility
export { Chat as ChatEntity };
