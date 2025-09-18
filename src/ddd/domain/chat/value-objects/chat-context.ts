/**
 * Chat Context Value Objects
 *
 * Value objects for chat-specific context and metadata.
 * Represents the context and state of chat conversations.
 *
 * AIDEV-NOTE: Chat domain-specific context objects that are separate
 * from general application context. Provides type safety for chat operations.
 */

import { OrganizationId } from '@/src/ddd/domain/shared/value-objects'
import { ReferenceCategory } from './reference-types'

/**
 * Chat conversation context
 */
export class ChatContext {
  constructor(
    public readonly organizationId: OrganizationId,
    public readonly domainType?: string,
    public readonly domainId?: number,
    public readonly userId?: string,
    public readonly sessionId?: string
  ) {
    if (!organizationId) {
      throw new Error('Organization ID is required for chat context')
    }
  }

  /**
   * Create a general chat context
   */
  static general(organizationId: OrganizationId, userId?: string): ChatContext {
    return new ChatContext(organizationId, 'general', undefined, userId)
  }

  /**
   * Create a table-specific chat context
   */
  static table(organizationId: OrganizationId, tableId: number, userId?: string): ChatContext {
    return new ChatContext(organizationId, 'table', tableId, userId)
  }

  /**
   * Create an agent-specific chat context
   */
  static agent(organizationId: OrganizationId, agentId: number, userId?: string): ChatContext {
    return new ChatContext(organizationId, 'agent', agentId, userId)
  }

  /**
   * Create a database-specific chat context
   */
  static database(organizationId: OrganizationId, databaseId: number, userId?: string): ChatContext {
    return new ChatContext(organizationId, 'database', databaseId, userId)
  }

  /**
   * Check if this is a general chat context
   */
  get isGeneral(): boolean {
    return this.domainType === 'general' || !this.domainType
  }

  /**
   * Check if this is a domain-specific context
   */
  get isDomainSpecific(): boolean {
    return !this.isGeneral && !!this.domainType && this.domainId !== undefined
  }

  /**
   * Get the context identifier for logging/debugging
   */
  get contextId(): string {
    if (this.isGeneral) {
      return `general:${this.organizationId.value}`
    }
    return `${this.domainType}:${this.domainId}:${this.organizationId.value}`
  }

  /**
   * Create a copy with updated session ID
   */
  withSessionId(sessionId: string): ChatContext {
    return new ChatContext(
      this.organizationId,
      this.domainType,
      this.domainId,
      this.userId,
      sessionId
    )
  }
}

/**
 * Reference search context for filtering and scoping
 */
export class ReferenceSearchContext {
  constructor(
    public readonly organizationId: OrganizationId,
    public readonly categories?: ReferenceCategory[],
    public readonly domainType?: string,
    public readonly domainId?: number,
    public readonly limit: number = 20,
    public readonly offset: number = 0
  ) {
    if (!organizationId) {
      throw new Error('Organization ID is required for reference search context')
    }
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100')
    }
    if (offset < 0) {
      throw new Error('Offset must be non-negative')
    }
  }

  /**
   * Create a search context for all categories
   */
  static all(organizationId: OrganizationId, limit?: number, offset?: number): ReferenceSearchContext {
    return new ReferenceSearchContext(organizationId, undefined, undefined, undefined, limit, offset)
  }

  /**
   * Create a search context for specific categories
   */
  static categories(
    organizationId: OrganizationId,
    categories: ReferenceCategory[],
    limit?: number,
    offset?: number
  ): ReferenceSearchContext {
    return new ReferenceSearchContext(organizationId, categories, undefined, undefined, limit, offset)
  }

  /**
   * Create a search context scoped to a domain
   */
  static domain(
    organizationId: OrganizationId,
    domainType: string,
    domainId: number,
    categories?: ReferenceCategory[],
    limit?: number,
    offset?: number
  ): ReferenceSearchContext {
    return new ReferenceSearchContext(organizationId, categories, domainType, domainId, limit, offset)
  }

  /**
   * Check if search is scoped to specific categories
   */
  get hasCategoryFilter(): boolean {
    return !!(this.categories && this.categories.length > 0)
  }

  /**
   * Check if search is scoped to a domain
   */
  get hasDomainScope(): boolean {
    return !!(this.domainType && this.domainId !== undefined)
  }

  /**
   * Create a copy with updated pagination
   */
  withPagination(limit: number, offset: number): ReferenceSearchContext {
    return new ReferenceSearchContext(
      this.organizationId,
      this.categories,
      this.domainType,
      this.domainId,
      limit,
      offset
    )
  }

  /**
   * Create a copy with additional categories
   */
  withCategories(categories: ReferenceCategory[]): ReferenceSearchContext {
    return new ReferenceSearchContext(
      this.organizationId,
      categories,
      this.domainType,
      this.domainId,
      this.limit,
      this.offset
    )
  }
}