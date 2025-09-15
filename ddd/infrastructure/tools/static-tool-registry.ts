/**
 * Static Tool Registry Implementation
 *
 * Basic implementation of tool registry that provides a curated set of tools.
 * Future versions can extend this to support dynamic tool discovery.
 *
 * AIDEV-NOTE: Simple implementation to get agents using proper tool registry.
 * Can be extended later with database storage, Python tool discovery, etc.
 */

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
  private readonly tools: ToolMetadata[] = [
    // Base system tools
    ToolMetadata.utility(
      'python_repl',
      'Python REPL',
      'Execute Python code in a sandboxed environment',
      ['python', 'code', 'calculation']
    ),
    ToolMetadata.utility(
      'web_search',
      'Web Search',
      'Search the web for current information',
      ['search', 'web', 'research']
    ),
    ToolMetadata.utility(
      'data_analyzer',
      'Data Analyzer',
      'Analyze CSV, JSON, and other data formats',
      ['data', 'analysis', 'csv', 'json']
    ),

    // OAuth app tools
    ToolMetadata.oauthApp(
      'slack_send_message',
      'Slack Message',
      'Send messages to Slack channels and users',
      'slack',
      ['slack', 'messaging', 'communication']
    ),
    ToolMetadata.oauthApp(
      'gmail_send_email',
      'Gmail Email',
      'Send emails via Gmail',
      'gmail',
      ['email', 'gmail', 'communication']
    ),
    ToolMetadata.oauthApp(
      'github_repo_manager',
      'GitHub Repository',
      'Manage GitHub repositories, issues, and pull requests',
      'github',
      ['github', 'repository', 'code', 'version-control']
    ),
    ToolMetadata.oauthApp(
      'google_sheets',
      'Google Sheets',
      'Read and write Google Sheets spreadsheets',
      'google-sheets',
      ['spreadsheet', 'data', 'google', 'sheets']
    ),

    // Organizational tools
    ToolMetadata.organizational(
      'measurement_tracker',
      'Measurement Tracker',
      'Track and calculate organizational measurements',
      ['measurement', 'kpi', 'tracking']
    ),
    ToolMetadata.organizational(
      'process_analyzer',
      'Process Analyzer',
      'Analyze business processes and workflows',
      ['process', 'workflow', 'analysis']
    ),
    ToolMetadata.organizational(
      'report_generator',
      'Report Generator',
      'Generate reports from organizational data',
      ['report', 'document', 'generation']
    ),

    // Reference tools (will be populated dynamically from user data)
    ToolMetadata.reference(
      'document_reader',
      'Document Reader',
      'Read and analyze documents from your organization',
      ['document', 'read', 'analysis']
    ),
    ToolMetadata.reference(
      'file_reader',
      'File Reader',
      'Read and process files from your tables',
      ['file', 'read', 'process']
    ),
    ToolMetadata.reference(
      'table_query',
      'Table Query',
      'Query data from your organization tables',
      ['table', 'query', 'data']
    )
  ];

  async discoverTools(options: ToolDiscoveryOptions): Promise<ToolDiscoveryResult> {
    let filteredTools = [...this.tools];

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
    return this.tools.find(tool => tool.name === toolName) || null;
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
    return this.tools.filter(tool => tool.category === category);
  }

  async searchTools(query: string, limit = 20): Promise<ToolMetadata[]> {
    const results = this.tools
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
    const categories = new Set(this.tools.map(tool => tool.category));
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