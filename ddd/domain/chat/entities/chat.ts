/**
 * Chat Domain Entity
 * 
 * Represents a chat session connected to any domain type (tables, agents, files, teams, etc.).
 * Manages chat metadata, RAG context, and domain-specific functionality.
 * 
 * AIDEV-NOTE: Domain entity for chat sessions - contains business rules for
 * domain-connected chats with dual-context RAG integration and organizational scoping
 */

export type DomainType = 'table' | 'agent' | 'file' | 'team' | 'workflow';

export interface ChatContextMetadata {
  ragIndexId?: string;
  contextType?: DomainType | 'organization' | 'mixed';
  domainSchema?: any; // Schema/config for connected domain
  primaryRagWeight?: number; // Weight for primary domain context (0.0-1.0)
  lastRagUpdate?: string;
}

export interface Chat {
  id: string;
  organizationId: number;
  createdBy: string;
  
  // Domain connections - flexible connections to any domain type
  domainType?: DomainType | null; // Type of connected domain
  domainId?: number | null; // ID of connected domain entity
  tableId?: number | null; // Legacy table connection (for compatibility)
  
  // Chat metadata
  title: string;
  description?: string;
  
  // RAG and AI context
  contextMetadata?: ChatContextMetadata;
  
  // Status and lifecycle
  status: 'active' | 'archived' | 'deleted';
  messageCount: number;
  lastMessageAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChatData {
  organizationId: number;
  createdBy: string;
  title: string;
  description?: string;
  
  // Domain connections
  domainType?: DomainType;
  domainId?: number;
  tableId?: number; // Legacy compatibility
  
  contextMetadata?: ChatContextMetadata;
}

export interface UpdateChatData {
  title?: string;
  description?: string;
  contextMetadata?: ChatContextMetadata;
  status?: 'active' | 'archived' | 'deleted';
  lastMessageAt?: Date;
  messageCount?: number;
}

/**
 * Chat business rules and validation
 */
export class ChatEntity {
  constructor(private readonly chat: Chat) {}

  get id(): string {
    return this.chat.id;
  }

  get organizationId(): number {
    return this.chat.organizationId;
  }

  get domainType(): DomainType | null {
    return this.chat.domainType || null;
  }

  get domainId(): number | null {
    return this.chat.domainId || null;
  }

  get tableId(): number | null {
    return this.chat.tableId ?? null;
  }

  get title(): string {
    return this.chat.title;
  }

  get status(): string {
    return this.chat.status;
  }

  get messageCount(): number {
    return this.chat.messageCount;
  }

  get isConnectedToDomain(): boolean {
    return this.chat.domainType !== null && this.chat.domainId !== null;
  }

  get isConnectedToTable(): boolean {
    return this.chat.tableId !== null || (this.chat.domainType === 'table' && this.chat.domainId !== null);
  }

  get isActive(): boolean {
    return this.chat.status === 'active';
  }

  get contextType(): string {
    return this.chat.contextMetadata?.contextType || (this.chat.domainType || 'organization');
  }

  get primaryRagWeight(): number {
    return this.chat.contextMetadata?.primaryRagWeight || 0.7;
  }

  /**
   * Check if user can access this chat
   */
  canUserAccess(userId: string, userOrganizationId: number): boolean {
    // User must be in same organization
    if (userOrganizationId !== this.chat.organizationId) {
      return false;
    }

    // Chat must be active (not deleted)
    if (this.chat.status === 'deleted') {
      return false;
    }

    return true;
  }

  /**
   * Check if user can edit this chat
   */
  canUserEdit(userId: string): boolean {
    // Only the chat creator can edit
    return this.chat.createdBy === userId;
  }

  /**
   * Check if user can send messages to this chat
   */
  canUserMessage(userId: string, userOrganizationId: number): boolean {
    // Must have access and chat must be active
    return this.canUserAccess(userId, userOrganizationId) && this.chat.status === 'active';
  }

  /**
   * Update the message count when a new message is added
   */
  incrementMessageCount(): void {
    this.chat.messageCount += 1;
    this.chat.lastMessageAt = new Date();
    this.chat.updatedAt = new Date();
  }

  /**
   * Generate a context-aware title if not provided
   */
  static generateContextTitle(domainType?: DomainType | null, domainName?: string, tableId?: number, tableName?: string): string {
    // New domain-based titles
    if (domainType && domainName) {
      switch (domainType) {
        case 'table': return `Table Chat: ${domainName}`;
        case 'agent': return `Agent Chat: ${domainName}`;
        case 'file': return `File Chat: ${domainName}`;
        case 'team': return `Team Chat: ${domainName}`;
        case 'workflow': return `Workflow Chat: ${domainName}`;
      }
    }
    
    // Legacy table support
    if (tableId && tableName) {
      return `Table Chat: ${tableName}`;
    }
    
    return `Organization Chat - ${new Date().toLocaleDateString()}`;
  }

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
  static createDomainContextMetadata(domainType: DomainType, domainSchema?: any, primaryWeight: number = 0.7): ChatContextMetadata {
    return {
      contextType: domainType,
      domainSchema,
      primaryRagWeight: primaryWeight,
      lastRagUpdate: new Date().toISOString()
    };
  }

  /**
   * Create default context metadata for table-connected chats (legacy support)
   */
  static createTableContextMetadata(tableId: number, tableSchema?: any): ChatContextMetadata {
    return {
      contextType: 'table',
      domainSchema: tableSchema,
      primaryRagWeight: 0.7,
      lastRagUpdate: new Date().toISOString()
    };
  }

  /**
   * Create default context metadata for organization-wide chats
   */
  static createOrganizationContextMetadata(ragIndexId?: string): ChatContextMetadata {
    return {
      contextType: 'organization',
      ragIndexId,
      lastRagUpdate: new Date().toISOString()
    };
  }

  /**
   * Convert to plain object for API responses
   */
  toJSON(): Chat {
    return { ...this.chat };
  }
}