'use server'

// AIDEV-NOTE: Reference Server Actions - DDD-based actions for reference search and management
// Integrates with chat domain services for proper reference resolution

import { requireAuth } from "./permissions";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import { getReferenceApplicationService } from "@/ddd/application/di/container";
import { ReferenceMapper, type ReferenceDTO, type ReferenceSearchResultDTO, type ReferencePanelStateDTO } from "@/app/mappers/reference-mapper";
import { ReferenceCategory } from "@/ddd/domain/chat/value-objects/reference-types";
import type { ReferenceTool } from "@/ddd/domain/tools/entities/reference-tool";
import type { Result } from "./types";

/**
 * Enhanced search that returns ReferenceTool objects with proper typing
 * Used by new tool-based chat system
 */
export async function searchReferenceTools(options: {
  query: string;
  categories?: ReferenceCategory[];
  limit?: number;
  offset?: number;
}): Promise<Result<{
  referenceTools: ReferenceTool[];
  hasMore: boolean;
  totalCount: number;
  query: string;
  isLoading: boolean;
}>> {
  try {
    const session = await requireAuth();
    const referenceService = getReferenceApplicationService();

    const { query, categories, limit = 20, offset = 0 } = options;

    console.log(`[ReferenceActions] Searching reference tools for query: "${query}"`);

    // Use enhanced domain service to search for ReferenceTool objects
    const searchResult = await referenceService.searchReferenceTools({
      query,
      categories,
      limit,
      offset,
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId)
    });

    console.log(`[ReferenceActions] Found ${searchResult.referenceTools.length} reference tools (${searchResult.totalCount} total)`);

    return {
      success: true,
      data: {
        referenceTools: searchResult.referenceTools,
        hasMore: searchResult.hasMore,
        totalCount: searchResult.totalCount,
        query: query,
        isLoading: false
      }
    };
  } catch (error: unknown) {
    console.error('[ReferenceActions] Error searching reference tools:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage.includes('Authentication required')
        ? 'Authentication required'
        : 'Failed to search reference tools'
    };
  }
}

/**
 * Legacy search references across all categories (documents, files, agents, tables, databases)
 * @deprecated Use searchReferenceTools() instead for proper tool integration
 */
export async function searchReferences(options: {
  query: string;
  categories?: ReferenceCategory[];
  limit?: number;
  offset?: number;
}): Promise<Result<ReferenceSearchResultDTO>> {
  try {
    const session = await requireAuth();
    const referenceService = getReferenceApplicationService();

    const { query, categories, limit = 20, offset = 0 } = options;

    console.log(`[ReferenceActions] Searching references for query: "${query}"`);

    // Use domain service to search across all categories
    const searchResult = await referenceService.searchReferences({
      query,
      categories,
      limit,
      offset,
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId)
    });

    // Convert domain results to DTOs using proper mapper
    const referenceDTOs = searchResult.references.map(simpleRef =>
      ReferenceMapper.toDTO({
        id: simpleRef.id,
        insertText: simpleRef.insertText,
        displayName: simpleRef.displayName,
        description: simpleRef.description,
        category: simpleRef.category as ReferenceCategory,
        referencePath: simpleRef.insertText.substring(simpleRef.insertText.indexOf(':') + 1),
        referencePrefix: simpleRef.insertText.substring(0, simpleRef.insertText.indexOf(':')),
        equals: () => false,
        matchesSearch: () => false,
        toPlain: () => ({} as any)
      } as any)
    );

    console.log(`[ReferenceActions] Found ${referenceDTOs.length} references (${searchResult.totalCount} total)`);

    return {
      success: true,
      data: {
        references: referenceDTOs,
        hasMore: searchResult.hasMore,
        totalCount: searchResult.totalCount,
        query: query,
        isLoading: false
      }
    };
  } catch (error: unknown) {
    console.error('[ReferenceActions] Error searching references:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage.includes('Authentication required')
        ? 'Authentication required'
        : 'Failed to search references'
    };
  }
}

/**
 * Get references by specific category (for category-specific views)
 */
export async function getReferencesByCategory(
  category: ReferenceCategory,
  searchQuery?: string,
  limit = 50
): Promise<Result<ReferenceDTO[]>> {
  try {
    const session = await requireAuth();

    console.log(`[ReferenceActions] Getting ${category} references with query: "${searchQuery || 'none'}"`);

    const searchResult = await searchReferences({
      query: searchQuery || '',
      categories: [category],
      limit,
      offset: 0
    });

    if (!searchResult.success) {
      return { success: false, error: searchResult.error };
    }

    return {
      success: true,
      data: searchResult.data?.references || []
    };
  } catch (error: unknown) {
    console.error(`[ReferenceActions] Error getting ${category} references:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get references'
    };
  }
}

/**
 * Resolve specific references from chat message mentions
 * Used to populate ReferencesPanel with resolved reference data
 */
export async function resolveReferences(referenceTexts: string[]): Promise<Result<ReferencePanelStateDTO>> {
  try {
    const session = await requireAuth();
    const referenceService = getReferenceApplicationService();

    console.log(`[ReferenceActions] Resolving ${referenceTexts.length} references:`, referenceTexts);

    const resolvedReferences: ReferenceDTO[] = [];

    // Resolve each reference text
    for (const refText of referenceTexts) {
      try {
        // Extract category and search term from reference text
        const { category, searchTerm } = parseReferenceText(refText);

        if (!category || !searchTerm) {
          console.warn(`[ReferenceActions] Could not parse reference: ${refText}`);
          continue;
        }

        // Search for the specific reference
        const searchResult = await referenceService.searchReferences({
          query: searchTerm,
          categories: [category],
          limit: 1,
          offset: 0,
          organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId)
        });

        // Add the first matching result
        if (searchResult.references.length > 0) {
          const simpleRef = searchResult.references[0];
          const referenceDTO = ReferenceMapper.toDTO({
            id: simpleRef.id,
            insertText: simpleRef.insertText,
            displayName: simpleRef.displayName,
            description: simpleRef.description,
            category: simpleRef.category as ReferenceCategory,
            referencePath: simpleRef.insertText.substring(simpleRef.insertText.indexOf(':') + 1),
            referencePrefix: simpleRef.insertText.substring(0, simpleRef.insertText.indexOf(':')),
            equals: () => false,
            matchesSearch: () => false,
            toPlain: () => ({} as any)
          } as any);

          resolvedReferences.push(referenceDTO);
        } else {
          // Add unresolved reference with error
          resolvedReferences.push({
            id: `unresolved-${Math.random()}`,
            insertText: refText,
            displayName: `${refText} (not found)`,
            description: 'Reference could not be resolved',
            category: category,
            referencePath: searchTerm,
            referencePrefix: `@${category}`,
            canOpenArtifact: false,
            metadata: {
              error: 'Reference not found'
            }
          });
        }
      } catch (error) {
        console.error(`[ReferenceActions] Error resolving reference ${refText}:`, error);
        // Add error reference
        resolvedReferences.push({
          id: `error-${Math.random()}`,
          insertText: refText,
          displayName: `${refText} (error)`,
          description: 'Error resolving reference',
          category: ReferenceCategory.DOC, // Default category
          referencePath: refText,
          referencePrefix: '@error',
          canOpenArtifact: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    console.log(`[ReferenceActions] Resolved ${resolvedReferences.length} references`);

    return {
      success: true,
      data: {
        resolvedReferences,
        isLoading: false,
        isCollapsed: false
      }
    };
  } catch (error: unknown) {
    console.error('[ReferenceActions] Error resolving references:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve references'
    };
  }
}

/**
 * Get recent references (for quick access)
 */
export async function getRecentReferences(limit = 10): Promise<Result<ReferenceDTO[]>> {
  try {
    const session = await requireAuth();

    console.log(`[ReferenceActions] Getting ${limit} recent references`);

    // Search all categories with empty query to get recent/popular items
    const searchResult = await searchReferences({
      query: '',
      limit,
      offset: 0
    });

    if (!searchResult.success) {
      return { success: false, error: searchResult.error };
    }

    return {
      success: true,
      data: searchResult.data?.references || []
    };
  } catch (error: unknown) {
    console.error('[ReferenceActions] Error getting recent references:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recent references'
    };
  }
}

/**
 * Get reference suggestions based on current context (for auto-complete)
 */
export async function getReferenceSuggestions(
  partialText: string,
  context?: { tableId?: number; agentId?: number }
): Promise<Result<ReferenceDTO[]>> {
  try {
    const session = await requireAuth();

    console.log(`[ReferenceActions] Getting suggestions for: "${partialText}"`);

    // Determine categories based on partial text
    let categories: ReferenceCategory[] | undefined;
    let query = partialText;

    if (partialText.startsWith('@doc:')) {
      categories = [ReferenceCategory.DOC];
      query = partialText.substring(5);
    } else if (partialText.startsWith('@file:')) {
      categories = [ReferenceCategory.FILE];
      query = partialText.substring(6);
    } else if (partialText.startsWith('@agent:')) {
      categories = [ReferenceCategory.AGENT];
      query = partialText.substring(7);
    } else if (partialText.startsWith('@table:')) {
      categories = [ReferenceCategory.TABLE];
      query = partialText.substring(7);
    } else if (partialText.startsWith('@')) {
      query = partialText.substring(1);
    }

    const searchResult = await searchReferences({
      query,
      categories,
      limit: 8 // Smaller limit for suggestions
    });

    if (!searchResult.success) {
      return { success: false, error: searchResult.error };
    }

    return {
      success: true,
      data: searchResult.data?.references || []
    };
  } catch (error: unknown) {
    console.error('[ReferenceActions] Error getting suggestions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get suggestions'
    };
  }
}

/**
 * Parse reference text to extract category and search term
 */
function parseReferenceText(refText: string): { category: ReferenceCategory | null; searchTerm: string } {
  const text = refText.trim();

  if (text.startsWith('@doc:')) {
    return { category: ReferenceCategory.DOC, searchTerm: text.substring(5) };
  }
  if (text.startsWith('@file:')) {
    return { category: ReferenceCategory.FILE, searchTerm: text.substring(6) };
  }
  if (text.startsWith('@agent:')) {
    return { category: ReferenceCategory.AGENT, searchTerm: text.substring(7) };
  }
  if (text.startsWith('@table:')) {
    return { category: ReferenceCategory.TABLE, searchTerm: text.substring(7) };
  }
  if (text.startsWith('@database:')) {
    return { category: ReferenceCategory.DATABASE, searchTerm: text.substring(10) };
  }

  return { category: null, searchTerm: text };
}