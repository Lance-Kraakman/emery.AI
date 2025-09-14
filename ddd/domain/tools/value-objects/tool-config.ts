/**
 * Tool Configuration Value Object
 *
 * Core value object for tool configuration across the system.
 * Moved from agents domain to tools domain for proper separation of concerns.
 *
 * AIDEV-NOTE: This VO is shared between agents, chat, and infrastructure layers.
 * Provides type safety, validation, and immutability for tool configurations.
 */

export class ToolConfig {
  constructor(
    public readonly name: string,
    public readonly version: string,
    public readonly config: Record<string, any>
  ) {
    if (!name?.trim()) {
      throw new Error('Tool name is required and cannot be empty')
    }
    if (!version?.trim()) {
      throw new Error('Tool version is required and cannot be empty')
    }
    if (typeof config !== 'object' || config === null) {
      throw new Error('Tool config must be a valid object')
    }
  }

  /**
   * Create a ToolConfig with standard defaults
   */
  static create(name: string, version: string = '1.0', config: Record<string, any> = {}): ToolConfig {
    return new ToolConfig(name, version, config)
  }

  /**
   * Create a basic tool configuration for common tools
   */
  static basic(name: string, config: Record<string, any> = {}): ToolConfig {
    return new ToolConfig(name, '1.0', config)
  }

  /**
   * Create a tool configuration with API key for OAuth tools
   */
  static withApiKey(name: string, apiKey: string, version: string = '1.0'): ToolConfig {
    return new ToolConfig(name, version, { agent_api_key: apiKey })
  }

  /**
   * Check if this tool requires a connection (OAuth, API key, etc.)
   */
  get requiresConnection(): boolean {
    return !!(this.config.agent_api_key || this.config.oauth_token || this.config.api_key)
  }

  /**
   * Get the connection type for this tool
   */
  get connectionType(): 'oauth' | 'api_key' | 'none' {
    if (this.config.oauth_token) return 'oauth'
    if (this.config.agent_api_key || this.config.api_key) return 'api_key'
    return 'none'
  }

  /**
   * Create a copy with updated configuration
   */
  withConfig(additionalConfig: Record<string, any>): ToolConfig {
    return new ToolConfig(
      this.name,
      this.version,
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
    return this.name === other.name && this.version === other.version
  }

  /**
   * Convert to plain object for serialization
   */
  toPlain(): { name: string; version: string; config: Record<string, any> } {
    return {
      name: this.name,
      version: this.version,
      config: { ...this.config }
    }
  }

  /**
   * Create from plain object (for deserialization)
   */
  static fromPlain(plain: { name: string; version?: string; config?: Record<string, any> }): ToolConfig {
    return new ToolConfig(
      plain.name,
      plain.version || '1.0',
      plain.config || {}
    )
  }
}

// Legacy interface for backward compatibility during migration
export interface ToolConfigInterface {
  name: string;
  version?: string;
  config?: Record<string, any>;
}

/**
 * Convert legacy interface to ToolConfig value object
 */
export function toolConfigFromInterface(config: ToolConfigInterface): ToolConfig {
  return ToolConfig.create(config.name, config.version, config.config)
}

/**
 * Convert ToolConfig value object to legacy interface
 */
export function toolConfigToInterface(toolConfig: ToolConfig): ToolConfigInterface {
  return {
    name: toolConfig.name,
    version: toolConfig.version,
    config: toolConfig.config
  }
}