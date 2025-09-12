/**
 * Reference Processor - Handles @doc:, @table:, @agent: references in chat messages
 * 
 * Parses chat messages for mention references and creates appropriate artifacts
 * or context enrichment for the AI to understand what's being referenced.
 * 
 * AIDEV-NOTE: Core system for making @doc:test/abc style references functional
 * in chat by connecting them to actual data and artifacts.
 */

import type { 
  DocumentFieldValue, 
  FileFieldValue 
} from '@/ddd/domain/tables/value-objects/field-values'
import { 
  createDocumentArtifact, 
  createFileArtifact,
  type DocumentArtifact,
  type FileArtifact,
  type EmeryArtifact
} from '../types/chat-artifacts'

// Reference patterns that we recognize in chat messages
const REFERENCE_PATTERNS = {
  // @doc:database/table or @doc:documentName
  document: /@doc:([a-zA-Z0-9\-_\/]+)/g,
  
  // @table:database/table
  table: /@table:([a-zA-Z0-9\-_\/]+)/g,
  
  // @agent:agentName
  agent: /@agent:([a-zA-Z0-9\-_]+)/g,
  
  // @tool:toolName  
  tool: /@tool:([a-zA-Z0-9\-_]+)/g
} as const

// Processed reference result
export interface ProcessedReference {
  type: 'document' | 'table' | 'agent' | 'tool'
  reference: string
  resolved: boolean
  artifact?: EmeryArtifact
  context?: string
  error?: string
}

// Message processing result
export interface ProcessedMessage {
  originalMessage: string
  processedMessage: string
  references: ProcessedReference[]
  artifacts: EmeryArtifact[]
  hasReferences: boolean
}

/**
 * Process a chat message and extract/resolve references
 */
export async function processMessageReferences(
  message: string,
  options: {
    // Data context for resolving references
    availableDatabases?: Array<{ id: number; name: string; tables: Array<{ id: number; name: string }> }>
    availableDocuments?: Array<{ name: string; data: DocumentFieldValue; tableId: number; fieldId: number }>
    availableAgents?: Array<{ id: string; name: string; description?: string }>
    
    // Processing options
    createArtifacts?: boolean
    enrichContext?: boolean
  } = {}
): Promise<ProcessedMessage> {
  const references: ProcessedReference[] = []
  const artifacts: EmeryArtifact[] = []
  let processedMessage = message

  // Process document references
  const documentMatches = Array.from(message.matchAll(REFERENCE_PATTERNS.document))
  for (const match of documentMatches) {
    const reference = match[1] // The captured group (e.g., "test/abc")
    const processed = await processDocumentReference(reference, options)
    references.push(processed)
    
    if (processed.artifact) {
      artifacts.push(processed.artifact)
    }
    
    // Replace in message with enriched context
    if (options.enrichContext && processed.context) {
      processedMessage = processedMessage.replace(
        match[0], 
        `[Document: ${reference}](artifact:${processed.artifact?.type || 'doc'}) - ${processed.context}`
      )
    }
  }

  // Process table references  
  const tableMatches = Array.from(message.matchAll(REFERENCE_PATTERNS.table))
  for (const match of tableMatches) {
    const reference = match[1]
    const processed = await processTableReference(reference, options)
    references.push(processed)
    
    // Add context enrichment
    if (options.enrichContext && processed.context) {
      processedMessage = processedMessage.replace(
        match[0],
        `[Table: ${reference}] - ${processed.context}`
      )
    }
  }

  // Process agent references
  const agentMatches = Array.from(message.matchAll(REFERENCE_PATTERNS.agent))
  for (const match of agentMatches) {
    const reference = match[1]
    const processed = await processAgentReference(reference, options)
    references.push(processed)
    
    if (options.enrichContext && processed.context) {
      processedMessage = processedMessage.replace(
        match[0],
        `[Agent: ${reference}] - ${processed.context}`
      )
    }
  }

  return {
    originalMessage: message,
    processedMessage,
    references,
    artifacts,
    hasReferences: references.length > 0
  }
}

/**
 * Process a document reference like "test/abc" or "documentName"
 */
async function processDocumentReference(
  reference: string, 
  options: {
    availableDocuments?: Array<{ name: string; data: DocumentFieldValue; tableId: number; fieldId: number }>
    createArtifacts?: boolean
  }
): Promise<ProcessedReference> {
  try {
    // Try to find the document in available documents
    const availableDocs = options.availableDocuments || []
    
    // Handle database/table/document format or just document name
    let matchedDocument: typeof availableDocs[0] | undefined
    
    if (reference.includes('/')) {
      // Format: database/table or table/document
      const parts = reference.split('/')
      if (parts.length >= 2) {
        const possibleDocName = parts[parts.length - 1] // Last part as document name
        matchedDocument = availableDocs.find(doc => 
          doc.name.toLowerCase().replace(/\s+/g, '-') === possibleDocName.toLowerCase()
        )
      }
    } else {
      // Direct document name
      matchedDocument = availableDocs.find(doc => 
        doc.name.toLowerCase().replace(/\s+/g, '-') === reference.toLowerCase()
      )
    }

    if (matchedDocument && options.createArtifacts) {
      // Create document artifact
      const artifact = createDocumentArtifact(
        matchedDocument.data,
        matchedDocument.tableId,
        matchedDocument.fieldId,
        'view' // Default to view mode for referenced documents
      )

      return {
        type: 'document',
        reference,
        resolved: true,
        artifact,
        context: `Document "${matchedDocument.name}" (${matchedDocument.data.mimeType})`
      }
    } else if (matchedDocument) {
      // Found but no artifact creation
      return {
        type: 'document', 
        reference,
        resolved: true,
        context: `Document "${matchedDocument.name}" - click to open for editing`
      }
    } else {
      // Not found
      return {
        type: 'document',
        reference,
        resolved: false,
        error: `Document "${reference}" not found`,
        context: `Referenced document "${reference}" could not be located`
      }
    }
  } catch (error) {
    return {
      type: 'document',
      reference,
      resolved: false,
      error: `Error processing document reference: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Process a table reference like "database/table"
 */
async function processTableReference(
  reference: string,
  options: {
    availableDatabases?: Array<{ id: number; name: string; tables: Array<{ id: number; name: string }> }>
  }
): Promise<ProcessedReference> {
  try {
    const databases = options.availableDatabases || []
    
    if (reference.includes('/')) {
      const [dbName, tableName] = reference.split('/')
      
      const database = databases.find(db => 
        db.name.toLowerCase().replace(/\s+/g, '-') === dbName.toLowerCase()
      )
      
      if (database) {
        const table = database.tables.find(t => 
          t.name.toLowerCase().replace(/\s+/g, '-') === tableName.toLowerCase()
        )
        
        if (table) {
          return {
            type: 'table',
            reference,
            resolved: true,
            context: `Table "${table.name}" in database "${database.name}" (ID: ${table.id})`
          }
        } else {
          return {
            type: 'table',
            reference,
            resolved: false,
            error: `Table "${tableName}" not found in database "${database.name}"`,
            context: `Table "${tableName}" could not be found`
          }
        }
      } else {
        return {
          type: 'table',
          reference,
          resolved: false,
          error: `Database "${dbName}" not found`,
          context: `Database "${dbName}" could not be located`
        }
      }
    } else {
      return {
        type: 'table',
        reference,
        resolved: false,
        error: 'Table reference must be in format "database/table"',
        context: `Invalid table reference format: "${reference}"`
      }
    }
  } catch (error) {
    return {
      type: 'table',
      reference,
      resolved: false,
      error: `Error processing table reference: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Process an agent reference
 */
async function processAgentReference(
  reference: string,
  options: {
    availableAgents?: Array<{ id: string; name: string; description?: string }>
  }
): Promise<ProcessedReference> {
  try {
    const agents = options.availableAgents || []
    
    const agent = agents.find(a => 
      a.name.toLowerCase().replace(/\s+/g, '-') === reference.toLowerCase()
    )
    
    if (agent) {
      return {
        type: 'agent',
        reference,
        resolved: true,
        context: `Agent "${agent.name}"${agent.description ? ` - ${agent.description}` : ''}`
      }
    } else {
      return {
        type: 'agent',
        reference,
        resolved: false,
        error: `Agent "${reference}" not found`,
        context: `Agent "${reference}" could not be located`
      }
    }
  } catch (error) {
    return {
      type: 'agent',
      reference,
      resolved: false,
      error: `Error processing agent reference: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Extract all references from a message without processing
 */
export function extractReferences(message: string): Array<{ type: string; reference: string; fullMatch: string }> {
  const references: Array<{ type: string; reference: string; fullMatch: string }> = []
  
  // Extract each type
  Object.entries(REFERENCE_PATTERNS).forEach(([type, pattern]) => {
    const matches = Array.from(message.matchAll(pattern))
    matches.forEach(match => {
      references.push({
        type,
        reference: match[1],
        fullMatch: match[0]
      })
    })
  })
  
  return references
}

/**
 * Check if a message contains any references
 */
export function hasReferences(message: string): boolean {
  return Object.values(REFERENCE_PATTERNS).some(pattern => pattern.test(message))
}

// AIDEV-NOTE: This system bridges the gap between mention creation (@doc:test/abc)
// and AI understanding by parsing references and creating appropriate artifacts
// or context enrichment for the chat system to understand what's being referenced.