'use server'

// AIDEV-NOTE: Reference Server Actions - DDD-based actions for reference search and management
// Integrates with chat domain services for proper reference resolution

import { requireAuth } from "./permissions";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import { getToolSearchApplicationService } from "@/ddd/application/di/container";
import { ReferenceMapper, type ReferenceDTO, type ReferencePanelStateDTO } from "@/app/mappers/reference-mapper";
import { ToolMapper, type ToolSearchResultDTO } from "@/app/mappers/tool-mapper";
import { ReferenceToolMapper, type ReferenceToolDTO } from "@/app/mappers/reference-tool-mapper";
import { ReferenceCategory } from "@/ddd/domain/chat/value-objects/reference-types";
import type { ReferenceTool } from "@/ddd/domain/tools/entities/reference-tool";
import type { Result } from "./types";

/**
 * Complete tool search that returns both reference tools and system tools
 * @deprecated Use searchAllTools from @/app/actions/tools instead
 */
export async function searchAllTools(options: {
  query: string;
  categories?: ReferenceCategory[];
  limit?: number;
  offset?: number;
}): Promise<Result<ToolSearchResultDTO>> {
  try {
    const session = await requireAuth();
    const toolSearchService = getToolSearchApplicationService();

    const { query, categories, limit = 20, offset = 0 } = options;

    console.log(`[ReferenceActions] Searching all tools for query: "${query}", categories:`, categories);

    // Use the new searchAllTools method that properly separates tool types
    const searchResult = await toolSearchService.searchAllTools({
      query,
      categories,
      limit,
      offset,
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId)
    });

    console.log(`[ReferenceActions] Search result:`, {
      referenceToolsFound: searchResult.referenceTools.length,
      systemToolsFound: searchResult.systemTools.length,
      totalCount: searchResult.totalCount,
      hasMore: searchResult.hasMore
    });

    // Map to unified ToolDTO array
    const referenceToolDTOs = ReferenceToolMapper.toDTOs(searchResult.referenceTools);
    const systemToolDTOs = ToolMapper.toDTOs(searchResult.systemTools);
    const allTools = [...referenceToolDTOs, ...systemToolDTOs];

    return {
      success: true,
      data: {
        tools: allTools,
        hasMore: searchResult.hasMore,
        totalCount: searchResult.totalCount
      }
    };
  } catch (error) {
    console.error('[ReferenceActions] Error searching all tools:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search tools',
      data: {
        tools: [],
        hasMore: false,
        totalCount: 0
      }
    };
  }
}

/**
 * Search reference tools only (agents, docs, files, tables, databases)
 * @deprecated This function returns old ReferenceToolDTO format - use searchAllTools from tools.ts instead
 * Used by ToolDropdown.tsx
 */
export async function searchReferenceTools(options: {
  query: string;
  categories?: ReferenceCategory[];
  limit?: number;
  offset?: number;
}): Promise<Result<{
  referenceTools: ReferenceToolDTO[];
  hasMore: boolean;
  totalCount: number;
  query: string;
  isLoading: boolean;
}>> {
  try {
    const session = await requireAuth();
    const toolSearchService = getToolSearchApplicationService();

    const { query, categories, limit = 20, offset = 0 } = options;

    console.log(`[ReferenceActions] Searching reference tools for query: "${query}", categories:`, categories);

    // Use tool search service to search for ReferenceTool objects only
    const searchResult = await toolSearchService.searchReferenceTools({
      query,
      categories,
      limit,
      offset,
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId)
    });

    console.log(`[ReferenceActions] Search result:`, {
      toolsFound: searchResult.referenceTools.length,
      totalCount: searchResult.totalCount,
      hasMore: searchResult.hasMore
    });

    // Convert domain objects to legacy ReferenceToolDTO format for backward compatibility
    const referenceToolDTOs = searchResult.referenceTools.map(referenceTool =>
      mapReferenceToolToLegacyDTO(referenceTool)
    );

    return {
      success: true,
      data: {
        referenceTools: referenceToolDTOs,
        hasMore: searchResult.hasMore,
        totalCount: searchResult.totalCount,
        query: options.query,
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
 * Legacy mapping function for backward compatibility
 * @deprecated Use unified ToolDTO from ReferenceToolMapper instead
 */
function mapReferenceToolToLegacyDTO(referenceTool: ReferenceTool): ReferenceToolDTO {
  const displayInfo = referenceTool.getChatDisplayInfo()
  const toolMetadata = referenceTool.getToolDisplayInfo()

  return {
    toolName: referenceTool.toolConfig.name,
    toolVersion: '', // Empty version since ToolConfig no longer has version
    id: referenceTool.reference.id,
    insertText: displayInfo.insertText,
    displayName: displayInfo.displayName,
    description: displayInfo.description,
    category: displayInfo.category as ReferenceCategory,
    supportsArtifacts: displayInfo.supportsArtifacts,
    config: {
      organizationId: referenceTool.getOrganizationId()
    },
    metadata: {
      toolCategory: toolMetadata.category,
      requiresConnection: toolMetadata.requiresConnection,
      connectionType: referenceTool.toolConfig.connectionType
    }
  }
}

/**
 * Resolve specific references from chat message mentions
 * Used to populate ReferencesPanel with resolved reference data
 * Used by ReferencesPanel.tsx, EmeryChat.tsx, CustomChatInput.tsx
 */
export async function resolveReferences(referenceTexts: string[]): Promise<Result<ReferencePanelStateDTO>> {
  try {
    const session = await requireAuth();
    const toolSearchService = getToolSearchApplicationService();

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

        // Search for the specific reference using ToolSearchApplicationService
        const searchResult = await toolSearchService.searchReferenceTools({
          query: searchTerm,
          categories: [category],
          limit: 1,
          offset: 0,
          organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId)
        });

        // Add the first matching result
        if (searchResult.referenceTools.length > 0) {
          const referenceTool = searchResult.referenceTools[0];
          const referenceDTO = ReferenceMapper.toDTO({
            id: `ref-${referenceTool.getDataPointer()}`,
            insertText: referenceTool.reference.insertText,
            displayName: referenceTool.reference.displayName,
            description: referenceTool.reference.description,
            category: referenceTool.reference.category,
            referencePath: referenceTool.reference.insertText.substring(referenceTool.reference.insertText.indexOf(':') + 1),
            referencePrefix: referenceTool.reference.insertText.substring(0, referenceTool.reference.insertText.indexOf(':')),
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