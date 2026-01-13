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
import { db } from '@/ddd/infrastructure/db/client';
import { tools, appTypes, type OAuthToolDefinitionData } from '@/ddd/infrastructure/db/schema';
import { eq, sql, and } from 'drizzle-orm';

/**
 * Search all tools (both reference and system tools)
 */
export async function searchAllTools(options: {
  query: string;
  categories?: string[]; // Reference category names to filter by (agent, file, doc, table, database)
  toolCategories?: string[]; // Tool category names to filter by (apps, utilities, etc.)
  appIds?: string[]; // Filter by specific apps (e.g., ["gmail", "slack"]) - multi-select support
  connectedOnly?: boolean; // Only show tools with active connections
  requiresConnection?: boolean; // Only show tools that require connections
  showReferenceTools?: boolean; // Include reference tools (agents, tables, databases) in results
  limit?: number;
  offset?: number;
}): Promise<Result<ToolSearchResultDTO>> {
  try {
    const session = await requireAuth();

    const { query, categories, toolCategories, appIds, connectedOnly, requiresConnection, showReferenceTools = true, limit = 20, offset = 0 } = options;

    // Get the tool search application service from DI container
    const toolSearchService = getToolSearchApplicationService();

    // AIDEV-NOTE: Trust TypeScript types - if arrays are sent correctly, use them directly
    // Simple validation: only use if it's actually an array
    const referenceCategories = Array.isArray(categories)
      ? categories.map(cat => cat as ReferenceCategory)
      : undefined;

    const toolCategoryEnums = Array.isArray(toolCategories)
      ? toolCategories.map(cat => cat as ToolCategory)
      : undefined;

    console.log(`[ToolActions] Searching tools:`, {
      query,
      categories: referenceCategories,
      appIds,
      connectedOnly,
      requiresConnection,
      showReferenceTools,
      categoriesCount: referenceCategories?.length || 0,
      appIdsCount: appIds?.length || 0
    });

    // Search using application service
    const searchResult = await toolSearchService.searchAllTools({
      query,
      categories: referenceCategories,
      toolCategories: toolCategoryEnums,
      appIds,
      connectedOnly,
      requiresConnection,
      showReferenceTools,
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

// =============================================================================
// Pipedream Tool Metadata Types and Functions
// =============================================================================

export interface PipedreamToolInput {
  type: string;
  description: string;
  required: boolean;
}

export interface PipedreamToolMetadata {
  id: string;
  app: string;
  name: string;
  description: string;
  type: 'action' | 'mcp';
  inputs: Record<string, PipedreamToolInput>;
}

export interface PipedreamToolsGrouped {
  [appName: string]: PipedreamToolMetadata[];
}

/**
 * Get all Pipedream (OAuth) tools grouped by app from the database
 * AIDEV-NOTE: Queries tools table instead of reading from pipedream_metadata.json
 */
export async function getPipedreamTools(): Promise<Result<PipedreamToolsGrouped>> {
  try {
    await requireAuth();

    // Query tools with type='oauth' from DB (these are Pipedream tools)
    const oauthTools = await db.select({
      id: tools.id,
      displayName: tools.displayName,
      description: tools.description,
      appId: tools.appId,
      config: tools.config,
      appName: appTypes.name,
    })
      .from(tools)
      .innerJoin(appTypes, eq(tools.appId, appTypes.id))
      .where(sql`${tools.config}->>'type' = 'oauth'`);

    // Group tools by app
    const grouped: PipedreamToolsGrouped = {};

    for (const row of oauthTools) {
      const config = row.config as OAuthToolDefinitionData;
      const appName = row.appId; // Use appId as the grouping key (e.g., "slack", "gmail")

      // Convert DB row to PipedreamToolMetadata
      const toolMetadata: PipedreamToolMetadata = {
        id: row.id,
        app: appName,
        name: row.displayName,
        description: row.description || '',
        type: 'action', // OAuth tools are actions (not MCP)
        inputs: config.parameters ? Object.fromEntries(
          Object.entries(config.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description || '',
              required: param.required,
            }
          ])
        ) : {},
      };

      if (!grouped[appName]) {
        grouped[appName] = [];
      }
      grouped[appName].push(toolMetadata);
    }

    // Sort tools within each app by name
    for (const appName of Object.keys(grouped)) {
      grouped[appName].sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      success: true,
      data: grouped
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting Pipedream tools:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Pipedream tools'
    };
  }
}

/**
 * Search Pipedream tools with pagination - for performance with large tool sets
 * AIDEV-NOTE: Uses search on demand instead of loading all tools upfront
 */
export async function searchPipedreamTools(options: {
  query?: string;
  appId?: string;
  limit?: number;
  offset?: number;
}): Promise<Result<{ tools: PipedreamToolMetadata[]; hasMore: boolean; totalCount: number }>> {
  try {
    await requireAuth();

    const { query = '', appId, limit = 20, offset = 0 } = options;

    // Build WHERE conditions
    const conditions = [sql`${tools.config}->>'type' = 'oauth'`];

    if (appId) {
      conditions.push(eq(tools.appId, appId));
    }

    if (query.trim()) {
      const searchPattern = `%${query.toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(${tools.displayName}) LIKE ${searchPattern} OR LOWER(${tools.description}) LIKE ${searchPattern} OR LOWER(${tools.appId}) LIKE ${searchPattern})`
      );
    }

    // Get total count first
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(tools)
      .where(and(...conditions));
    const totalCount = Number(countResult[0]?.count || 0);

    // Query with pagination
    const rows = await db.select({
      id: tools.id,
      displayName: tools.displayName,
      description: tools.description,
      appId: tools.appId,
      config: tools.config,
    })
      .from(tools)
      .where(and(...conditions))
      .orderBy(tools.displayName)
      .limit(limit)
      .offset(offset);

    // Convert to PipedreamToolMetadata
    const toolsData: PipedreamToolMetadata[] = rows.map((row: typeof rows[number]) => {
      const config = row.config as OAuthToolDefinitionData;
      return {
        id: row.id,
        app: row.appId,
        name: row.displayName,
        description: row.description || '',
        type: 'action' as const,
        inputs: config.parameters ? Object.fromEntries(
          Object.entries(config.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description || '',
              required: param.required,
            }
          ])
        ) : {},
      };
    });

    return {
      success: true,
      data: {
        tools: toolsData,
        hasMore: offset + limit < totalCount,
        totalCount,
      }
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error searching Pipedream tools:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search Pipedream tools'
    };
  }
}

/**
 * Get available Pipedream app names for filtering
 */
export async function getPipedreamApps(): Promise<Result<{ id: string; name: string; toolCount: number }[]>> {
  try {
    await requireAuth();

    const apps = await db.select({
      appId: tools.appId,
      count: sql<number>`count(*)`,
    })
      .from(tools)
      .where(sql`${tools.config}->>'type' = 'oauth'`)
      .groupBy(tools.appId)
      .orderBy(tools.appId);

    const appList = apps.map((row: typeof apps[number]) => ({
      id: row.appId,
      name: row.appId.replace(/^_/, '').replace(/_/g, ' '),
      toolCount: Number(row.count),
    }));

    return {
      success: true,
      data: appList,
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting Pipedream apps:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Pipedream apps'
    };
  }
}

/**
 * Get a specific Pipedream tool by ID from the database
 */
export async function getPipedreamToolById(toolId: string): Promise<Result<PipedreamToolMetadata | null>> {
  try {
    await requireAuth();

    // Query specific tool from DB
    const rows = await db.select({
      id: tools.id,
      displayName: tools.displayName,
      description: tools.description,
      appId: tools.appId,
      config: tools.config,
    })
      .from(tools)
      .where(eq(tools.id, toolId))
      .limit(1);

    if (rows.length === 0) {
      return {
        success: true,
        data: null
      };
    }

    const row = rows[0];
    const config = row.config as OAuthToolDefinitionData;

    // Convert DB row to PipedreamToolMetadata
    const toolMetadata: PipedreamToolMetadata = {
      id: row.id,
      app: row.appId,
      name: row.displayName,
      description: row.description || '',
      type: 'action',
      inputs: config.parameters ? Object.fromEntries(
        Object.entries(config.parameters).map(([key, param]) => [
          key,
          {
            type: param.type,
            description: param.description || '',
            required: param.required,
          }
        ])
      ) : {},
    };

    return {
      success: true,
      data: toolMetadata
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting Pipedream tool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Pipedream tool'
    };
  }
}

// =============================================================================
// Trigger Tools (Event Sources) - For External Event Automations
// =============================================================================

export interface TriggerToolParameter {
  type: string;
  description: string;
  required: boolean;
}

export interface TriggerToolDTO {
  id: string;
  displayName: string;
  description: string;
  appId: string;
  parameters: Record<string, TriggerToolParameter>;
}

/**
 * Get available triggers (event sources) for a specific app
 * Used in TriggerConfigModal for External Event automation type
 * AIDEV-NOTE: Filters tools where is_trigger = true AND appId matches
 */
export async function getTriggersByApp(appId: string): Promise<Result<TriggerToolDTO[]>> {
  try {
    await requireAuth();

    console.log(`[ToolActions] Getting triggers for app: ${appId}`);

    // Query tools that are triggers for this app
    const triggerTools = await db.select({
      id: tools.id,
      displayName: tools.displayName,
      description: tools.description,
      appId: tools.appId,
      config: tools.config,
    })
      .from(tools)
      .where(and(
        eq(tools.appId, appId),
        eq(tools.isTrigger, true)
      ));

    console.log(`[ToolActions] Found ${triggerTools.length} triggers for ${appId}`);

    // Convert to DTOs
    const triggerDTOs: TriggerToolDTO[] = triggerTools.map((row: typeof triggerTools[number]) => {
      const config = row.config as OAuthToolDefinitionData;

      return {
        id: row.id,
        displayName: row.displayName,
        description: row.description || '',
        appId: row.appId,
        parameters: config.parameters ? Object.fromEntries(
          Object.entries(config.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description || '',
              required: param.required,
            }
          ])
        ) : {},
      };
    });

    // Sort by display name
    triggerDTOs.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return {
      success: true,
      data: triggerDTOs
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting triggers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get triggers'
    };
  }
}