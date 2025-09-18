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
import { UserId } from '@/src/ddd/domain/shared/value-objects'
import type { ConnectionApplicationService } from '@/src/ddd/application/services/connections/connection-application-service'

/**
 * Connection validation result
 */
export interface ConnectionValidationResult {
  valid: boolean
  warnings: string[]
  missingConnections: string[]
  ownerName?: string
}

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
   * Validate owner connections for this tool (non-blocking)
   */
  async validateOwnerConnections(
    ownerId: UserId,
    connectionService?: ConnectionApplicationService
  ): Promise<ConnectionValidationResult> {
    if (!this.requiresConnection()) {
      return {
        valid: true,
        warnings: [],
        missingConnections: []
      }
    }

    if (!connectionService) {
      return {
        valid: false,
        warnings: ['Connection validation service not available'],
        missingConnections: this.toolMetadata.requiredApps.slice()
      }
    }

    try {
      // Check which required apps are missing connections for the owner
      const missingApps = await connectionService.getMissingConnections(
        ownerId,
        this.toolMetadata.requiredApps.slice()
      )

      const missingAppNames = missingApps.map(app => app.value)
      const warnings = missingAppNames.map(app =>
        `Owner missing ${app} connection for ${this.toolMetadata.displayName}`
      )

      return {
        valid: missingAppNames.length === 0,
        warnings,
        missingConnections: missingAppNames
      }
    } catch (error) {
      console.error('Error validating tool connections:', error)
      return {
        valid: false,
        warnings: ['Failed to validate connections'],
        missingConnections: this.toolMetadata.requiredApps.slice()
      }
    }
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