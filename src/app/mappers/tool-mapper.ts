/**
 * Tool Mapper
 *
 * Maps between Tool domain entities and DTOs for API responses.
 * Handles base Tool instances (system execution tools).
 *
 * AIDEV-NOTE: This mapper handles base Tool instances for system tools like
 * python_repl, web_search, etc. ReferenceTool has its own mapper since it
 * requires additional reference-specific mapping logic.
 */

import { Tool } from '@/ddd/domain/tools/entities/tool'
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config'
import { ToolMetadata, ToolCategory, ConnectionType } from '@/ddd/domain/tools/value-objects/tool-metadata'
import type { ToolDefinitionData } from '@/lib/db/schema'

// Export domain types for UI use
export { ToolCategory, ConnectionType } from '@/ddd/domain/tools/value-objects/tool-metadata'

/**
 * Universal DTO for all tool types (system and reference tools)
 * Replaces separate ToolDTO and ReferenceToolDTO interfaces
 */
export interface ToolDTO {
  // Core identification
  name: string
  displayName: string
  description: string
  category: ToolCategory
  version: string

  // UI properties
  icon?: string
  tags: readonly string[]
  requiresConnection: boolean
  connectionType: ConnectionType
  supportsArtifacts: boolean

  // Tool type discrimination
  type: 'system' | 'reference'

  // Configuration (static tool definition)
  // Contains parameters, implementation details, UI config
  // Constructed from toolMetadata.extra for both system and reference tools
  config: ToolDefinitionData

  // System tool properties
  requiredApps?: readonly string[]

  // Reference tool properties (optional, only for reference tools)
  id?: string              // For @ mentions and reference identification
  insertText?: string      // For @ mentions in chat
  organizationId?: number  // For reference tools scoped to organization

  // Runtime values for different reference tool types (from ToolConfigData)
  // Agent tools
  agentId?: number
  ownerId?: string

  // Table tools
  tableId?: string | number
  tableName?: string

  // Document tools
  documentId?: string

  // File tools
  fileId?: string
  filename?: string
  mimeType?: string

  // Common for document/file tools
  fieldId?: number
  rowId?: string

  // Database tools
  databaseId?: string

  // Skill tools
  skillId?: number
}

/**
 * DTO for unified tool search results
 */
export interface ToolSearchResultDTO {
  tools: ToolDTO[]  // Single unified array of all tool types
  hasMore: boolean
  totalCount: number
}



export class ToolMapper {
  /**
   * Convert Tool entity to DTO
   */
  static toDTO(tool: Tool): ToolDTO {
    // Extract definition from toolMetadata.extra (where it's stored from DB)
    const extra = tool.toolMetadata.extra || {};

    return {
      name: tool.getName(),
      displayName: tool.toolMetadata.displayName,
      description: tool.toolMetadata.description,
      category: tool.toolMetadata.category,
      version: '', // Empty version since Tool no longer has getVersion()
      icon: tool.toolMetadata.icon,
      tags: tool.toolMetadata.tags,
      requiresConnection: tool.requiresConnection(),
      connectionType: tool.toolMetadata.connectionType,
      supportsArtifacts: tool.supportsArtifacts(),
      type: 'system',
      // Construct ToolDefinitionData from metadata.extra
      config: {
        type: (extra.implementation as any)?.type || 'system',
        parameters: extra.parameters || {},
        implementation: extra.implementation || { backend_class: tool.getName(), requires_auth: false },
        ui_config: {
          insert_text: extra.insertText || `@tool:${tool.getName()}`,
          supports_artifacts: extra.supportsArtifacts
        }
      } as ToolDefinitionData,
      requiredApps: tool.toolMetadata.requiredApps
      // Reference tool properties remain undefined for system tools
    }
  }

  /**
   * Convert multiple Tool entities to DTOs
   */
  static toDTOs(tools: Tool[]): ToolDTO[] {
    return tools.map(tool => this.toDTO(tool))
  }

  /**
   * Create Tool entity from DTO (for deserialization)
   */
  static fromDTO(dto: ToolDTO): Tool {
    const toolConfig = ToolConfig.create(dto.name, dto.config)
    const toolMetadata = new ToolMetadata(
      dto.name,
      dto.displayName,
      dto.description,
      dto.category,
      dto.requiresConnection,
      dto.connectionType,
      dto.requiredApps || [], // requiredApps from DTO or empty array
      dto.icon,
      dto.tags
    )

    return new Tool(toolConfig, toolMetadata)
  }

  /**
   * Create multiple Tool entities from DTOs
   */
  static fromDTOs(dtos: ToolDTO[]): Tool[] {
    return dtos.map(dto => this.fromDTO(dto))
  }

}