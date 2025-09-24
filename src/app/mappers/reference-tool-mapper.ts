/**
 * Reference Tool Mapper
 *
 * Maps between ReferenceTool domain objects and DTOs for frontend consumption.
 * Replaces legacy ReferenceDTO with proper domain-aligned DTOs.
 *
 * AIDEV-NOTE: DTOs now align with ReferenceTool domain model instead of legacy references.
 * No BS default values - all data comes from proper tool configurations.
 */

import type { ReferenceTool } from '@/ddd/domain/tools/entities/reference-tool'
import type { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types'
import type { ToolDTO } from './tool-mapper'

/**
 * Reference Tool DTO for frontend consumption
 * @deprecated Use unified ToolDTO from tool-mapper instead
 * Aligns with ReferenceTool domain model
 */
export interface ReferenceToolDTO {
  // Tool identification
  toolName: string
  toolVersion: string

  // Chat display information
  id: string
  insertText: string
  displayName: string
  description: string
  category: ReferenceCategory
  supportsArtifacts: boolean

  // Tool configuration (type-safe based on category)
  config: {
    // Agent tool config
    agentId?: number
    agentOwnerId?: string

    // Table tool config
    tableId?: string
    tableName?: string

    // Document tool config
    documentId?: string
    documentFilename?: string
    documentMimeType?: string
    documentTableId?: number
    documentFieldId?: number
    documentRowId?: string

    // File tool config
    fileId?: string
    filename?: string
    fileMimeType?: string
    fileTableId?: number
    fileFieldId?: number
    fileRowId?: string

    // Database tool config
    databaseId?: string

    // Common config
    organizationId: number
  }

  // Tool metadata
  metadata: {
    toolCategory: string
    requiresConnection: boolean
    connectionType: 'oauth' | 'api_key' | 'none'
  }
}

/**
 * Map ReferenceTool domain object to unified ToolDTO
 */
export function mapReferenceToolToDTO(referenceTool: ReferenceTool): ToolDTO {
  const displayInfo = referenceTool.getChatDisplayInfo()

  return {
    name: referenceTool.toolConfig.name,
    displayName: displayInfo.displayName,
    description: displayInfo.description,
    category: referenceTool.toolMetadata.category, // Unified categories
    version: '', // Empty version since ToolConfig no longer has version
    icon: referenceTool.toolMetadata.icon,
    tags: referenceTool.toolMetadata.tags,
    requiresConnection: referenceTool.requiresConnection(),
    connectionType: referenceTool.toolMetadata.connectionType,
    supportsArtifacts: referenceTool.supportsArtifacts(),
    type: 'reference',
    config: referenceTool.toolConfig.config,
    id: referenceTool.reference.id,
    insertText: displayInfo.insertText,
    organizationId: referenceTool.getOrganizationId()
  }
}

/**
 * Map array of ReferenceTool objects to unified ToolDTOs
 */
export function mapReferenceToolsToDTO(referenceTools: ReferenceTool[]): ToolDTO[] {
  return referenceTools.map(mapReferenceToolToDTO)
}

/**
 * Reference Tool Mapper Class - for consistency with tool-mapper pattern
 */
export class ReferenceToolMapper {
  /**
   * Convert ReferenceTool entity to unified ToolDTO
   */
  static toDTO(referenceTool: ReferenceTool): ToolDTO {
    return mapReferenceToolToDTO(referenceTool)
  }

  /**
   * Convert multiple ReferenceTool entities to unified ToolDTOs
   */
  static toDTOs(referenceTools: ReferenceTool[]): ToolDTO[] {
    return mapReferenceToolsToDTO(referenceTools)
  }
}

/**
 * Type guard to check if DTO is an agent tool
 */
export function isAgentToolDTO(dto: ReferenceToolDTO): boolean {
  return dto.category === 'agent' && dto.config.agentId !== undefined
}

/**
 * Type guard to check if DTO is a document tool
 */
export function isDocumentToolDTO(dto: ReferenceToolDTO): boolean {
  return dto.category === 'doc' && dto.config.documentId !== undefined
}

/**
 * Type guard to check if DTO is a file tool
 */
export function isFileToolDTO(dto: ReferenceToolDTO): boolean {
  return dto.category === 'file' && dto.config.fileId !== undefined
}

/**
 * Get artifact config from tool DTO (for artifact creation)
 */
export function getArtifactConfig(dto: ReferenceToolDTO): {
  type: 'document' | 'file' | 'table' | 'none'
  id: string
  organizationId: number
  metadata: Record<string, any>
} {
  if (isDocumentToolDTO(dto)) {
    return {
      type: 'document',
      id: dto.config.documentId!,
      organizationId: dto.config.organizationId,
      metadata: {
        filename: dto.config.documentFilename,
        mimeType: dto.config.documentMimeType
      }
    }
  } else if (isFileToolDTO(dto)) {
    return {
      type: 'file',
      id: dto.config.fileId!,
      organizationId: dto.config.organizationId,
      metadata: {
        filename: dto.config.filename,
        mimeType: dto.config.fileMimeType
      }
    }
  } else if (dto.config.tableId) {
    return {
      type: 'table',
      id: dto.config.tableId,
      organizationId: dto.config.organizationId,
      metadata: {
        tableName: dto.config.tableName
      }
    }
  }

  return {
    type: 'none',
    id: '',
    organizationId: dto.config.organizationId,
    metadata: {}
  }
}