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

import { Tool } from '@/src/ddd/domain/tools/entities/tool'
import { ToolConfig } from '@/src/ddd/domain/tools/value-objects/tool-config'
import { ToolMetadata, ToolCategory, ConnectionType } from '@/src/ddd/domain/tools/value-objects/tool-metadata'
import type { ReferenceToolDTO } from './reference-tool-mapper'

// Export domain types for UI use
export { ToolCategory, ConnectionType } from '@/src/ddd/domain/tools/value-objects/tool-metadata'

/**
 * DTO for Tool entities in API responses
 */
export interface ToolDTO {
  name: string
  displayName: string
  description: string
  category: ToolCategory
  version: string
  requiresConnection: boolean
  connectionType: ConnectionType
  requiredApps?: readonly string[]
  icon?: string
  tags: readonly string[]
  config: Record<string, any>
}

/**
 * DTO for tool search results that include both types
 */
export interface ToolSearchResultDTO {
  referenceTools: ReferenceToolDTO[]
  systemTools: ToolDTO[]
  hasMore: boolean
  totalCount: number
}

/**
 * Simplified DTO for tool display in UI components
 */
export interface ToolDisplayDTO {
  name: string
  displayName: string
  description: string
  category: ToolCategory
  icon?: string
  requiresConnection: boolean
  supportsArtifacts: boolean
  type: 'system' | 'reference'  // Discriminator for UI rendering
}


export class ToolMapper {
  /**
   * Convert Tool entity to DTO
   */
  static toDTO(tool: Tool): ToolDTO {
    return {
      name: tool.getName(),
      displayName: tool.toolMetadata.displayName,
      description: tool.toolMetadata.description,
      category: tool.toolMetadata.category,
      version: tool.getVersion(),
      requiresConnection: tool.requiresConnection(),
      connectionType: tool.toolMetadata.connectionType,
      requiredApps: tool.toolMetadata.requiredApps,
      icon: tool.toolMetadata.icon,
      tags: tool.toolMetadata.tags,
      config: tool.toolConfig.config
    }
  }

  /**
   * Convert Tool entity to display DTO for UI components
   */
  static toDisplayDTO(tool: Tool): ToolDisplayDTO {
    return {
      name: tool.getName(),
      displayName: tool.toolMetadata.displayName,
      description: tool.toolMetadata.description,
      category: tool.toolMetadata.category,
      icon: tool.toolMetadata.icon,
      requiresConnection: tool.requiresConnection(),
      supportsArtifacts: tool.supportsArtifacts(),
      type: 'system'
    }
  }

  /**
   * Convert multiple Tool entities to DTOs
   */
  static toDTOs(tools: Tool[]): ToolDTO[] {
    return tools.map(tool => this.toDTO(tool))
  }

  /**
   * Convert multiple Tool entities to display DTOs
   */
  static toDisplayDTOs(tools: Tool[]): ToolDisplayDTO[] {
    return tools.map(tool => this.toDisplayDTO(tool))
  }

  /**
   * Create Tool entity from DTO (for deserialization)
   */
  static fromDTO(dto: ToolDTO): Tool {
    const toolConfig = ToolConfig.create(dto.name, dto.version, dto.config)
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