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
      const registryPath = path.join(process.cwd(), 'public', 'tools-registry.json');
      console.log('[StaticToolRegistry] Loading unified registry from:', registryPath);

      if (!fs.existsSync(registryPath)) {
        console.warn('[StaticToolRegistry] Unified registry file not found at:', registryPath);
        return [];
      }

      const registryContent = fs.readFileSync(registryPath, 'utf8');
      const registry = JSON.parse(registryContent);

      const curatedTools = registry.curated_tools || [];
      console.log(`[StaticToolRegistry] Found ${curatedTools.length} curated tools in registry`);

      return curatedTools.map((tool: any) => this.createToolMetadataFromRegistry(tool));
    } catch (error) {
      console.error('[StaticToolRegistry] Error loading unified registry:', error);
      return [];
    }
  }

  /**
   * Load tools from Pipedream metadata
   */
  private async loadPipedreamTools(): Promise<ToolMetadata[]> {
    try {
      const pipedreamPath = path.join(process.cwd(), 'emery-agents', 'src', 'emery_agents', 'execution', 'tools', 'pipedream_metadata.json');
      console.log('[StaticToolRegistry] Loading Pipedream metadata from:', pipedreamPath);

      if (!fs.existsSync(pipedreamPath)) {
        console.warn('[StaticToolRegistry] Pipedream metadata file not found at:', pipedreamPath);
        return [];
      }

      const pipedreamContent = fs.readFileSync(pipedreamPath, 'utf8');
      const pipedreamMetadata = JSON.parse(pipedreamContent);

      const toolIds = Object.keys(pipedreamMetadata);
      console.log(`[StaticToolRegistry] Found ${toolIds.length} Pipedream tools in metadata`);

      return toolIds.map(toolId => this.createToolMetadataFromPipedream(toolId, pipedreamMetadata[toolId]));
    } catch (error) {
      console.error('[StaticToolRegistry] Error loading Pipedream metadata:', error);
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
    const allTools = await this.loadTools();
    const results = allTools
      .filter(tool => tool.matchesSearch(query))
      .slice(0, limit);

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