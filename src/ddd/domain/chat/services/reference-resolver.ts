/**
 * Reference Resolver Domain Service Interface
 *
 * Domain service for resolving chat references across different data sources.
 * Interface lives in domain layer, implementation in infrastructure or application.
 *
 * AIDEV-NOTE: Domain service pattern for reference resolution logic.
 * Abstracts the complexity of searching across agents, tables, documents, files.
 */

import { OrganizationId } from '@/src/ddd/domain/shared/value-objects'
import { Reference } from '../value-objects/reference'
import { ReferenceCategory } from '../value-objects/reference-types'
import { ReferenceSearchContext } from '../value-objects/chat-context'

/**
 * Reference search options
 */
export interface ReferenceSearchOptions {
  query: string
  categories?: ReferenceCategory[]
  limit?: number
  offset?: number
  organizationId: OrganizationId
  domainType?: string
  domainId?: number
}

/**
 * Reference search result
 */
export interface ReferenceSearchResult {
  references: Reference[]
  hasMore: boolean
  totalCount: number
  searchContext: ReferenceSearchContext
}

/**
 * Reference resolution options
 */
export interface ReferenceResolutionOptions {
  includeMetadata?: boolean
  validateAccess?: boolean
  organizationId: OrganizationId
  userId?: string
}

/**
 * Resolved reference with additional metadata
 */
export interface ResolvedReference {
  reference: Reference
  exists: boolean
  accessible: boolean
  metadata?: {
    size?: number
    lastModified?: Date
    owner?: string
    [key: string]: any
  }
}

/**
 * Domain service interface for reference resolution operations
 */
export interface IReferenceResolverService {
  /**
   * Search for references across all categories
   */
  searchReferences(options: ReferenceSearchOptions): Promise<ReferenceSearchResult>

  /**
   * Search references within a specific category
   */
  searchByCategory(
    category: ReferenceCategory,
    query: string,
    organizationId: OrganizationId,
    limit?: number,
    offset?: number
  ): Promise<Reference[]>

  /**
   * Resolve a reference by its insert text (@doc:path, @agent:name, etc.)
   */
  resolveReference(
    insertText: string,
    options: ReferenceResolutionOptions
  ): Promise<ResolvedReference | null>

  /**
   * Resolve multiple references in batch
   */
  resolveReferences(
    insertTexts: string[],
    options: ReferenceResolutionOptions
  ): Promise<ResolvedReference[]>

  /**
   * Get recent references for quick access
   */
  getRecentReferences(
    organizationId: OrganizationId,
    userId?: string,
    limit?: number
  ): Promise<Reference[]>

  /**
   * Get popular/frequently used references
   */
  getPopularReferences(
    organizationId: OrganizationId,
    category?: ReferenceCategory,
    limit?: number
  ): Promise<Reference[]>

  /**
   * Validate that references exist and are accessible
   */
  validateReferences(
    references: Reference[],
    organizationId: OrganizationId,
    userId?: string
  ): Promise<{ reference: Reference; valid: boolean; reason?: string }[]>

  /**
   * Get suggestions based on partial input
   */
  getSuggestions(
    partialInput: string,
    organizationId: OrganizationId,
    limit?: number
  ): Promise<Reference[]>
}