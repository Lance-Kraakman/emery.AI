'use server'

// AIDEV-NOTE: Tool Registry Server Actions - DDD-based actions for tool discovery and metadata
// Integrates with domain tool registry service for proper tool management

import { requireAuth } from "./permissions";
import { getToolRegistryService } from "@/src/ddd/application/di/container";
import type { ToolCategory } from '@/src/ddd/domain/tools/value-objects/tool-metadata';
import type { ToolDiscoveryOptions } from '@/src/ddd/domain/tools/services/tool-registry';
import type { Result } from "./types";

/**
 * Tool metadata DTO for frontend consumption
 */
export interface ToolMetadataDTO {
  name: string;
  displayName: string;
  description: string;
  category: string;
  requiresConnection: boolean;
  connectionType: string;
  icon?: string;
  tags: string[];
}

/**
 * Tool discovery result DTO
 */
export interface ToolDiscoveryResultDTO {
  tools: ToolMetadataDTO[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Discover available tools based on search criteria
 */
export async function discoverTools(options: {
  category?: ToolCategory;
  requiresConnection?: boolean;
  searchQuery?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<Result<ToolDiscoveryResultDTO>> {
  try {
    const session = await requireAuth();
    const toolRegistry = getToolRegistryService();

    console.log(`[ToolRegistryActions] Discovering tools with options:`, options);

    const result = await toolRegistry.discoverTools(options as ToolDiscoveryOptions);

    // Convert domain objects to DTOs
    const toolDTOs: ToolMetadataDTO[] = result.tools.map(tool => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      requiresConnection: tool.requiresConnection,
      connectionType: tool.connectionType,
      icon: tool.icon,
      tags: [...tool.tags]
    }));

    console.log(`[ToolRegistryActions] Found ${toolDTOs.length} tools`);

    return {
      success: true,
      data: {
        tools: toolDTOs,
        totalCount: result.totalCount,
        hasMore: result.hasMore
      }
    };
  } catch (error: unknown) {
    console.error('[ToolRegistryActions] Error discovering tools:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to discover tools'
    };
  }
}

/**
 * Get tools by category for agent creation
 */
export async function getToolsByCategory(category: ToolCategory): Promise<Result<ToolMetadataDTO[]>> {
  try {
    const session = await requireAuth();
    const toolRegistry = getToolRegistryService();

    console.log(`[ToolRegistryActions] Getting tools for category: ${category}`);

    const tools = await toolRegistry.getToolsByCategory(category);

    const toolDTOs: ToolMetadataDTO[] = tools.map(tool => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      requiresConnection: tool.requiresConnection,
      connectionType: tool.connectionType,
      icon: tool.icon,
      tags: [...tool.tags]
    }));

    console.log(`[ToolRegistryActions] Found ${toolDTOs.length} tools in ${category}`);

    return {
      success: true,
      data: toolDTOs
    };
  } catch (error: unknown) {
    console.error('[ToolRegistryActions] Error getting tools by category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tools'
    };
  }
}

/**
 * Search tools by query for agent creation
 */
export async function searchTools(query: string, limit = 20): Promise<Result<ToolMetadataDTO[]>> {
  try {
    const session = await requireAuth();
    const toolRegistry = getToolRegistryService();

    console.log(`[ToolRegistryActions] Searching tools for: "${query}"`);

    const tools = await toolRegistry.searchTools(query, limit);

    const toolDTOs: ToolMetadataDTO[] = tools.map(tool => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      requiresConnection: tool.requiresConnection,
      connectionType: tool.connectionType,
      icon: tool.icon,
      tags: [...tool.tags]
    }));

    console.log(`[ToolRegistryActions] Found ${toolDTOs.length} tools matching "${query}"`);

    return {
      success: true,
      data: toolDTOs
    };
  } catch (error: unknown) {
    console.error('[ToolRegistryActions] Error searching tools:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search tools'
    };
  }
}

/**
 * Get all available tool categories
 */
export async function getAvailableCategories(): Promise<Result<ToolCategory[]>> {
  try {
    const session = await requireAuth();
    const toolRegistry = getToolRegistryService();

    console.log(`[ToolRegistryActions] Getting available tool categories`);

    const categories = await toolRegistry.getAvailableCategories();

    console.log(`[ToolRegistryActions] Found ${categories.length} categories`);

    return {
      success: true,
      data: categories
    };
  } catch (error: unknown) {
    console.error('[ToolRegistryActions] Error getting categories:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get categories'
    };
  }
}

/**
 * Create a ToolConfig from tool metadata for agent configuration
 */
export async function createToolConfigFromMetadata(
  toolName: string,
  customConfig: Record<string, any> = {}
): Promise<Result<{
  name: string;
  version: string;
  config: Record<string, any>;
}>> {
  try {
    const session = await requireAuth();
    const toolRegistry = getToolRegistryService() as any; // Cast to access createToolConfig method

    console.log(`[ToolRegistryActions] Creating config for tool: ${toolName}`);

    const metadata = await toolRegistry.getToolMetadata(toolName);
    if (!metadata) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`
      };
    }

    const toolConfig = toolRegistry.createToolConfig(metadata, customConfig);

    return {
      success: true,
      data: {
        name: toolConfig.name,
        version: toolConfig.version,
        config: toolConfig.config
      }
    };
  } catch (error: unknown) {
    console.error('[ToolRegistryActions] Error creating tool config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create tool config'
    };
  }
}