/**
 * Database Tool Registry Implementation
 *
 * Replaces StaticToolRegistry to load tools from database instead of JSON files.
 * Provides the same interface for tool discovery and metadata retrieval.
 *
 * AIDEV-NOTE: Database-driven tool registry for improved scalability and management.
 * Loads tools from the tools table with proper app relationships.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, like, and, desc } from 'drizzle-orm';
import type {
  IToolRegistryService,
  ToolDiscoveryOptions,
  ToolDiscoveryResult,
  ToolAvailability
} from '@/ddd/domain/tools/services/tool-registry';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { ToolMetadata, ToolCategory, ConnectionType } from '@/ddd/domain/tools/value-objects/tool-metadata';
import { Tool } from '@/ddd/domain/tools/entities/tool';
import { tools, appTypes, type ToolDefinitionData } from '@/lib/db/schema';

export class DatabaseToolRegistry implements IToolRegistryService {
  private db: ReturnType<typeof drizzle>;
  private cachedTools: ToolMetadata[] | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required for DatabaseToolRegistry');
    }

    const client = postgres(connectionString, { max: 10 });
    this.db = drizzle(client);
  }

  /**
   * Clear cached tools and force reload on next request
   */
  public clearCache(): void {
    console.log('[DatabaseToolRegistry] Clearing cache and forcing reload...');
    this.cachedTools = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Load tools from database with caching
   */
  private async loadTools(): Promise<ToolMetadata[]> {
    const now = Date.now();

    // Return cached tools if still valid
    if (this.cachedTools && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      console.log('[DatabaseToolRegistry] Using cached tools');
      return this.cachedTools;
    }

    console.log('[DatabaseToolRegistry] Loading tools from database...');

    try {
      // Query tools with their associated apps
      const toolsWithApps = await this.db
        .select({
          tool: tools,
          app: appTypes,
        })
        .from(tools)
        .leftJoin(appTypes, eq(tools.appId, appTypes.id))
        .orderBy(desc(tools.createdAt));

      console.log(`[DatabaseToolRegistry] Loaded ${toolsWithApps.length} tools from database`);

      // Convert database records to ToolMetadata objects
      const toolMetadata = toolsWithApps.map(({ tool, app }) =>
        this.convertToToolMetadata(tool, app)
      );

      // Cache the results
      this.cachedTools = toolMetadata;
      this.cacheTimestamp = now;

      return toolMetadata;
    } catch (error) {
      console.error('[DatabaseToolRegistry] Error loading tools from database:', error);
      // Return empty array if database fails
      return [];
    }
  }

  /**
   * Convert database tool record to ToolMetadata
   */
  private convertToToolMetadata(
    tool: typeof tools.$inferSelect,
    app: typeof appTypes.$inferSelect | null
  ): ToolMetadata {
    const config = tool.config as ToolDefinitionData;

    // Determine connection type
    let connectionType: ConnectionType = 'none';
    if (config.type === 'oauth') {
      connectionType = 'oauth';
    } else if (config.implementation.requires_auth) {
      connectionType = 'api_key';
    }

    // Determine tool category
    const category = this.mapCategoryToToolCategory(tool.category || 'other');

    return new ToolMetadata(
      tool.id,
      tool.displayName,
      tool.description || '',
      category,
      connectionType,
      tool.icon || '🔧',
      {
        app: app?.name || 'Unknown',
        appId: tool.appId,
        supportsOAuth: app?.supportsOAuth || false,
        insertText: config.ui_config?.insert_text || `@tool:${tool.id}`,
        supportsArtifacts: config.ui_config?.supports_artifacts || false,
        implementation: config.implementation,
        parameters: config.parameters || {},
      }
    );
  }

  /**
   * Map database category to ToolCategory enum
   */
  private mapCategoryToToolCategory(category: string): ToolCategory {
    const categoryMap: Record<string, ToolCategory> = {
      'utility': ToolCategory.UTILITY,
      'communication': ToolCategory.COMMUNICATION,
      'productivity': ToolCategory.PRODUCTIVITY,
      'reference': ToolCategory.REFERENCE,
      'data': ToolCategory.DATA,
      'crm': ToolCategory.PRODUCTIVITY,
      'payments': ToolCategory.UTILITY,
      'ecommerce': ToolCategory.PRODUCTIVITY,
      'marketing': ToolCategory.COMMUNICATION,
      'social': ToolCategory.COMMUNICATION,
      'ai': ToolCategory.UTILITY,
      'system': ToolCategory.UTILITY,
    };

    return categoryMap[category.toLowerCase()] || ToolCategory.OTHER;
  }

  /**
   * Search tools with optional filtering and pagination
   */
  async searchTools(
    query?: string,
    limit: number = 50,
    offset: number = 0,
    options?: ToolDiscoveryOptions
  ): Promise<ToolMetadata[]> {
    console.log(`[DatabaseToolRegistry] Searching tools: query="${query}", limit=${limit}, offset=${offset}`);

    try {
      let whereConditions = [];

      // Add search query condition
      if (query && query.trim()) {
        const searchTerm = `%${query.trim()}%`;
        whereConditions.push(
          like(tools.displayName, searchTerm)
        );
      }

      // Add category filter if specified
      if (options?.category) {
        whereConditions.push(eq(tools.category, options.category));
      }

      // Add app filter if specified
      if (options?.appId) {
        whereConditions.push(eq(tools.appId, options.appId));
      }

      // Build the query
      let dbQuery = this.db
        .select({
          tool: tools,
          app: appTypes,
        })
        .from(tools)
        .leftJoin(appTypes, eq(tools.appId, appTypes.id))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(tools.createdAt));

      // Apply where conditions if any
      if (whereConditions.length > 0) {
        dbQuery = dbQuery.where(and(...whereConditions));
      }

      const results = await dbQuery;

      console.log(`[DatabaseToolRegistry] Found ${results.length} tools matching criteria`);

      return results.map(({ tool, app }) => this.convertToToolMetadata(tool, app));

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error searching tools:', error);
      return [];
    }
  }

  /**
   * Get all available tools
   */
  async getAllTools(): Promise<ToolMetadata[]> {
    return this.loadTools();
  }

  /**
   * Check tool availability (for backwards compatibility)
   */
  async getToolAvailability(toolName: string): Promise<ToolAvailability> {
    try {
      const tool = await this.db
        .select()
        .from(tools)
        .where(eq(tools.id, toolName))
        .limit(1);

      return tool.length > 0
        ? ToolAvailability.AVAILABLE
        : ToolAvailability.NOT_FOUND;
    } catch (error) {
      console.error(`[DatabaseToolRegistry] Error checking availability for ${toolName}:`, error);
      return ToolAvailability.NOT_FOUND;
    }
  }

  /**
   * Create tool instances (for backwards compatibility)
   */
  async createToolInstances(toolConfigs: ToolConfig[]): Promise<Tool[]> {
    const tools: Tool[] = [];

    for (const config of toolConfigs) {
      try {
        const metadata = await this.getToolMetadata(config.name);
        if (metadata) {
          tools.push(new Tool(metadata, config));
        }
      } catch (error) {
        console.error(`[DatabaseToolRegistry] Error creating tool instance for ${config.name}:`, error);
      }
    }

    return tools;
  }

  /**
   * Get metadata for a specific tool
   */
  async getToolMetadata(toolName: string): Promise<ToolMetadata | null> {
    try {
      const result = await this.db
        .select({
          tool: tools,
          app: appTypes,
        })
        .from(tools)
        .leftJoin(appTypes, eq(tools.appId, appTypes.id))
        .where(eq(tools.id, toolName))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const { tool, app } = result[0];
      return this.convertToToolMetadata(tool, app);

    } catch (error) {
      console.error(`[DatabaseToolRegistry] Error getting metadata for ${toolName}:`, error);
      return null;
    }
  }

  /**
   * Discover tools with pagination and filtering
   */
  async discoverTools(options: ToolDiscoveryOptions = {}): Promise<ToolDiscoveryResult> {
    const {
      query,
      limit = 50,
      offset = 0,
      category,
      appId
    } = options;

    try {
      // Get tools with the specified criteria
      const toolsFound = await this.searchTools(query, limit + 1, offset, { category, appId });

      // Check if there are more tools available
      const hasMore = toolsFound.length > limit;
      const tools = hasMore ? toolsFound.slice(0, limit) : toolsFound;

      return {
        tools,
        hasMore,
        total: tools.length, // For now, return current batch size
        offset,
        limit
      };

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error discovering tools:', error);
      return {
        tools: [],
        hasMore: false,
        total: 0,
        offset,
        limit
      };
    }
  }

  /**
   * Get available categories from database
   */
  async getAvailableCategories(): Promise<string[]> {
    try {
      const categories = await this.db
        .selectDistinct({ category: tools.category })
        .from(tools)
        .where(eq(tools.category, tools.category)); // Filter out nulls

      return categories
        .map(row => row.category)
        .filter(Boolean)
        .sort();

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error getting categories:', error);
      return [];
    }
  }

  /**
   * Get available apps from database
   */
  async getAvailableApps(): Promise<Array<{ id: string; name: string; category: string }>> {
    try {
      const apps = await this.db
        .select({
          id: appTypes.id,
          name: appTypes.name,
          category: appTypes.category,
        })
        .from(appTypes)
        .orderBy(appTypes.name);

      return apps.filter(app => app.category); // Filter out nulls

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error getting apps:', error);
      return [];
    }
  }
}