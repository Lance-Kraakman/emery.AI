/**
 * Tool Metadata Value Objects
 *
 * Provides metadata and categorization for tools throughout the system.
 * Used for display, filtering, and organizing tools in the UI.
 *
 * AIDEV-NOTE: Separates tool display concerns from tool execution configuration.
 * Enables rich tool categorization and filtering in tool selection interfaces.
 *
 * AIDEV-TODO: Add gRPC worker metadata integration fields:
 * - workerId?: string (which worker provides this tool)
 * - workerVersion?: string (version of worker providing tool)
 * - isRemote?: boolean (whether tool executes on remote worker)
 * - capabilities?: ToolCapability[] (what the tool can do)
 */

/**
 * Tool categories for organization and filtering
 * Unified system that includes both execution tools and data reference tools
 */
export enum ToolCategory {
  // Execution tools
  APPS = 'apps',               // External application integrations (Slack, Gmail, etc.)
  UTILITIES = 'utilities',     // General utility tools (calculator, web search, etc.)
  ORGANIZATIONAL = 'organizational', // Internal organizational tools (measurements, KPIs, etc.)
  BASE = 'base',              // Core system tools (Python REPL, file operations, etc.)

  // Data reference tools (formerly ReferenceCategory)
  DOCUMENTS = 'documents',     // Document references from tables
  FILES = 'files',            // File references from tables
  AGENTS = 'agents',          // AI agent references
  TABLES = 'tables',          // Database table references
  DATABASES = 'databases'     // Database references
}

/**
 * Connection requirements for tools
 */
export enum ConnectionType {
  NONE = 'none',              // No connection required
  API_KEY = 'api_key',        // Requires API key
  OAUTH = 'oauth'             // Requires OAuth authentication
}

/**
 * Tool metadata for display and categorization
 */
export class ToolMetadata {
  constructor(
    public readonly name: string,
    public readonly displayName: string,
    public readonly description: string,
    public readonly category: ToolCategory,
    public readonly requiresConnection: boolean,
    public readonly connectionType: ConnectionType,
    public readonly requiredApps: readonly string[] = [], // Apps like 'gmail', 'slack', 'github'
    public readonly icon?: string,
    public readonly tags: readonly string[] = [],
    // Auto-binding fields for reference-to-execution mapping
    public readonly mapsToReferences: readonly string[] = [], // ["@doc:", "@document:"]
    public readonly autoBindParameter?: string, // "document_id", "table_name", etc.
    // Extended metadata for implementation details
    public readonly extra?: {
      app?: string;
      appId?: string;
      appIconUrl?: string; // NEW: App icon URL (CDN or local path)
      supportsOAuth?: boolean;
      insertText?: string;
      supportsArtifacts?: boolean;
      implementation?: any;
      parameters?: Record<string, any>;
    }
  ) {
    if (!name?.trim()) {
      throw new Error('Tool name is required')
    }
    if (!displayName?.trim()) {
      throw new Error('Tool display name is required')
    }
    if (!description?.trim()) {
      throw new Error('Tool description is required')
    }
  }

  /**
   * Create basic tool metadata for utilities
   */
  static utility(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = [],
    extra?: ToolMetadata['extra']
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.UTILITIES,
      false,
      ConnectionType.NONE,
      [], // No required apps
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      extra
    )
  }

  /**
   * Create tool metadata for OAuth-based app integrations
   */
  static oauthApp(
    name: string,
    displayName: string,
    description: string,
    requiredApps: string[] = [],
    icon?: string,
    tags: string[] = [],
    extra?: ToolMetadata['extra']
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.APPS,
      true,
      ConnectionType.OAUTH,
      requiredApps,
      icon,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      extra
    )
  }

  /**
   * Create tool metadata for API key-based integrations
   */
  static apiKeyApp(
    name: string,
    displayName: string,
    description: string,
    requiredApps: string[] = [],
    icon?: string,
    tags: string[] = [],
    extra?: ToolMetadata['extra']
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.APPS,
      true,
      ConnectionType.API_KEY,
      requiredApps,
      icon,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      extra
    )
  }

  /**
   * Create tool metadata for document reference tools
   */
  static document(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = []
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.DOCUMENTS,
      false,
      ConnectionType.NONE,
      [],
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      undefined // extra
    )
  }

  /**
   * Create tool metadata for file reference tools
   */
  static file(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = []
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.FILES,
      false,
      ConnectionType.NONE,
      [],
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      undefined // extra
    )
  }

  /**
   * Create tool metadata for agent reference tools
   */
  static agent(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = []
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.AGENTS,
      false,
      ConnectionType.NONE,
      [],
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      undefined // extra
    )
  }

  /**
   * Create tool metadata for table reference tools
   */
  static table(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = []
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.TABLES,
      false,
      ConnectionType.NONE,
      [],
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      undefined // extra
    )
  }

  /**
   * Create tool metadata for database reference tools
   */
  static database(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = []
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.DATABASES,
      false,
      ConnectionType.NONE,
      [],
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      undefined // extra
    )
  }

  /**
   * Create tool metadata for organizational tools
   */
  static organizational(
    name: string,
    displayName: string,
    description: string,
    tags: string[] = []
  ): ToolMetadata {
    return new ToolMetadata(
      name,
      displayName,
      description,
      ToolCategory.ORGANIZATIONAL,
      false,
      ConnectionType.NONE,
      [], // No required apps
      undefined,
      tags,
      [], // mapsToReferences
      undefined, // autoBindParameter
      undefined // extra
    )
  }

  /**
   * Check if this tool has a specific tag
   */
  hasTag(tag: string): boolean {
    return this.tags.includes(tag.toLowerCase())
  }

  /**
   * Get display information for UI
   */
  getDisplayInfo(): {
    name: string
    displayName: string
    description: string
    category: string
    requiresConnection: boolean
    requiredApps: readonly string[]
    connectionBadge?: string
    icon?: string
    tags: readonly string[]
  } {
    return {
      name: this.name,
      displayName: this.displayName,
      description: this.description,
      category: this.category,
      requiresConnection: this.requiresConnection,
      requiredApps: this.requiredApps,
      connectionBadge: this.requiresConnection ? this.connectionType.toUpperCase() : undefined,
      icon: this.icon,
      tags: this.tags
    }
  }

  /**
   * Check if metadata matches search query
   */
  matchesSearch(query: string): boolean {
    const searchText = query.toLowerCase().trim()
    if (!searchText) return true

    return (
      this.name.toLowerCase().includes(searchText) ||
      this.displayName.toLowerCase().includes(searchText) ||
      this.description.toLowerCase().includes(searchText) ||
      this.tags.some(tag => tag.toLowerCase().includes(searchText))
    )
  }

  /**
   * Check if this tool supports auto-binding for a specific reference prefix
   */
  supportsReference(prefix: string): boolean {
    return this.mapsToReferences.includes(prefix);
  }

  /**
   * Check if this tool can auto-bind any references
   */
  get supportsAutoBinding(): boolean {
    return this.mapsToReferences.length > 0 && !!this.autoBindParameter;
  }

  /**
   * Get all reference prefixes this tool can handle
   */
  get supportedReferences(): readonly string[] {
    return this.mapsToReferences;
  }

  /**
   * Check if this metadata equals another
   */
  equals(other: ToolMetadata): boolean {
    return (
      this.name === other.name &&
      this.displayName === other.displayName &&
      this.description === other.description &&
      this.category === other.category &&
      this.requiresConnection === other.requiresConnection &&
      this.connectionType === other.connectionType &&
      this.requiredApps.length === other.requiredApps.length &&
      this.requiredApps.every((app, index) => app === other.requiredApps[index]) &&
      this.icon === other.icon &&
      this.tags.length === other.tags.length &&
      this.tags.every((tag, index) => tag === other.tags[index]) &&
      this.mapsToReferences.length === other.mapsToReferences.length &&
      this.mapsToReferences.every((ref, index) => ref === other.mapsToReferences[index]) &&
      this.autoBindParameter === other.autoBindParameter
    )
  }
}

/**
 * Tool category display information
 */
export interface ToolCategoryInfo {
  category: ToolCategory
  label: string
  description: string
  icon: string
}

/**
 * Standard tool category information for UI display
 */
export const TOOL_CATEGORY_INFO: Record<ToolCategory, ToolCategoryInfo> = {
  [ToolCategory.APPS]: {
    category: ToolCategory.APPS,
    label: 'Apps',
    description: 'External application integrations (Gmail, Slack, etc.)',
    icon: 'grid-3x3'
  },
  [ToolCategory.UTILITIES]: {
    category: ToolCategory.UTILITIES,
    label: 'Utilities',
    description: 'General purpose utility tools',
    icon: 'wrench'
  },
  [ToolCategory.ORGANIZATIONAL]: {
    category: ToolCategory.ORGANIZATIONAL,
    label: 'Organizational',
    description: 'Internal tools for measurements, KPIs, and analysis',
    icon: 'building'
  },
  [ToolCategory.BASE]: {
    category: ToolCategory.BASE,
    label: 'System',
    description: 'Core system tools and operations',
    icon: 'terminal'
  },
  [ToolCategory.DOCUMENTS]: {
    category: ToolCategory.DOCUMENTS,
    label: 'Documents',
    description: 'Document references from your organization',
    icon: 'file-text'
  },
  [ToolCategory.FILES]: {
    category: ToolCategory.FILES,
    label: 'Files',
    description: 'File references from your tables',
    icon: 'file'
  },
  [ToolCategory.AGENTS]: {
    category: ToolCategory.AGENTS,
    label: 'Agents',
    description: 'AI agent references',
    icon: 'bot'
  },
  [ToolCategory.TABLES]: {
    category: ToolCategory.TABLES,
    label: 'Tables',
    description: 'Database table references',
    icon: 'table'
  },
  [ToolCategory.DATABASES]: {
    category: ToolCategory.DATABASES,
    label: 'Databases',
    description: 'Database references',
    icon: 'database'
  }
} as const

/**
 * Get category info for a specific category
 */
export function getCategoryInfo(category: ToolCategory): ToolCategoryInfo {
  return TOOL_CATEGORY_INFO[category]
}

/**
 * Get all category options for UI display
 */
export function getAllCategories(): ToolCategoryInfo[] {
  return Object.values(TOOL_CATEGORY_INFO)
}