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
import { eq, like, and, desc, or, ilike } from 'drizzle-orm';
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
import { toolResolverService } from '@/ddd/domain/tools/services/tool-resolver-service';

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
    let connectionType: ConnectionType = ConnectionType.NONE;
    if (config.type === 'oauth') {
      connectionType = ConnectionType.OAUTH;
    } else if (config.implementation.requires_auth) {
      connectionType = ConnectionType.API_KEY;
    }

    // Determine tool category
    const category = this.mapCategoryToToolCategory(tool.category || 'other');

    // Icon priority: tool-specific icon > app icon URL > default emoji
    const toolIcon = tool.icon || app?.iconUrl || '🔧';

    return new ToolMetadata(
      tool.id,
      tool.displayName,
      tool.description || '',
      category,
      connectionType !== ConnectionType.NONE, // requiresConnection
      connectionType,
      app?.id ? [app.id] : [], // requiredApps
      toolIcon, // Use icon with fallback to app icon
      [], // tags
      [], // mapsToReferences
      undefined, // autoBindParameter
      {
        app: app?.name || 'Unknown',
        appId: tool.appId,
        appIconUrl: app?.iconUrl || undefined, // NEW: Include app icon URL separately (convert null to undefined)
        supportsOAuth: app?.supportsOAuth || false,
        insertText: config.ui_config?.insert_text || `@tool:${tool.id}`,
        supportsArtifacts: (config.ui_config && 'supports_artifacts' in config.ui_config) ? config.ui_config.supports_artifacts || false : false,
        implementation: config.implementation,
        parameters: config.parameters || {},
      }
    );
  }

  /**
   * Map database category to ToolCategory enum
   */
  private mapCategoryToToolCategory(category: string): ToolCategory {
    return toolResolverService.mapDatabaseCategoryToToolCategory(category);
  }

  /**
   * Get icon for a specific tool (with app fallback)
   * Priority: tool.icon > app.iconUrl > default emoji
   */
  async getToolIcon(toolId: string): Promise<string> {
    try {
      const result = await this.db
        .select({
          toolIcon: tools.icon,
          appIconUrl: appTypes.iconUrl,
        })
        .from(tools)
        .leftJoin(appTypes, eq(tools.appId, appTypes.id))
        .where(eq(tools.id, toolId))
        .limit(1);

      if (!result[0]) return '🔧'; // Default emoji

      // Priority: tool icon > app icon > default
      return result[0].toolIcon || result[0].appIconUrl || '🔧';
    } catch (error) {
      console.error('[DatabaseToolRegistry] Error getting tool icon:', error);
      return '🔧';
    }
  }

  /**
   * Get app icon URL
   */
  async getAppIcon(appId: string): Promise<string | null> {
    try {
      const result = await this.db
        .select({ iconUrl: appTypes.iconUrl })
        .from(appTypes)
        .where(eq(appTypes.id, appId))
        .limit(1);

      return result[0]?.iconUrl || null;
    } catch (error) {
      console.error('[DatabaseToolRegistry] Error getting app icon:', error);
      return null;
    }
  }

  /**
   * Search tools by query (interface required method)
   */
  async searchTools(query: string, limit: number = 50): Promise<ToolMetadata[]> {
    return this.searchToolsInternal(query, limit, 0);
  }

  /**
   * Internal search with full options (for discoverTools)
   */
  private async searchToolsInternal(
    query?: string,
    limit: number = 50,
    offset: number = 0,
    options?: ToolDiscoveryOptions
  ): Promise<ToolMetadata[]> {
    console.log(`[DatabaseToolRegistry] Searching tools: query="${query}", limit=${limit}, offset=${offset}`);

    try {
      let whereConditions = [];

      // Add multi-field search query condition with enhanced matching
      if (query && query.trim()) {
        const searchQuery = query.trim().toLowerCase();

        // Split query into words for multi-word support
        const searchWords = searchQuery.split(/\s+/).filter(word => word.length > 0);

        if (searchWords.length > 0) {
          // For each word, search across multiple fields using OR conditions
          const wordConditions = searchWords.map(word => {
            const searchTerm = `%${word}%`;
            return or(
              ilike(tools.id, searchTerm),              // Search tool ID (e.g., "gmail-send-email")
              ilike(tools.displayName, searchTerm),     // Search display name (e.g., "Send Email")
              ilike(tools.description, searchTerm),     // Search description
              ilike(appTypes.name, searchTerm)          // Search app name (e.g., "gmail")
            );
          });

          // All words must match (AND condition across words)
          if (wordConditions.length === 1) {
            whereConditions.push(wordConditions[0]);
          } else {
            whereConditions.push(and(...wordConditions));
          }

          console.log(`[DatabaseToolRegistry] Multi-field search for "${searchQuery}" (${searchWords.length} words)`);
        }
      }

      // Add category filter if specified
      if (options?.category) {
        // Convert ToolCategory enum to string
        const categoryStr = options.category.toString();
        whereConditions.push(eq(tools.category, categoryStr));
      }

      // Add app filter if specified
      if (options?.appId) {
        whereConditions.push(eq(appTypes.id, options.appId));
      }

      // Add connection requirement filters
      if (options?.requiresConnection !== undefined) {
        if (options.requiresConnection) {
          // Only tools that require connections (OAuth or API key)
          whereConditions.push(eq(appTypes.supportsOAuth, true));
        } else {
          // Only tools that don't require connections
          whereConditions.push(eq(appTypes.supportsOAuth, false));
        }
      }

      // Track if we need connection filtering (will apply after query)
      const needsConnectionFilter = options?.connectedOnly && options?.userId && options?.organizationId;
      if (needsConnectionFilter) {
        console.log(`[DatabaseToolRegistry] Connected-only filter requested for user ${options.userId}`);
        // Will filter after query using actual user connections
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
      let results;
      if (whereConditions.length > 0) {
        results = await dbQuery.where(and(...whereConditions));
      } else {
        results = await dbQuery;
      }

      console.log(`[DatabaseToolRegistry] Found ${results.length} tools from database`);
      let toolMetadata = results.map(({ tool, app }) => this.convertToToolMetadata(tool, app));

      // Apply connection filter if needed (post-processing)
      if (needsConnectionFilter && options?.userId && options?.organizationId) {
        toolMetadata = await this.filterByUserConnections(
          toolMetadata,
          options.userId,
          options.organizationId
        );
      }

      console.log(`[DatabaseToolRegistry] Returning ${toolMetadata.length} tools after filtering`);
      return toolMetadata;

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
   * Check tool availability (interface required method)
   */
  async checkToolAvailability(toolName: string, organizationId?: number): Promise<ToolAvailability> {
    try {
      const tool = await this.db
        .select()
        .from(tools)
        .where(eq(tools.id, toolName))
        .limit(1);

      if (tool.length === 0) {
        return {
          available: false,
          reason: 'Tool not found'
        };
      }

      return {
        available: true,
        connectionRequired: tool[0].config.type === 'oauth',
        connectionConfigured: false // Would need to check user connections
      };
    } catch (error) {
      console.error(`[DatabaseToolRegistry] Error checking availability for ${toolName}:`, error);
      return {
        available: false,
        reason: 'Error checking availability'
      };
    }
  }

  /**
   * Get tools by category (interface required method)
   */
  async getToolsByCategory(category: ToolCategory): Promise<ToolMetadata[]> {
    return this.searchToolsInternal(undefined, 50, 0, { category });
  }

  /**
   * Validate tool configuration (interface required method)
   */
  async validateToolConfig(config: ToolConfig): Promise<{ valid: boolean; errors?: string[] }> {
    // Basic validation - could be enhanced
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Tool name is required');
    }

    if (!config.config) {
      errors.push('Tool configuration is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Create a Tool instance (interface required method)
   */
  createTool(metadata: ToolMetadata, customConfig?: Record<string, any>): Tool {
    // Create a ToolConfig from ToolMetadata
    const toolConfig = new ToolConfig(
      metadata.name,
      customConfig || {}
    );
    return new Tool(toolConfig, metadata);
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
   * Discover tools with pagination and filtering (interface required method)
   */
  async discoverTools(options: ToolDiscoveryOptions = {}): Promise<ToolDiscoveryResult> {
    const {
      searchQuery,
      limit = 50,
      offset = 0,
    } = options;

    try {
      // Get tools with the specified criteria - pass ALL options for proper filtering
      const toolsFound = await this.searchToolsInternal(searchQuery, limit + 1, offset, options);

      // Check if there are more tools available
      const hasMore = toolsFound.length > limit;
      const tools = hasMore ? toolsFound.slice(0, limit) : toolsFound;

      // Get total count (simplified for now)
      const totalCount = tools.length + (hasMore ? 1 : 0);

      return {
        tools,
        hasMore,
        totalCount
      };

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error discovering tools:', error);
      return {
        tools: [],
        hasMore: false,
        totalCount: 0
      };
    }
  }

  /**
   * Get available categories from database (interface required method)
   */
  async getAvailableCategories(): Promise<ToolCategory[]> {
    try {
      const categories = await this.db
        .selectDistinct({ category: tools.category })
        .from(tools)
        .where(eq(tools.category, tools.category)); // Filter out nulls

      const categoryStrings = categories
        .map(row => row.category)
        .filter(Boolean) as string[];

      // Map strings back to ToolCategory enums
      return categoryStrings
        .map(cat => this.mapCategoryToToolCategory(cat))
        .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
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

      return apps
        .filter(app => app.category) // Filter out nulls
        .map(app => ({
          id: app.id,
          name: app.name,
          category: app.category as string // Type assertion since we filtered nulls
        }));

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error getting apps:', error);
      return [];
    }
  }

  /**
   * Filter tools to only those with active user connections
   * @private
   */
  private async filterByUserConnections(
    tools: ToolMetadata[],
    userId: string,
    orgId: number
  ): Promise<ToolMetadata[]> {
    try {
      // Dynamically import to avoid circular dependencies
      const { getConnectionApplicationService } = await import('@/ddd/application/di/container');
      const { UserId } = await import('@/ddd/domain/shared/value-objects');

      const connectionService = getConnectionApplicationService();
      const userIdVO = UserId.fromString(userId);

      // Get user's active connections
      const result = await connectionService.getUserConnections(userIdVO);
      if (!result.success || !result.data) {
        console.log('[DatabaseToolRegistry] No connections found for user');
        return [];
      }

      // Build set of connected app IDs
      const connectedAppIds = new Set(
        result.data
          .filter(conn => conn.status === 'active')
          .map(conn => conn.appName.value)
      );

      console.log(`[DatabaseToolRegistry] User has ${connectedAppIds.size} active connections:`, Array.from(connectedAppIds));

      // Filter to connected tools only
      const filtered = tools.filter(tool => {
        const appId = tool.extra?.appId;
        return appId && connectedAppIds.has(appId);
      });

      console.log(`[DatabaseToolRegistry] Filtered from ${tools.length} to ${filtered.length} connected tools`);
      return filtered;

    } catch (error) {
      console.error('[DatabaseToolRegistry] Error filtering by connections:', error);
      return tools; // Return unfiltered on error
    }
  }
}