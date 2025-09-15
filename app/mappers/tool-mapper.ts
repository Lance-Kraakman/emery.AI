import type { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { ConnectionDTO } from './connection-mapper';

/**
 * Tool Data Transfer Object for Frontend
 *
 * Represents tools in a format optimized for UI consumption.
 * Separates domain concerns from presentation logic.
 */
export interface ToolDTO {
  /** Unique tool identifier */
  id: string;
  /** Tool name (e.g., 'document_reader', 'slack_send_message') */
  name: string;
  /** Tool version */
  version: string;
  /** Display-friendly title */
  title: string;
  /** Tool description for UI */
  description?: string;
  /** Tool category for grouping */
  category: ToolCategoryType;
  /** Tool type for icon/behavior selection */
  type: ToolType;
  /** Whether tool requires OAuth connection */
  requiresConnection: boolean;
  /** Connection app name if applicable */
  appName?: string;
  /** Connection status for tools requiring OAuth */
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'unknown';
  /** Tool configuration for UI display */
  config: ToolConfigDTO;
  /** Whether tool can be opened as artifact */
  canOpenArtifact: boolean;
}

/**
 * Tool category types for UI organization
 */
export type ToolCategoryType = 'references' | 'apps' | 'utilities' | 'integrations';

/**
 * Tool types for UI behavior and icons
 */
export type ToolType = 'document' | 'file' | 'table' | 'agent' | 'oauth_app' | 'webhook' | 'utility' | 'integration';

/**
 * Tool configuration DTO for UI display
 */
export interface ToolConfigDTO {
  /** Configuration title */
  title?: string;
  /** Configuration name */
  name?: string;
  /** Tool type */
  type?: string;
  /** Reference ID for domain tools */
  id?: string;
  /** Reference ID for lookups */
  reference_id?: string;
  /** Original match text for references */
  original_match?: string;
  /** Table ID for table-related tools */
  tableId?: string;
  /** Field ID for field-related tools */
  fieldId?: string;
  /** File URL for file tools */
  fileUrl?: string;
  /** App name for OAuth tools */
  app?: string;
  /** Additional configuration data */
  [key: string]: any;
}

/**
 * Tool category DTO for UI organization
 */
export interface ToolCategoryDTO {
  /** Category identifier */
  name: ToolCategoryType;
  /** Display label */
  label: string;
  /** Category icon (React component name or icon identifier) */
  icon: string;
  /** Tools in this category */
  tools: ToolDTO[];
  /** Category description */
  description?: string;
  /** Whether category is expanded by default */
  expanded?: boolean;
}

/**
 * Tool selection state DTO
 */
export interface ToolSelectionDTO {
  /** Selected tools */
  selectedTools: ToolDTO[];
  /** Available tool categories */
  availableCategories: ToolCategoryDTO[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Tool Mapper - converts between domain objects and DTOs
 */
export class ToolMapper {
  /**
   * Convert domain ToolConfig to frontend ToolDTO
   */
  static toDTO(toolConfig: ToolConfig, connectionStatus?: ConnectionDTO): ToolDTO {
    // Determine tool category and type from name and config
    const category = this.determineCategory(toolConfig);
    const type = this.determineType(toolConfig);
    const requiresConnection = this.requiresConnection(toolConfig);
    const canOpenArtifact = this.canOpenArtifact(toolConfig);

    return {
      id: `${toolConfig.name}-${toolConfig.version}`,
      name: toolConfig.name,
      version: toolConfig.version,
      title: toolConfig.config.title || toolConfig.config.name || toolConfig.name,
      description: this.generateDescription(toolConfig),
      category,
      type,
      requiresConnection,
      appName: this.extractAppName(toolConfig),
      connectionStatus: connectionStatus?.status as any || (requiresConnection ? 'unknown' : undefined),
      config: {
        title: toolConfig.config.title,
        name: toolConfig.config.name,
        type: toolConfig.config.type,
        id: toolConfig.config.id,
        reference_id: toolConfig.config.reference_id,
        original_match: toolConfig.config.original_match,
        ...toolConfig.config
      },
      canOpenArtifact
    };
  }

  /**
   * Convert array of domain ToolConfigs to DTOs
   */
  static toDTOArray(toolConfigs: ToolConfig[], connections?: ConnectionDTO[]): ToolDTO[] {
    return toolConfigs.map(toolConfig => {
      const appName = this.extractAppName(toolConfig);
      const connection = appName ? connections?.find(c => c.app === appName) : undefined;
      return this.toDTO(toolConfig, connection);
    });
  }

  /**
   * Create tool category DTOs from tool DTOs
   */
  static createCategoryDTOs(tools: ToolDTO[]): ToolCategoryDTO[] {
    const categories: Record<ToolCategoryType, ToolDTO[]> = {
      references: [],
      apps: [],
      utilities: [],
      integrations: []
    };

    // Group tools by category
    tools.forEach(tool => {
      categories[tool.category].push(tool);
    });

    // Convert to category DTOs
    return Object.entries(categories)
      .filter(([, tools]) => tools.length > 0)
      .map(([categoryName, categoryTools]) => ({
        name: categoryName as ToolCategoryType,
        label: this.getCategoryLabel(categoryName as ToolCategoryType),
        icon: this.getCategoryIcon(categoryName as ToolCategoryType),
        tools: categoryTools,
        description: this.getCategoryDescription(categoryName as ToolCategoryType),
        expanded: true
      }));
  }

  /**
   * Determine tool category from ToolConfig
   */
  private static determineCategory(toolConfig: ToolConfig): ToolCategoryType {
    const name = toolConfig.name.toLowerCase();
    const configType = toolConfig.config.type?.toLowerCase();

    // Reference tools (documents, files, tables, agents)
    if (name.includes('document') || name.includes('file') ||
        name.includes('table') || name.includes('agent') ||
        configType === 'document' || configType === 'file') {
      return 'references';
    }

    // OAuth app tools
    if (name.includes('slack') || name.includes('gmail') || name.includes('github') ||
        name.includes('discord') || name.includes('twitter') || name.includes('sheets')) {
      return 'apps';
    }

    // Webhook/integration tools
    if (name.includes('webhook') || name.includes('pipedream') || name.includes('zapier')) {
      return 'integrations';
    }

    // Default to utilities
    return 'utilities';
  }

  /**
   * Determine tool type from ToolConfig
   */
  private static determineType(toolConfig: ToolConfig): ToolType {
    const name = toolConfig.name.toLowerCase();
    const configType = toolConfig.config.type?.toLowerCase();

    if (name.includes('document') || configType === 'document') return 'document';
    if (name.includes('file') || configType === 'file') return 'file';
    if (name.includes('table') || configType === 'table') return 'table';
    if (name.includes('agent') || configType === 'agent') return 'agent';
    if (name.includes('webhook')) return 'webhook';

    // OAuth apps
    if (name.includes('slack') || name.includes('gmail') || name.includes('github') ||
        name.includes('discord') || name.includes('twitter') || name.includes('sheets')) {
      return 'oauth_app';
    }

    return 'utility';
  }

  /**
   * Check if tool requires OAuth connection
   */
  private static requiresConnection(toolConfig: ToolConfig): boolean {
    const name = toolConfig.name.toLowerCase();
    return name.includes('slack') || name.includes('gmail') || name.includes('github') ||
           name.includes('discord') || name.includes('twitter') || name.includes('sheets');
  }

  /**
   * Check if tool can be opened as artifact
   */
  private static canOpenArtifact(toolConfig: ToolConfig): boolean {
    const configType = toolConfig.config.type?.toLowerCase();
    return configType === 'document' || configType === 'file';
  }

  /**
   * Extract app name for connection lookup
   */
  private static extractAppName(toolConfig: ToolConfig): string | undefined {
    const name = toolConfig.name.toLowerCase();

    if (name.includes('slack')) return 'slack';
    if (name.includes('gmail')) return 'gmail';
    if (name.includes('github')) return 'github';
    if (name.includes('discord')) return 'discord';
    if (name.includes('twitter')) return 'twitter';
    if (name.includes('sheets')) return 'google-sheets';

    return toolConfig.config.app;
  }

  /**
   * Generate description for tool
   */
  private static generateDescription(toolConfig: ToolConfig): string {
    const configType = toolConfig.config.type;
    const title = toolConfig.config.title || toolConfig.config.name;

    if (configType === 'document' && title) {
      return `Document: ${title}`;
    }
    if (configType === 'file' && title) {
      return `File: ${title}`;
    }
    if (toolConfig.name.includes('slack')) {
      return 'Send messages and manage Slack workspace';
    }
    if (toolConfig.name.includes('gmail')) {
      return 'Send emails and manage Gmail inbox';
    }

    return `${toolConfig.name} tool`;
  }

  /**
   * Get category label for display
   */
  private static getCategoryLabel(category: ToolCategoryType): string {
    const labels: Record<ToolCategoryType, string> = {
      references: 'References',
      apps: 'Connected Apps',
      utilities: 'Utilities',
      integrations: 'Integrations'
    };
    return labels[category];
  }

  /**
   * Get category icon identifier
   */
  private static getCategoryIcon(category: ToolCategoryType): string {
    const icons: Record<ToolCategoryType, string> = {
      references: 'Database',
      apps: 'Users',
      utilities: 'BarChart',
      integrations: 'Zap'
    };
    return icons[category];
  }

  /**
   * Get category description
   */
  private static getCategoryDescription(category: ToolCategoryType): string {
    const descriptions: Record<ToolCategoryType, string> = {
      references: 'Documents, files, and data from your tables',
      apps: 'OAuth-connected applications like Slack and Gmail',
      utilities: 'Built-in tools and analyzers',
      integrations: 'Webhooks and third-party integrations'
    };
    return descriptions[category];
  }
}