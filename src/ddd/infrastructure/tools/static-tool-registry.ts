/**
 * Static Tool Registry Implementation
 *
 * Updated implementation that reads from unified registry and Pipedream metadata files.
 * Provides a complete tool catalog including system tools, OAuth integrations, and Pipedream tools.
 *
 * AIDEV-NOTE: Fixed to read from unified registry instead of hardcoded tools.
 * Integrates both public/tools-registry.json and Pipedream metadata files.
 */

import fs from 'fs';
import path from 'path';
import type {
  IToolRegistryService,
  ToolDiscoveryOptions,
  ToolDiscoveryResult,
  ToolAvailability
} from '@/ddd/domain/tools/services/tool-registry';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { ToolMetadata, ToolCategory, ConnectionType } from '@/ddd/domain/tools/value-objects/tool-metadata';
import { Tool } from '@/ddd/domain/tools/entities/tool';

export class StaticToolRegistry implements IToolRegistryService {
  private tools: ToolMetadata[] | null = null;
  private isLoading = false;

  /**
   * Clear cached tools and force reload on next request
   * Useful for debugging cache issues
   */
  public clearCache(): void {
    console.log('[StaticToolRegistry] Clearing cache and forcing reload...');
    this.tools = null;
    this.isLoading = false;
  }

  /**
   * Load tools from unified registry and Pipedream metadata
   */
  private async loadTools(): Promise<ToolMetadata[]> {
    if (this.tools) {
      console.log('[StaticToolRegistry] Using cached tools');
      return this.tools;
    }

    if (this.isLoading) {
      console.log('[StaticToolRegistry] Loading already in progress, waiting...');
      // Simple wait for loading to complete
      while (this.isLoading && !this.tools) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.tools || [];
    }

    this.isLoading = true;
    console.log('[StaticToolRegistry] Loading tools from unified registry and Pipedream metadata...');

    try {
      const allTools: ToolMetadata[] = [];

      // 1. Load from unified registry (public/tools-registry.json)
      const unifiedTools = await this.loadUnifiedRegistryTools();
      console.log(`[StaticToolRegistry] Loaded ${unifiedTools.length} tools from unified registry`);
      allTools.push(...unifiedTools);

      // 2. Load from Pipedream metadata
      const pipedreamTools = await this.loadPipedreamTools();
      console.log(`[StaticToolRegistry] Loaded ${pipedreamTools.length} tools from Pipedream metadata`);
      allTools.push(...pipedreamTools);

      console.log(`[StaticToolRegistry] Total loaded tools: ${allTools.length}`);
      this.tools = allTools;
      return allTools;
    } catch (error) {
      console.error('[StaticToolRegistry] Error loading tools:', error);
      // Return empty array if loading fails
      this.tools = [];
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load tools from unified registry JSON file
   */
  private async loadUnifiedRegistryTools(): Promise<ToolMetadata[]> {
    try {
      // Try multiple possible locations for tools-registry.json
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'public', 'tools-registry.json'),
        path.join(process.cwd(), 'public', 'tools-registry.json'),
        path.join(__dirname, '..', '..', '..', '..', 'src', 'public', 'tools-registry.json'),
        path.join(__dirname, '..', '..', '..', '..', 'public', 'tools-registry.json')
      ];

      let registryPath: string | null = null;
      for (const candidate of possiblePaths) {
        console.log('[StaticToolRegistry] Checking path:', candidate);
        if (fs.existsSync(candidate)) {
          registryPath = candidate;
          console.log('[StaticToolRegistry] Found registry at:', registryPath);
          break;
        }
      }

      if (!registryPath) {
        console.error('[StaticToolRegistry] CRITICAL: Unified registry file not found in any of these locations:');
        possiblePaths.forEach(p => console.log('[StaticToolRegistry]   -', p));
        console.log('[StaticToolRegistry] Current working directory:', process.cwd());
        console.log('[StaticToolRegistry] __dirname:', __dirname);
        console.log('[StaticToolRegistry] Directory contents:', fs.readdirSync(process.cwd()));
        return [];
      }

      console.log('[StaticToolRegistry] Registry file exists, reading content...');
      const registryContent = fs.readFileSync(registryPath, 'utf8');
      console.log('[StaticToolRegistry] Registry content length:', registryContent.length);

      console.log('[StaticToolRegistry] Parsing JSON...');
      const registry = JSON.parse(registryContent);
      console.log('[StaticToolRegistry] JSON parsed successfully, keys:', Object.keys(registry));

      const curatedTools = registry.curated_tools || [];
      console.log(`[StaticToolRegistry] Found ${curatedTools.length} curated tools in registry`);

      if (curatedTools.length === 0) {
        console.error('[StaticToolRegistry] CRITICAL: No curated_tools found in registry');
        console.log('[StaticToolRegistry] Registry structure:', JSON.stringify(registry, null, 2).substring(0, 500));
      }

      console.log('[StaticToolRegistry] Converting curated tools to ToolMetadata...');
      const toolMetadataArray = curatedTools.map((tool: any, index: number) => {
        try {
          console.log(`[StaticToolRegistry] Converting tool ${index + 1}/${curatedTools.length}: ${tool.id}`);
          return this.createToolMetadataFromRegistry(tool);
        } catch (conversionError) {
          console.error(`[StaticToolRegistry] Error converting tool ${tool.id}:`, conversionError);
          throw conversionError;
        }
      });

      console.log(`[StaticToolRegistry] Successfully converted ${toolMetadataArray.length} tools from unified registry`);
      return toolMetadataArray;
    } catch (error) {
      console.error('[StaticToolRegistry] CRITICAL ERROR loading unified registry:', error);
      console.error('[StaticToolRegistry] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return [];
    }
  }

  /**
   * Load tools from Pipedream metadata
   */
  private async loadPipedreamTools(): Promise<ToolMetadata[]> {
    try {
      // Try multiple possible locations for pipedream_metadata.json
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'public', 'pipedream_metadata.json'),
        path.join(process.cwd(), 'public', 'pipedream_metadata.json'),
        path.join(__dirname, '..', '..', '..', '..', 'src', 'public', 'pipedream_metadata.json'),
        path.join(__dirname, '..', '..', '..', '..', 'public', 'pipedream_metadata.json')
      ];

      let pipedreamPath: string | null = null;
      for (const candidate of possiblePaths) {
        console.log('[StaticToolRegistry] Checking Pipedream path:', candidate);
        if (fs.existsSync(candidate)) {
          pipedreamPath = candidate;
          console.log('[StaticToolRegistry] Found Pipedream metadata at:', pipedreamPath);
          break;
        }
      }

      if (!pipedreamPath) {
        console.error('[StaticToolRegistry] CRITICAL: Pipedream metadata file not found in any of these locations:');
        possiblePaths.forEach(p => console.log('[StaticToolRegistry]   -', p));
        console.log('[StaticToolRegistry] Checking emery-agents directory...');
        const emeryAgentsPath = path.join(process.cwd(), 'emery-agents');
        if (fs.existsSync(emeryAgentsPath)) {
          console.log('[StaticToolRegistry] emery-agents directory exists');
          const srcPath = path.join(emeryAgentsPath, 'src');
          if (fs.existsSync(srcPath)) {
            console.log('[StaticToolRegistry] src directory exists');
          } else {
            console.log('[StaticToolRegistry] src directory does not exist');
          }
        } else {
          console.log('[StaticToolRegistry] emery-agents directory does not exist');
        }
        return [];
      }

      console.log('[StaticToolRegistry] Pipedream metadata file exists, reading content...');
      const pipedreamContent = fs.readFileSync(pipedreamPath, 'utf8');
      console.log('[StaticToolRegistry] Pipedream content length:', pipedreamContent.length);

      console.log('[StaticToolRegistry] Parsing Pipedream JSON...');
      const pipedreamMetadata = JSON.parse(pipedreamContent);

      const toolIds = Object.keys(pipedreamMetadata);
      console.log(`[StaticToolRegistry] Found ${toolIds.length} Pipedream tools in metadata`);

      console.log('[StaticToolRegistry] Converting Pipedream tools to ToolMetadata...');
      const pipedreamToolMetadata = toolIds.map((toolId, index) => {
        try {
          console.log(`[StaticToolRegistry] Converting Pipedream tool ${index + 1}/${toolIds.length}: ${toolId}`);
          return this.createToolMetadataFromPipedream(toolId, pipedreamMetadata[toolId]);
        } catch (conversionError) {
          console.error(`[StaticToolRegistry] Error converting Pipedream tool ${toolId}:`, conversionError);
          throw conversionError;
        }
      });

      console.log(`[StaticToolRegistry] Successfully converted ${pipedreamToolMetadata.length} Pipedream tools`);
      return pipedreamToolMetadata;
    } catch (error) {
      console.error('[StaticToolRegistry] CRITICAL ERROR loading Pipedream metadata:', error);
      console.error('[StaticToolRegistry] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return [];
    }
  }

  /**
   * Create ToolMetadata from unified registry entry
   */
  private createToolMetadataFromRegistry(registryTool: any): ToolMetadata {
    const category = this.mapCategoryFromRegistry(registryTool.category);
    const connectionType = registryTool.implementation?.requires_auth
      ? ConnectionType.OAUTH
      : ConnectionType.NONE;

    if (registryTool.implementation?.type === 'pipedream') {
      // OAuth-based app integration
      return ToolMetadata.oauthApp(
        registryTool.id,
        registryTool.display_name,
        registryTool.description,
        [registryTool.app], // Required apps array
        registryTool.ui_config?.icon,
        registryTool.tags || []
      );
    } else if (category === ToolCategory.UTILITIES) {
      // Utility tool
      return ToolMetadata.utility(
        registryTool.id,
        registryTool.display_name,
        registryTool.description,
        registryTool.tags || []
      );
    } else if (category === ToolCategory.ORGANIZATIONAL) {
      // Organizational tool
      return ToolMetadata.organizational(
        registryTool.id,
        registryTool.display_name,
        registryTool.description,
        registryTool.tags || []
      );
    } else {
      // Default tool metadata
      return new ToolMetadata(
        registryTool.id,
        registryTool.display_name,
        registryTool.description,
        category,
        registryTool.implementation?.requires_auth || false,
        connectionType,
        registryTool.implementation?.requires_auth ? [registryTool.app] : [],
        registryTool.ui_config?.icon,
        registryTool.tags || []
      );
    }
  }

  /**
   * Create ToolMetadata from Pipedream metadata entry
   */
  private createToolMetadataFromPipedream(toolId: string, pipedreamTool: any): ToolMetadata {
    const appName = pipedreamTool.app || 'pipedream';
    const displayName = pipedreamTool.name || toolId;
    const description = pipedreamTool.description || `${displayName} integration via Pipedream`;

    // Most Pipedream tools are OAuth integrations
    return ToolMetadata.oauthApp(
      toolId,
      displayName,
      description,
      [appName],
      undefined, // No icon specified in Pipedream metadata
      [appName, 'pipedream', 'integration']
    );
  }

  /**
   * Map registry category to domain ToolCategory
   */
  private mapCategoryFromRegistry(registryCategory: string): ToolCategory {
    switch (registryCategory?.toLowerCase()) {
      case 'apps':
      case 'app':
      case 'oauth_integration':
        return ToolCategory.APPS;
      case 'utility':
      case 'utilities':
        return ToolCategory.UTILITIES;
      case 'organizational':
        return ToolCategory.ORGANIZATIONAL;
      case 'base':
      case 'system':
        return ToolCategory.BASE;
      default:
        return ToolCategory.UTILITIES;
    }
  }


  async discoverTools(options: ToolDiscoveryOptions): Promise<ToolDiscoveryResult> {
    const allTools = await this.loadTools();
    let filteredTools = [...allTools];

    // Filter by category
    if (options.category) {
      filteredTools = filteredTools.filter(tool => tool.category === options.category);
    }

    // Filter by connection requirement
    if (options.requiresConnection !== undefined) {
      filteredTools = filteredTools.filter(tool => tool.requiresConnection === options.requiresConnection);
    }

    // Filter by search query
    if (options.searchQuery) {
      filteredTools = filteredTools.filter(tool => tool.matchesSearch(options.searchQuery!));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filteredTools = filteredTools.filter(tool =>
        options.tags!.some(tag => tool.hasTag(tag))
      );
    }

    // Apply pagination
    const totalCount = filteredTools.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginatedTools = filteredTools.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
      tools: paginatedTools,
      totalCount,
      hasMore
    };
  }

  async getToolMetadata(toolName: string): Promise<ToolMetadata | null> {
    const allTools = await this.loadTools();
    return allTools.find(tool => tool.name === toolName) || null;
  }

  async checkToolAvailability(toolName: string, organizationId?: number): Promise<ToolAvailability> {
    const tool = await this.getToolMetadata(toolName);
    if (!tool) {
      return {
        available: false,
        reason: 'Tool not found'
      };
    }

    // For OAuth tools, we'd check connection status here
    // For now, assume all tools are available
    return {
      available: true,
      connectionRequired: tool.requiresConnection,
      connectionConfigured: !tool.requiresConnection // Assume connections are configured
    };
  }

  async getToolsByCategory(category: ToolCategory): Promise<ToolMetadata[]> {
    const allTools = await this.loadTools();
    return allTools.filter(tool => tool.category === category);
  }

  async searchTools(query: string, limit = 20): Promise<ToolMetadata[]> {
    console.log(`[StaticToolRegistry] === SEARCH TOOLS START ===`);
    console.log(`[StaticToolRegistry] searchTools called with query: "${query}", limit: ${limit}`);
    console.log(`[StaticToolRegistry] Current cache state - tools: ${this.tools ? this.tools.length : 'null'}, isLoading: ${this.isLoading}`);

    const allTools = await this.loadTools();
    console.log(`[StaticToolRegistry] loadTools returned ${allTools.length} tools`);

    if (allTools.length === 0) {
      console.error(`[StaticToolRegistry] CRITICAL: loadTools returned 0 tools - this indicates a cache or loading issue`);
      console.log(`[StaticToolRegistry] Cache state after loadTools - tools: ${this.tools ? this.tools.length : 'null'}`);
      console.log(`[StaticToolRegistry] Attempting to clear cache and reload...`);
      this.clearCache();
      const reloadedTools = await this.loadTools();
      console.log(`[StaticToolRegistry] After cache clear and reload: ${reloadedTools.length} tools`);
      return reloadedTools.slice(0, limit); // Return early with whatever we got
    }

    if (allTools.length > 0) {
      console.log(`[StaticToolRegistry] First few tools:`, allTools.slice(0, 3).map(t => ({ name: t.name, category: t.category })));
    }

    const results = allTools
      .filter(tool => {
        const matches = tool.matchesSearch(query);
        console.log(`[StaticToolRegistry] Tool "${tool.name}" ${matches ? 'MATCHES' : 'does not match'} query "${query}"`);
        return matches;
      })
      .slice(0, limit);

    console.log(`[StaticToolRegistry] searchTools returning ${results.length} results`);
    console.log(`[StaticToolRegistry] === SEARCH TOOLS END ===`);
    return results;
  }

  async validateToolConfig(config: ToolConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Check if tool exists
    const metadata = await this.getToolMetadata(config.name);
    if (!metadata) {
      errors.push(`Unknown tool: ${config.name}`);
    }

    // Validate version format
    if (!config.version.match(/^\d+\.\d+(\.\d+)?$/)) {
      errors.push('Version must be in format "x.y" or "x.y.z"');
    }

    // Validate config object
    if (typeof config.config !== 'object' || config.config === null) {
      errors.push('Config must be a valid object');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async getAvailableCategories(): Promise<ToolCategory[]> {
    const allTools = await this.loadTools();
    const categories = new Set(allTools.map(tool => tool.category));
    return Array.from(categories);
  }

  /**
   * Create a ToolConfig from ToolMetadata with default configuration
   */
  createToolConfig(metadata: ToolMetadata, customConfig: Record<string, any> = {}): ToolConfig {
    return ToolConfig.create(metadata.name, '1.0', {
      displayName: metadata.displayName,
      description: metadata.description,
      category: metadata.category,
      requiresConnection: metadata.requiresConnection,
      connectionType: metadata.connectionType,
      ...customConfig
    });
  }

  /**
   * Create a Tool instance from ToolMetadata
   */
  createTool(metadata: ToolMetadata, customConfig: Record<string, any> = {}): Tool {
    return Tool.fromMetadata(metadata, customConfig);
  }

  /**
   * Create multiple Tool instances from search results
   */
  async createToolsFromSearch(query: string, limit = 20): Promise<Tool[]> {
    const metadataList = await this.searchTools(query, limit);
    return metadataList.map(metadata => this.createTool(metadata));
  }
}