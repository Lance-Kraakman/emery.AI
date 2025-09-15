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

/**
 * Reference Tool DTO for frontend consumption
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

    // File tool config
    fileId?: string
    filename?: string
    fileMimeType?: string

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
 * Map ReferenceTool domain object to DTO
 */
export function mapReferenceToolToDTO(referenceTool: ReferenceTool): ReferenceToolDTO {
  const displayInfo = referenceTool.getChatDisplayInfo()
  const toolMetadata = referenceTool.getToolDisplayInfo()

  // Base DTO structure
  const dto: ReferenceToolDTO = {
    toolName: referenceTool.toolConfig.name,
    toolVersion: referenceTool.toolConfig.version,
    id: referenceTool.reference.id,
    insertText: displayInfo.insertText,
    displayName: displayInfo.displayName,
    description: displayInfo.description,
    category: displayInfo.category as ReferenceCategory,
    supportsArtifacts: displayInfo.supportsArtifacts,
    config: {
      organizationId: 0 // Will be set below based on tool type
    },
    metadata: {
      toolCategory: toolMetadata.category,
      requiresConnection: toolMetadata.requiresConnection,
      connectionType: referenceTool.toolConfig.connectionType
    }
  }

  // Set type-specific configuration based on tool type
  if (referenceTool.toolConfig.isAgentTool()) {
    const agentConfig = referenceTool.toolConfig.getAgentConfig()!
    dto.config.agentId = agentConfig.agentId
    dto.config.agentOwnerId = agentConfig.ownerId
    dto.config.organizationId = agentConfig.organizationId
  } else if (referenceTool.toolConfig.isTableTool()) {
    const tableConfig = referenceTool.toolConfig.getTableConfig()!
    dto.config.tableId = tableConfig.tableId
    dto.config.tableName = tableConfig.tableName
    dto.config.organizationId = tableConfig.organizationId
  } else if (referenceTool.toolConfig.isDocumentTool()) {
    const docConfig = referenceTool.toolConfig.getDocumentConfig()!
    dto.config.documentId = docConfig.documentId
    dto.config.documentFilename = docConfig.filename
    dto.config.documentMimeType = docConfig.mimeType
    dto.config.organizationId = docConfig.organizationId
  } else if (referenceTool.toolConfig.isFileTool()) {
    const fileConfig = referenceTool.toolConfig.getFileConfig()!
    dto.config.fileId = fileConfig.fileId
    dto.config.filename = fileConfig.filename
    dto.config.fileMimeType = fileConfig.mimeType
    dto.config.organizationId = fileConfig.organizationId
  } else if (referenceTool.toolConfig.isDatabaseTool()) {
    const dbConfig = referenceTool.toolConfig.getDatabaseConfig()!
    dto.config.databaseId = dbConfig.databaseId
    dto.config.organizationId = dbConfig.organizationId
  }

  return dto
}

/**
 * Map array of ReferenceTool objects to DTOs
 */
export function mapReferenceToolsToDTO(referenceTools: ReferenceTool[]): ReferenceToolDTO[] {
  return referenceTools.map(mapReferenceToolToDTO)
}

/**
 * Reference Tool Mapper Class - for consistency with tool-mapper pattern
 */
export class ReferenceToolMapper {
  /**
   * Convert ReferenceTool entity to DTO
   */
  static toDTO(referenceTool: ReferenceTool): ReferenceToolDTO {
    return mapReferenceToolToDTO(referenceTool)
  }

  /**
   * Convert multiple ReferenceTool entities to DTOs
   */
  static toDTOs(referenceTools: ReferenceTool[]): ReferenceToolDTO[] {
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