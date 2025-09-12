'use server'

/**
 * Server Actions for Reference Search System
 * 
 * Clean interface between UI components and the ReferenceSearchApplicationService.
 * Handles authentication, permissions, and data formatting for chat reference system.
 * 
 * AIDEV-NOTE: This server action provides a clean boundary between UI state management 
 * (TanStack Store) and domain/application services. Keeps authentication and permission 
 * logic centralized while allowing the store to remain UI-focused.
 */

import { ReferenceSearchApplicationService } from '@/ddd/application/services/ui-support/reference-search-application-service'
import type { 
  ReferenceSearchOptions,
  ReferenceSearchResult 
} from '@/ddd/application/services/ui-support/reference-search-application-service'
import { requirePermission } from './permissions'

// Server action result wrapper for better error handling
interface ServerActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Search references across all domains
 * Used by the TanStack Store to fetch search results
 */
export async function searchReferences(
  query: string,
  emeryData: any, // From useEmery context
  options: ReferenceSearchOptions = {}
): Promise<ServerActionResult<ReferenceSearchResult>> {
  try {
    // Validate permissions first
    await requirePermission('data:manage')
    
    // Validate inputs
    if (!query || typeof query !== 'string') {
      return {
        success: false,
        error: 'Query is required and must be a string'
      }
    }

    if (query.trim().length === 0) {
      return {
        success: true,
        data: {
          results: [],
          totalCount: 0,
          searchTime: 0,
          query: query.trim()
        }
      }
    }

    // Create service instance
    const searchService = new ReferenceSearchApplicationService()
    
    // Execute search
    const result = await searchService.searchReferences(query, emeryData, options)
    
    return {
      success: true,
      data: result
    }
    
  } catch (error) {
    console.error('Reference search server action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Get search suggestions based on query
 * Returns quick suggestions for auto-completion
 */
export async function getSearchSuggestions(
  query: string,
  emeryData: any,
  limit: number = 5
): Promise<ServerActionResult<string[]>> {
  try {
    await requirePermission('data:manage')
    
    if (!query || query.trim().length < 2) {
      return {
        success: true,
        data: []
      }
    }

    // Get limited results for suggestions
    const searchResult = await searchReferences(query, emeryData, { 
      limit, 
      categories: ['documents', 'agents', 'tables', 'tools'] 
    })
    
    if (!searchResult.success || !searchResult.data) {
      return {
        success: true,
        data: []
      }
    }
    
    // Extract unique display names for suggestions
    const suggestions = searchResult.data.results
      .map(result => result.displayName)
      .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
      .slice(0, limit)
    
    return {
      success: true,
      data: suggestions
    }
    
  } catch (error) {
    console.error('Search suggestions failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Validate reference format and check availability
 * Used for real-time validation in the UI
 */
export async function validateReference(
  referenceText: string,
  emeryData: any
): Promise<ServerActionResult<{ valid: boolean; suggestion?: string }>> {
  try {
    await requirePermission('data:manage')
    
    // Extract reference pattern (e.g., "@doc:filename", "@table:name")
    const referencePattern = /^@(doc|document|table|agent|tool|team|setting):(.+)$/i
    const match = referenceText.match(referencePattern)
    
    if (!match) {
      return {
        success: true,
        data: { valid: false }
      }
    }
    
    const [, category, name] = match
    
    // Search for exact or close matches
    const searchResult = await searchReferences(name, emeryData, {
      limit: 1,
      categories: [category === 'doc' || category === 'document' ? 'documents' : category as any]
    })
    
    if (!searchResult.success || !searchResult.data) {
      return {
        success: true,
        data: { valid: false }
      }
    }
    
    const hasExactMatch = searchResult.data.results.length > 0
    const suggestion = hasExactMatch ? searchResult.data.results[0].insertText : undefined
    
    return {
      success: true,
      data: {
        valid: hasExactMatch,
        suggestion
      }
    }
    
  } catch (error) {
    console.error('Reference validation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}