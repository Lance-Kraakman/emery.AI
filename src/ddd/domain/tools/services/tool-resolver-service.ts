/**
 * Tool Resolver Service - Domain Service for Tool Resolution
 *
 * Centralizes tool resolution logic including categories, references, and routing.
 * Handles category determination, reference mapping, and CRUD tool routing.
 *
 * AIDEV-NOTE: Single source of truth for all tool resolution logic.
 * Renamed from CategoryService to better reflect its expanded responsibilities.
 */

import { ToolCategory } from '../value-objects/tool-metadata'
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types'

/**
 * Search category constants - single source of truth
 */
export const SEARCH_CATEGORIES = {
  AGENT: 'agent' as const,
  TABLE: 'table' as const,
  DATABASE: 'database' as const,
  DOC: 'doc' as const,
  FILE: 'file' as const
} as const

/**
 * Type-safe search category type
 */
export type SearchCategoryType = typeof SEARCH_CATEGORIES[keyof typeof SEARCH_CATEGORIES]

/**
 * Search handler types for internal routing
 */
export type SearchHandlerType = 'agent' | 'table' | 'database' | 'document'

/**
 * Reference mapping configuration for @-patterns to CRUD tools
 */
export interface ReferenceMapping {
  pattern: RegExp
  toolName: string
  parameterName: string
}

/**
 * Tool reference extracted from message
 */
export interface ToolReference {
  original: string     // "@doc:myfile.pdf"
  toolName: string     // "document_crud"
  parameter: string    // "document_id"
  value: string        // "myfile.pdf"
  method: string       // "read"
}

/**
 * Tool Resolver Service - Domain Service for centralized tool resolution
 */
export class ToolResolverService {
  /**
   * Database category string to ToolCategory mapping
   * Used by DatabaseToolRegistry.mapCategoryToToolCategory
   */
  private readonly databaseCategoryMap: Record<string, ToolCategory> = {
    // External tool categories
    'utility': ToolCategory.UTILITIES,
    'communication': ToolCategory.APPS,
    'productivity': ToolCategory.APPS,
    'reference': ToolCategory.DOCUMENTS,
    'data': ToolCategory.TABLES,
    'crm': ToolCategory.APPS,
    'payments': ToolCategory.APPS,
    'ecommerce': ToolCategory.APPS,
    'marketing': ToolCategory.APPS,
    'social': ToolCategory.APPS,
    'ai': ToolCategory.UTILITIES,
    'system': ToolCategory.BASE,

    // CRUD tool categories
    'agents': ToolCategory.AGENTS,
    'documents': ToolCategory.DOCUMENTS,
    'files': ToolCategory.FILES,
    'tables': ToolCategory.TABLES,
    'teams': ToolCategory.ORGANIZATIONAL,
    'database': ToolCategory.DATABASES,
  }

  /**
   * Reference pattern mappings to CRUD tools
   * Maps @-patterns to new CRUD routing system
   * Updated from reference-mapper.ts to use document_crud instead of document_read
   */
  private readonly referenceMappings: ReferenceMapping[] = [
    {
      pattern: /@doc:([^@\s]+)/g,
      toolName: 'document_crud',
      parameterName: 'document_id'
    },
    {
      pattern: /@document:([^@\s]+)/g,
      toolName: 'document_crud',
      parameterName: 'document_id'
    },
    {
      pattern: /@table:([^@\s]+)/g,
      toolName: 'table_crud',
      parameterName: 'table_id'
    },
    {
      pattern: /@file:([^@\s]+)/g,
      toolName: 'file_crud',
      parameterName: 'file_id'
    },
    {
      pattern: /@agent:([^@\s]+)/g,
      toolName: 'agent_crud',
      parameterName: 'agent_id'
    },
    {
      pattern: /@database:([^@\s]+)/g,
      toolName: 'database_crud',
      parameterName: 'database_id'
    }
  ]

  /**
   * Map database category string to ToolCategory
   * Replaces DatabaseToolRegistry.mapCategoryToToolCategory
   */
  mapDatabaseCategoryToToolCategory(category: string): ToolCategory {
    return this.databaseCategoryMap[category.toLowerCase()] || ToolCategory.UTILITIES
  }

  /**
   * Get the appropriate search handler for a category
   * Maps search categories to internal handler types
   */
  getCategorySearchHandler(category: SearchCategoryType): SearchHandlerType {
    const mapping: Record<SearchCategoryType, SearchHandlerType> = {
      [SEARCH_CATEGORIES.AGENT]: 'agent',
      [SEARCH_CATEGORIES.TABLE]: 'table',
      [SEARCH_CATEGORIES.DATABASE]: 'database',
      [SEARCH_CATEGORIES.DOC]: 'document',
      [SEARCH_CATEGORIES.FILE]: 'document'
    }
    return mapping[category]
  }

  /**
   * Get all search categories as type-safe array
   */
  getAllSearchCategories(): SearchCategoryType[] {
    return Object.values(SEARCH_CATEGORIES)
  }

  /**
   * Determine which categories to search based on query pattern
   * Replaces tool-search-application-service.determineSearchCategories
   *
   * Simple logic:
   * - @agent:timmy → search only agents for "timmy"
   * - @timmy → search all categories for "timmy"
   * - @agent → search all categories for "agent"
   */
  determineSearchCategories(
    query: string,
    explicitCategories?: SearchCategoryType[]
  ): SearchCategoryType[] {
    if (explicitCategories) {
      return explicitCategories
    }

    const cleanQuery = query.trim().toLowerCase()

    // Handle explicit prefixes ONLY
    if (cleanQuery.startsWith('@doc:') || cleanQuery.startsWith('@file:')) {
      return [SEARCH_CATEGORIES.DOC, SEARCH_CATEGORIES.FILE]
    } else if (cleanQuery.startsWith('@agent:')) {
      return [SEARCH_CATEGORIES.AGENT]
    } else if (cleanQuery.startsWith('@table:')) {
      return [SEARCH_CATEGORIES.TABLE]
    } else if (cleanQuery.startsWith('@database:')) {
      return [SEARCH_CATEGORIES.DATABASE]
    } else if (cleanQuery === '@' || cleanQuery === '') {
      // Show all categories when just @ or empty
      return this.getAllSearchCategories()
    }

    // Everything else → search all categories (FIXED: includes table and database)
    return this.getAllSearchCategories()
  }

  // ===== REFERENCE MAPPING METHODS =====
  // Replaces functionality from reference-mapper.ts

  /**
   * Extract tool references from a message
   * Replaces extractToolReferences from reference-mapper.ts
   */
  extractToolReferences(message: string): ToolReference[] {
    const references: ToolReference[] = []

    for (const mapping of this.referenceMappings) {
      const matches = message.matchAll(mapping.pattern)

      for (const match of matches) {
        references.push({
          original: match[0],
          toolName: mapping.toolName,
          parameter: mapping.parameterName,
          value: match[1],
          method: 'read' // Default to read operation for @-references
        })
      }
    }

    return references
  }

  /**
   * Convert message with @ references to use proper tool calls
   * Replaces mapReferencesToTools from reference-mapper.ts
   */
  mapReferencesToTools(message: string): {
    mappedMessage: string
    toolReferences: ToolReference[]
  } {
    const toolReferences = this.extractToolReferences(message)
    let mappedMessage = message

    // Replace each reference with tool call syntax
    for (const ref of toolReferences) {
      const toolCall = `@tool:${ref.toolName}`
      mappedMessage = mappedMessage.replace(ref.original, toolCall)
    }

    return {
      mappedMessage,
      toolReferences
    }
  }

  /**
   * Check if a tool supports a specific reference prefix
   * Replaces getToolForReference from reference-mapper.ts
   */
  getToolForReference(prefix: string): string | null {
    const mapping = this.referenceMappings.find(m => {
      // Convert regex pattern to check if it matches the prefix
      const prefixPattern = m.pattern.source.split('(')[0] // Get part before capture group
      return prefixPattern.includes(prefix)
    })

    return mapping?.toolName || null
  }

  /**
   * Get all supported reference prefixes
   * Replaces getSupportedPrefixes from reference-mapper.ts
   */
  getSupportedPrefixes(): string[] {
    return this.referenceMappings.map(m => {
      // Extract prefix from regex pattern like /@doc:/ -> "@doc:"
      const match = m.pattern.source.match(/@[^:]+:/)
      return match ? match[0] : ''
    }).filter(Boolean)
  }

  /**
   * Parse reference text to extract category and search term
   * Replaces parseReferenceText from references.ts
   */
  parseReferenceText(refText: string): { category: ReferenceCategory | null; searchTerm: string } {
    const text = refText.trim()

    if (text.startsWith('@doc:')) {
      return { category: ReferenceCategory.DOC, searchTerm: text.substring(5) }
    }
    if (text.startsWith('@file:')) {
      return { category: ReferenceCategory.FILE, searchTerm: text.substring(6) }
    }
    if (text.startsWith('@agent:')) {
      return { category: ReferenceCategory.AGENT, searchTerm: text.substring(7) }
    }
    if (text.startsWith('@table:')) {
      return { category: ReferenceCategory.TABLE, searchTerm: text.substring(7) }
    }
    if (text.startsWith('@database:')) {
      return { category: ReferenceCategory.DATABASE, searchTerm: text.substring(10) }
    }

    return { category: null, searchTerm: text }
  }
}

/**
 * Singleton instance of ToolResolverService
 */
export const toolResolverService = new ToolResolverService()