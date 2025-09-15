/**
 * Base Tool Entity
 *
 * Core tool entity that contains ToolConfig and ToolMetadata.
 * Provides common tool behavior and serves as base class for specialized tools.
 *
 * AIDEV-NOTE: This is the base class for all tools in the system.
 * ReferenceTool extends this for data references, while system execution tools
 * use this class directly. Fixes architectural issue where system tools were
 * incorrectly converted to fake ReferenceTool instances.
 */

import { ToolConfig } from '../value-objects/tool-config'
import { ToolMetadata, ToolCategory } from '../value-objects/tool-metadata'

/**
 * Base Tool entity - contains core tool configuration and metadata
 */
export class Tool {
  constructor(
    public readonly toolConfig: ToolConfig,
    public readonly toolMetadata: ToolMetadata
  ) {
    // Validate that tool config name matches metadata name
    if (toolConfig.name !== toolMetadata.name) {
      throw new Error('Tool config name must match metadata name')
    }
  }

  /**
   * Get display information for UI components
   */
  getDisplayInfo(): {
    name: string
    displayName: string
    description: string
    category: string
    icon?: string
    requiresConnection: boolean
    tags: readonly string[]
  } {
    return this.toolMetadata.getDisplayInfo()
  }

  /**
   * Check if this tool is available for use
   */
  isAvailable(): boolean {
    // Base implementation - can be overridden by subclasses
    return true
  }

  /**
   * Check if this tool requires a connection/authentication
   */
  requiresConnection(): boolean {
    return this.toolMetadata.requiresConnection
  }

  /**
   * Get the tool category
   */
  getCategory(): ToolCategory {
    return this.toolMetadata.category
  }

  /**
   * Get the tool name
   */
  getName(): string {
    return this.toolConfig.name
  }

  /**
   * Get the tool version
   */
  getVersion(): string {
    return this.toolConfig.version
  }

  /**
   * Check if this tool can be used in chat interfaces
   */
  canBeUsedInChat(): boolean {
    // Base implementation - execution tools can be used in chat
    return true
  }

  /**
   * Check if this tool supports artifact generation
   */
  supportsArtifacts(): boolean {
    // Base implementation - most tools don't support artifacts
    return false
  }

  /**
   * Check if this tool equals another tool
   */
  equals(other: Tool): boolean {
    return this.toolConfig.equals(other.toolConfig) &&
           this.toolMetadata.equals(other.toolMetadata)
  }

  /**
   * Create a system execution tool from ToolMetadata
   */
  static fromMetadata(toolMetadata: ToolMetadata, customConfig: Record<string, any> = {}): Tool {
    const toolConfig = ToolConfig.create(
      toolMetadata.name,
      '1.0',
      {
        displayName: toolMetadata.displayName,
        description: toolMetadata.description,
        category: toolMetadata.category,
        requiresConnection: toolMetadata.requiresConnection,
        connectionType: toolMetadata.connectionType,
        ...customConfig
      }
    )

    return new Tool(toolConfig, toolMetadata)
  }
}

/**
 * Type guard to check if a tool is a base Tool (not a specialized tool)
 */
export function isBaseTool(tool: Tool): tool is Tool {
  return tool.constructor === Tool
}