/**
 * Reference Tool Entity
 *
 * Bridges Reference and Tool domains by defining References as Tools with
 * REFERENCES category and specific data-pointer configurations.
 *
 * AIDEV-NOTE: References are now specialized Tools that point to data sources.
 * This unifies the tool/reference architecture as requested by the user.
 * References maintain their chat-specific behavior while becoming proper Tools.
 *
 * AIDEV-TODO: Add gRPC worker integration for data source tools:
 * - Agent references should connect to specific gRPC worker instances
 * - Table/Database references could use gRPC for remote data access
 * - File/Document references might stream content via gRPC for large files
 * - Add worker routing logic based on tool configuration
 */

import { ToolConfig, AgentToolConfig, TableToolConfig, DocumentToolConfig, FileToolConfig, DatabaseToolConfig } from '../value-objects/tool-config'
import { ToolMetadata, ToolCategory } from '../value-objects/tool-metadata'
import { Reference } from '@/src/ddd/domain/chat/value-objects/reference'
import { ReferenceCategory } from '@/src/ddd/domain/chat/value-objects/reference-types'
import { Tool } from './tool'

/**
 * Reference Tool entity - specialized Tool for data references
 */
export class ReferenceTool extends Tool {
  constructor(
    toolConfig: ToolConfig,
    toolMetadata: ToolMetadata,
    public readonly reference: Reference
  ) {
    super(toolConfig, toolMetadata)
    // Ensure this is a REFERENCES category tool
    if (toolMetadata.category !== ToolCategory.REFERENCES) {
      throw new Error('ReferenceTool must have REFERENCES category')
    }

    // Ensure the tool name matches the reference concept
    if (!this.isValidReferenceToolMapping()) {
      throw new Error('Tool config does not match reference category')
    }
  }

  /**
   * Create a ReferenceTool from an Agent
   */
  static fromAgent(
    agentId: number,
    organizationId: number,
    ownerId: string,
    agentName: string,
    description?: string
  ): ReferenceTool {
    const toolConfig = ToolConfig.agent(`agent-${agentId}`, agentId, organizationId, ownerId)
    const toolMetadata = ToolMetadata.reference(
      `agent-${agentId}`,
      agentName,
      description || `${agentName} agent`,
      ['agent', 'ai', 'assistant']
    )
    const reference = Reference.agent(agentId.toString(), agentName, description)

    return new ReferenceTool(toolConfig, toolMetadata, reference)
  }

  /**
   * Create a ReferenceTool from a Table
   */
  static fromTable(
    tableId: string,
    organizationId: number,
    tableName: string,
    databaseName: string,
    description?: string
  ): ReferenceTool {
    const toolConfig = ToolConfig.table(`table-${tableId}`, tableId, organizationId, tableName)
    const toolMetadata = ToolMetadata.reference(
      `table-${tableId}`,
      tableName,
      description || `Table in ${databaseName}`,
      ['table', 'data', 'database']
    )
    const reference = Reference.table(tableId, tableName, databaseName, description)

    return new ReferenceTool(toolConfig, toolMetadata, reference)
  }

  /**
   * Create a ReferenceTool from a Document
   */
  static fromDocument(
    documentId: string,
    organizationId: number,
    filename: string,
    mimeType: string,
    tableName: string,
    tableId: number,
    fieldId: number,
    rowId: string,
    databaseName?: string
  ): ReferenceTool {
    const toolConfig = ToolConfig.document(`doc-${documentId}`, documentId, filename, mimeType, organizationId, tableId, fieldId, rowId)
    const toolMetadata = ToolMetadata.reference(
      `doc-${documentId}`,
      filename,
      `Document in ${tableName} table`,
      ['document', 'file', 'content']
    )
    const reference = Reference.document(documentId, filename, tableName, databaseName)

    return new ReferenceTool(toolConfig, toolMetadata, reference)
  }

  /**
   * Create a ReferenceTool from a File
   */
  static fromFile(
    fileId: string,
    organizationId: number,
    filename: string,
    mimeType: string,
    tableName: string,
    tableId: number,
    fieldId: number,
    rowId: string,
    databaseName?: string
  ): ReferenceTool {
    const toolConfig = ToolConfig.file(`file-${fileId}`, fileId, filename, mimeType, organizationId, tableId, fieldId, rowId)
    const toolMetadata = ToolMetadata.reference(
      `file-${fileId}`,
      filename,
      `File in ${tableName} table (${mimeType})`,
      ['file', 'attachment', 'upload']
    )
    const reference = Reference.file(fileId, filename, tableName, mimeType, databaseName)

    return new ReferenceTool(toolConfig, toolMetadata, reference)
  }

  /**
   * Create a ReferenceTool from a Database
   */
  static fromDatabase(
    databaseId: string,
    organizationId: number,
    databaseName: string,
    description?: string
  ): ReferenceTool {
    const toolConfig = ToolConfig.database(`database-${databaseId}`, databaseId, organizationId)
    const toolMetadata = ToolMetadata.reference(
      `database-${databaseId}`,
      databaseName,
      description || `Database - ${databaseName}`,
      ['database', 'data', 'storage']
    )
    const reference = Reference.database(databaseId, databaseName, description)

    return new ReferenceTool(toolConfig, toolMetadata, reference)
  }

  /**
   * Get the data pointer from the tool config
   */
  getDataPointer(): string | number {
    if (this.toolConfig.isAgentTool()) {
      return this.toolConfig.getAgentConfig()!.agentId
    }
    if (this.toolConfig.isTableTool()) {
      return this.toolConfig.getTableConfig()!.tableId
    }
    if (this.toolConfig.isDocumentTool()) {
      return this.toolConfig.getDocumentConfig()!.documentId
    }
    if (this.toolConfig.isFileTool()) {
      return this.toolConfig.getFileConfig()!.fileId
    }
    if (this.toolConfig.isDatabaseTool()) {
      return this.toolConfig.getDatabaseConfig()!.databaseId
    }
    throw new Error('Unknown reference tool type')
  }

  /**
   * Get the reference category
   */
  getReferenceCategory(): ReferenceCategory {
    return this.reference.category
  }

  /**
   * Check if tool config matches reference category
   */
  private isValidReferenceToolMapping(): boolean {
    const category = this.reference.category

    switch (category) {
      case ReferenceCategory.AGENT:
        return this.toolConfig.isAgentTool()
      case ReferenceCategory.TABLE:
        return this.toolConfig.isTableTool()
      case ReferenceCategory.DOC:
        return this.toolConfig.isDocumentTool()
      case ReferenceCategory.FILE:
        return this.toolConfig.isFileTool()
      case ReferenceCategory.DATABASE:
        return this.toolConfig.isDatabaseTool()
      default:
        return false
    }
  }

  /**
   * Override: Check if this reference tool can be used in chat
   */
  override canBeUsedInChat(): boolean {
    // All reference tools can be used in chat via @ mentions
    return true
  }

  /**
   * Override: Check if this reference tool supports artifacts
   */
  override supportsArtifacts(): boolean {
    const category = this.reference.category
    return category === ReferenceCategory.DOC ||
           category === ReferenceCategory.FILE ||
           category === ReferenceCategory.TABLE
  }

  /**
   * Get display information for chat UI
   */
  getChatDisplayInfo(): {
    insertText: string
    displayName: string
    description: string
    category: string
    icon?: string
    supportsArtifacts: boolean
  } {
    return {
      insertText: this.reference.insertText,
      displayName: this.reference.displayName,
      description: this.reference.description,
      category: this.reference.category,
      icon: this.toolMetadata.icon,
      supportsArtifacts: this.supportsArtifacts()
    }
  }

  /**
   * Get tool information for tool-based interfaces
   * @deprecated Use getDisplayInfo() from base Tool class instead
   */
  getToolDisplayInfo() {
    return this.getDisplayInfo()
  }


  /**
   * Override: Check if this reference tool equals another
   */
  override equals(other: Tool): boolean {
    if (!(other instanceof ReferenceTool)) {
      return false
    }
    return super.equals(other) && this.reference.equals(other.reference)
  }
}

/**
 * Type guard to check if a Tool is a ReferenceTool
 */
export function isReferenceTool(toolMetadata: ToolMetadata): boolean {
  return toolMetadata.category === ToolCategory.REFERENCES
}

/**
 * Convert a ToolConfig + ToolMetadata to ReferenceTool (if it's a reference)
 */
export function toolToReferenceTool(
  toolConfig: ToolConfig,
  toolMetadata: ToolMetadata
): ReferenceTool | null {
  if (!isReferenceTool(toolMetadata)) {
    return null
  }

  // Create appropriate reference based on tool config type
  let reference: Reference

  if (toolConfig.isAgentTool()) {
    const config = toolConfig.getAgentConfig()!
    reference = Reference.agent(config.agentId.toString(), toolMetadata.displayName, toolMetadata.description)
  } else if (toolConfig.isTableTool()) {
    const config = toolConfig.getTableConfig()!
    // We'd need database name from somewhere - this is a limitation of the current design
    reference = Reference.table(config.tableId, config.tableName || toolMetadata.displayName, 'unknown-db', toolMetadata.description)
  } else if (toolConfig.isDocumentTool()) {
    const config = toolConfig.getDocumentConfig()!
    // We'd need table/database info from somewhere
    reference = Reference.document(config.documentId, config.filename, 'unknown-table', 'unknown-db')
  } else if (toolConfig.isFileTool()) {
    const config = toolConfig.getFileConfig()!
    reference = Reference.file(config.fileId, config.filename, 'unknown-table', config.mimeType, 'unknown-db')
  } else if (toolConfig.isDatabaseTool()) {
    const config = toolConfig.getDatabaseConfig()!
    reference = Reference.database(config.databaseId, toolMetadata.displayName, toolMetadata.description)
  } else {
    return null
  }

  return new ReferenceTool(toolConfig, toolMetadata, reference)
}