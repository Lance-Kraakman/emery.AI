'use server'

/**
 * Tool Search Server Actions
 *
 * Provides tool discovery using proper DDD architecture.
 * Returns standard DTOs for frontend consumption.
 *
 * AIDEV-NOTE: Replaces the anti-pattern unified-tool-registry.ts
 * Uses proper domain services and application services following DDD patterns.
 */

import { requireAuth } from "./permissions";
import type { Result } from "./types";
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { ToolMapper, type ToolDTO, type ToolSearchResultDTO } from '@/app/mappers/tool-mapper';
import { ReferenceToolMapper } from '@/app/mappers/reference-tool-mapper';
import { getToolSearchApplicationService } from '@/ddd/application/di/container';
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';

/**
 * Search all tools (both reference and system tools)
 */
export async function searchAllTools(options: {
  query: string;
  categories?: string[]; // Reference category names to filter by (documents, files, agents, etc.)
  toolCategories?: string[]; // Tool category names to filter by (apps, utilities, etc.)
  appId?: string; // Filter by specific app (e.g., "gmail", "slack")
  connectedOnly?: boolean; // Only show tools with active connections
  requiresConnection?: boolean; // Only show tools that require connections
  limit?: number;
  offset?: number;
}): Promise<Result<ToolSearchResultDTO>> {
  try {
    const session = await requireAuth();

    const { query, categories, toolCategories, appId, connectedOnly, requiresConnection, limit = 20, offset = 0 } = options;

    console.log(`[ToolActions] Searching all tools with query: "${query}"`);

    // Get the tool search application service from DI container
    const toolSearchService = getToolSearchApplicationService();

    // Convert string arrays to proper enums
    const referenceCategories = categories?.map(cat => cat as ReferenceCategory);
    const toolCategoryEnums = toolCategories?.map(cat => cat as ToolCategory);

    // Search using application service
    const searchResult = await toolSearchService.searchAllTools({
      query,
      categories: referenceCategories,
      toolCategories: toolCategoryEnums,
      appId,
      connectedOnly,
      requiresConnection,
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId),
      userId: UserId.fromString(session.user.id),
      limit,
      offset
    });

    // Convert domain objects to unified ToolDTO array
    const referenceToolDTOs = ReferenceToolMapper.toDTOs(searchResult.referenceTools);
    const systemToolDTOs = ToolMapper.toDTOs(searchResult.systemTools);

    // Combine into single unified array
    const allTools: ToolDTO[] = [...referenceToolDTOs, ...systemToolDTOs];

    const resultDTO: ToolSearchResultDTO = {
      tools: allTools,
      hasMore: searchResult.hasMore,
      totalCount: searchResult.totalCount
    };

    console.log(`[ToolActions] Found ${referenceToolDTOs.length} reference tools, ${systemToolDTOs.length} system tools, ${allTools.length} total tools`);

    return {
      success: true,
      data: resultDTO
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error searching tools:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search tools'
    };
  }
}

/**
 * Search only system tools (execution tools like python_repl, web_search, etc.)
 */
export async function searchSystemTools(query: string, limit = 20): Promise<Result<ToolDTO[]>> {
  try {
    await requireAuth();

    console.log(`[ToolActions] === STARTING SYSTEM TOOL SEARCH ===`);
    console.log(`[ToolActions] Query: "${query}"`);
    console.log(`[ToolActions] Limit: ${limit}`);

    // Get a dummy organization ID (system tools aren't org-specific)
    const dummyOrgId = OrganizationId.fromNumber(1);

    // Get the tool search application service from DI container
    console.log(`[ToolActions] Getting ToolSearchApplicationService from DI container...`);
    const toolSearchService = getToolSearchApplicationService();
    console.log(`[ToolActions] Got ToolSearchApplicationService:`, !!toolSearchService);

    // Search using application service
    console.log(`[ToolActions] Calling searchAllTools with options:`, {
      query,
      organizationId: dummyOrgId.value,
      limit
    });

    const searchResult = await toolSearchService.searchAllTools({
      query,
      organizationId: dummyOrgId,
      limit
    });

    console.log(`[ToolActions] Search result received:`, {
      referenceToolsCount: searchResult.referenceTools.length,
      systemToolsCount: searchResult.systemTools.length,
      hasMore: searchResult.hasMore,
      totalCount: searchResult.totalCount
    });

    // Convert only system tools to DTOs
    console.log(`[ToolActions] Converting ${searchResult.systemTools.length} system tools to DTOs...`);
    const systemToolDTOs = searchResult.systemTools.map((tool, index) => {
      try {
        console.log(`[ToolActions] Converting tool ${index + 1}:`, tool.getName());
        const dto = ToolMapper.toDTO(tool);
        console.log(`[ToolActions] Tool DTO created:`, dto.name);
        return dto;
      } catch (error) {
        console.error(`[ToolActions] Error converting tool ${index + 1}:`, error);
        throw error;
      }
    });

    console.log(`[ToolActions] Successfully converted ${systemToolDTOs.length} system tools to DTOs`);
    console.log(`[ToolActions] === SYSTEM TOOL SEARCH COMPLETE ===`);

    return {
      success: true,
      data: systemToolDTOs
    };
  } catch (error: unknown) {
    console.error('[ToolActions] === SYSTEM TOOL SEARCH FAILED ===');
    console.error('[ToolActions] Error searching system tools:', error);
    console.error('[ToolActions] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search system tools'
    };
  }
}

/**
 * Get tool by ID
 */
export async function getToolById(toolId: string): Promise<Result<ToolDTO | null>> {
  try {
    await requireAuth();

    console.log(`[ToolActions] Getting tool: ${toolId}`);

    // Use the tool search application service for single tool lookup
    const toolSearchService = getToolSearchApplicationService();

    // Search for the specific tool by name
    const searchResult = await toolSearchService.searchAllTools({
      query: toolId,
      organizationId: OrganizationId.fromNumber(1), // Default org for system tools
      limit: 1
    });

    // Look for exact match in system tools
    const tool = searchResult.systemTools.find(t => t.toolMetadata.name === toolId);

    if (!tool) {
      return {
        success: true,
        data: null
      };
    }

    // Convert to DTO
    const toolDTO = ToolMapper.toDTO(tool);

    return {
      success: true,
      data: toolDTO
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting tool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tool'
    };
  }
}

/**
 * Get available tool categories
 */
export async function getToolCategories(): Promise<Result<string[]>> {
  try {
    await requireAuth();

    console.log(`[ToolActions] Getting available tool categories`);

    // Get categories from the ToolCategory enum
    const { ToolCategory } = await import('@/ddd/domain/tools/value-objects/tool-metadata');
    const categories = Object.values(ToolCategory);

    console.log(`[ToolActions] Found ${categories.length} categories`);

    return {
      success: true,
      data: categories
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting categories:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get categories'
    };
  }
}