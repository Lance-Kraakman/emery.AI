/**
 * Tool Configuration Value Object
 *
 * Core value object for tool configuration across the system.
 * Moved from agents domain to tools domain for proper separation of concerns.
 *
 * AIDEV-NOTE: This VO is shared between agents, chat, and infrastructure layers.
 * Provides type safety, validation, and immutability for tool configurations.
 * Extended with specific config types for different tool categories.
 */

import type { InputDefinition } from '@/ddd/domain/skills/entities/skill'

/**
 * Base configuration interface
 */
export interface BaseToolConfig {
  [key: string]: any
}

/**
 * Agent tool configuration - references an existing agent
 */
export interface AgentToolConfig extends BaseToolConfig {
  agentId: number  // Will be converted to AgentId in domain layer
  organizationId: number
  ownerId: string
}

/**
 * Table tool configuration - references a dynamic table
 */
export interface TableToolConfig extends BaseToolConfig {
  tableId: number
  organizationId: number
  tableName?: string
  hasHeaders?: boolean
}

/**
 * Document tool configuration - references a document/file
 */
export interface DocumentToolConfig extends BaseToolConfig {
  documentId: string
  filename: string
  mimeType: string
  organizationId: number
  tableId: number
  fieldId: number
  rowId: string
  path?: string
  size?: number
}

/**
 * File tool configuration - references a file
 */
export interface FileToolConfig extends BaseToolConfig {
  fileId: string
  filename: string
  mimeType: string
  organizationId: number
  tableId: number
  fieldId: number
  rowId: string
  path?: string
  size?: number
  uploadedBy?: string
}

/**
 * Database tool configuration - references a database connection
 */
export interface DatabaseToolConfig extends BaseToolConfig {
  databaseId: string
  connectionString?: string
  schemaName?: string
  organizationId: number
  readOnly?: boolean
}

/**
 * Skill tool configuration - references a reusable AI skill
 */
export interface SkillToolConfig extends BaseToolConfig {
  skillId: number
  organizationId: number
  agentId?: number // Optional: null for org skills, number for agent-scoped skills
  inputs?: InputDefinition[] // Skill inputs for parameter placeholders
}

/**
 * OAuth tool configuration - for external app integrations
 */
export interface OAuthToolConfig extends BaseToolConfig {
  oauth_token: string
  refresh_token?: string
  expires_at?: string
  scope?: string
  organizationId: number
  userId: string
}

/**
 * API Key tool configuration - for API-based integrations
 */
export interface ApiKeyToolConfig extends BaseToolConfig {
  api_key: string
  organizationId: number
  userId: string
  endpoint?: string
}

/**
 * Union type for all possible tool configurations
 */
export type ToolConfigData =
  | AgentToolConfig
  | TableToolConfig
  | DocumentToolConfig
  | FileToolConfig
  | DatabaseToolConfig
  | SkillToolConfig
  | OAuthToolConfig
  | ApiKeyToolConfig
  | BaseToolConfig

export class ToolConfig {
  constructor(
    public readonly name: string,
    public readonly config: ToolConfigData
  ) {
    if (!name || name.trim() === '') {
      throw new Error('Tool name is required and cannot be empty')
    }
    if (typeof config !== 'object' || config === null) {
      throw new Error('Tool config must be a valid object')
    }
  }

  /**
   * Create a ToolConfig with standard defaults
   */
  static create(name: string, config: ToolConfigData = {}): ToolConfig {
    return new ToolConfig(name, config)
  }

  /**
   * Create a basic tool configuration for common tools
   */
  static basic(name: string, config: BaseToolConfig = {}): ToolConfig {
    return new ToolConfig(name, config)
  }

  /**
   * Create an agent tool configuration
   */
  static agent(
    name: string,
    agentId: number,
    organizationId: number,
    ownerId: string,
    version: string = '1.0'
  ): ToolConfig {
    const config: AgentToolConfig = {
      agentId,
      organizationId,
      ownerId
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create a table tool configuration
   */
  static table(
    name: string,
    tableId: number,
    organizationId: number,
    tableName?: string,
    version: string = '1.0'
  ): ToolConfig {
    const config: TableToolConfig = {
      tableId,
      organizationId,
      ...(tableName && { tableName })
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create a document tool configuration
   */
  static document(
    name: string,
    documentId: string,
    filename: string,
    mimeType: string,
    organizationId: number,
    tableId: number,
    fieldId: number,
    rowId: string,
    version: string = '1.0'
  ): ToolConfig {
    const config: DocumentToolConfig = {
      documentId,
      filename,
      mimeType,
      organizationId,
      tableId,
      fieldId,
      rowId
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create a file tool configuration
   */
  static file(
    name: string,
    fileId: string,
    filename: string,
    mimeType: string,
    organizationId: number,
    tableId: number,
    fieldId: number,
    rowId: string,
    version: string = '1.0'
  ): ToolConfig {
    const config: FileToolConfig = {
      fileId,
      filename,
      mimeType,
      organizationId,
      tableId,
      fieldId,
      rowId
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create a database tool configuration
   */
  static database(
    name: string,
    databaseId: string,
    organizationId: number,
    version: string = '1.0'
  ): ToolConfig {
    const config: DatabaseToolConfig = {
      databaseId,
      organizationId
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create a skill tool configuration
   */
  static skill(
    name: string,
    skillId: number,
    organizationId: number,
    agentId?: number,
    version: string = '1.0',
    inputs?: InputDefinition[]
  ): ToolConfig {
    const config: SkillToolConfig = {
      skillId,
      organizationId,
      agentId,
      inputs
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create an OAuth tool configuration
   */
  static oauth(
    name: string,
    oauthToken: string,
    organizationId: number,
    userId: string,
    version: string = '1.0'
  ): ToolConfig {
    const config: OAuthToolConfig = {
      oauth_token: oauthToken,
      organizationId,
      userId
    }
    return new ToolConfig(name, config)
  }

  /**
   * Create a tool configuration with API key for OAuth tools
   */
  static withApiKey(
    name: string,
    apiKey: string,
    organizationId: number,
    userId: string,
    version: string = '1.0'
  ): ToolConfig {
    const config: ApiKeyToolConfig = {
      api_key: apiKey,
      organizationId,
      userId
    }
    return new ToolConfig(name, config)
  }

  /**
   * Check if this tool requires a connection (OAuth, API key, etc.)
   */
  get requiresConnection(): boolean {
    const config = this.config as any
    return !!(config.api_key || config.oauth_token)
  }

  /**
   * Get the connection type for this tool
   */
  get connectionType(): 'oauth' | 'api_key' | 'none' {
    const config = this.config as any
    if (config.oauth_token) return 'oauth'
    if (config.api_key) return 'api_key'
    return 'none'
  }

  /**
   * Type guards for specific config types
   */
  isAgentTool(): this is ToolConfig & { config: AgentToolConfig } {
    return 'agentId' in this.config && typeof this.config.agentId === 'number'
  }

  isTableTool(): this is ToolConfig & { config: TableToolConfig } {
    return 'tableId' in this.config && typeof this.config.tableId === 'number'
  }

  isDocumentTool(): this is ToolConfig & { config: DocumentToolConfig } {
    return 'documentId' in this.config && typeof this.config.documentId === 'string'
  }

  isFileTool(): this is ToolConfig & { config: FileToolConfig } {
    return 'fileId' in this.config && typeof this.config.fileId === 'string'
  }

  isDatabaseTool(): this is ToolConfig & { config: DatabaseToolConfig } {
    return 'databaseId' in this.config && typeof this.config.databaseId === 'string'
  }

  isSkillTool(): this is ToolConfig & { config: SkillToolConfig } {
    return 'skillId' in this.config && typeof this.config.skillId === 'number'
  }

  isOAuthTool(): this is ToolConfig & { config: OAuthToolConfig } {
    return 'oauth_token' in this.config && typeof this.config.oauth_token === 'string'
  }

  isApiKeyTool(): this is ToolConfig & { config: ApiKeyToolConfig } {
    return 'api_key' in this.config && typeof this.config.api_key === 'string'
  }

  /**
   * Get typed config for specific tool types
   */
  getAgentConfig(): AgentToolConfig | null {
    return this.isAgentTool() ? this.config : null
  }

  getTableConfig(): TableToolConfig | null {
    return this.isTableTool() ? this.config : null
  }

  getDocumentConfig(): DocumentToolConfig | null {
    return this.isDocumentTool() ? this.config : null
  }

  getFileConfig(): FileToolConfig | null {
    return this.isFileTool() ? this.config : null
  }

  getDatabaseConfig(): DatabaseToolConfig | null {
    return this.isDatabaseTool() ? this.config : null
  }

  getSkillConfig(): SkillToolConfig | null {
    return this.isSkillTool() ? this.config : null
  }

  getOAuthConfig(): OAuthToolConfig | null {
    return this.isOAuthTool() ? this.config : null
  }

  getApiKeyConfig(): ApiKeyToolConfig | null {
    return this.isApiKeyTool() ? this.config : null
  }

  /**
   * Create a copy with updated configuration
   */
  withConfig(additionalConfig: Partial<ToolConfigData>): ToolConfig {
    return new ToolConfig(
      this.name,
      { ...this.config, ...additionalConfig }
    )
  }

  /**
   * Check if this tool matches another by name (version-agnostic)
   */
  matchesName(other: ToolConfig): boolean {
    return this.name.toLowerCase() === other.name.toLowerCase()
  }

  /**
   * Check if this tool is exactly the same as another (name + version)
   */
  equals(other: ToolConfig): boolean {
    return this.name === other.name
  }

  /**
   * Convert to plain object for serialization
   */
  toPlain(): { name: string; config: ToolConfigData } {
    return {
      name: this.name,
      config: { ...this.config }
    }
  }

  /**
   * Create from plain object (for deserialization)
   */
  static fromPlain(plain: { name: string; config?: ToolConfigData }): ToolConfig {
    return new ToolConfig(
      plain.name,
      plain.config || {}
    )
  }
}
