/**
 * Simple Reference Resolver - Fuzzy search and resolution for chat references
 * 
 * Handles @doc:, @table:, @agent: references using existing metadata.
 * No complex hierarchies - just fuzzy search + path generation.
 * 
 * AIDEV-NOTE: Simple approach using existing DocumentFieldValue metadata
 * and basic fuzzy matching for reference resolution.
 */

import type { 
  DocumentFieldValue, 
  FileFieldValue 
} from '@/ddd/domain/tables/value-objects/field-values'
import { 
  createDocumentArtifact,
  type DocumentArtifact,
  type EmeryArtifact
} from '../types/chat-artifacts'

// Reference patterns for matching in chat messages
const REFERENCE_PATTERNS = {
  document: /@doc:([a-zA-Z0-9\-_]+)/g,
  table: /@table:([a-zA-Z0-9\-_\/]+)/g,
  agent: /@agent:([a-zA-Z0-9\-_]+)/g,
  tool: /@tool:([a-zA-Z0-9\-_]+)/g
} as const

// Resolved reference types
export interface ResolvedDocumentReference {
  type: 'document'
  name: string
  documentField: DocumentFieldValue
  tableId: number
  fieldId: number
  path: string
  confidence: number
}

export interface ResolvedTableReference {
  type: 'table'
  name: string
  tableId: number
  databaseId: number
  path: string
  confidence: number
  metadata?: {
    rowCount?: number
    fieldCount?: number
    lastUpdated?: string
  }
}

export interface ResolvedAgentReference {
  type: 'agent'
  name: string
  agentId: string
  path: string
  confidence: number
  metadata?: {
    description?: string
    status?: string
    capabilities?: string[]
  }
}

export type ResolvedReference = ResolvedDocumentReference | ResolvedTableReference | ResolvedAgentReference

// Mock data interfaces (to be replaced with real data fetching)
interface DocumentData {
  documentField: DocumentFieldValue
  tableId: number
  fieldId: number
  tableName: string
  databaseName: string
  fieldName: string
}

interface TableData {
  id: number
  name: string
  databaseId: number
  databaseName: string
  metadata?: {
    rowCount?: number
    fieldCount?: number
    lastUpdated?: string
  }
}

interface AgentData {
  id: string
  name: string
  description?: string
  status?: string
  capabilities?: string[]
}

/**
 * Calculate fuzzy match score between query and text
 */
function calculateFuzzyScore(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  
  // Exact match
  if (textLower === queryLower) return 1.0
  
  // Starts with query
  if (textLower.startsWith(queryLower)) return 0.8
  
  // Contains query
  if (textLower.includes(queryLower)) return 0.6
  
  // Simple Levenshtein distance for typo tolerance
  const distance = levenshteinDistance(queryLower, textLower)
  const maxLen = Math.max(queryLower.length, textLower.length)
  
  // If distance is small relative to length, give it a score
  if (distance <= Math.max(2, maxLen * 0.3)) {
    return 0.4 * (1 - distance / maxLen)
  }
  
  return 0
}

/**
 * Simple Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Resolve document reference using fuzzy search
 */
export async function resolveDocumentReference(
  name: string,
  availableDocuments: DocumentData[] = []
): Promise<ResolvedDocumentReference | null> {
  if (!name || availableDocuments.length === 0) {
    return null
  }
  
  // Calculate scores for all documents
  const scoredDocuments = availableDocuments
    .map(doc => {
      // Search in multiple fields
      const nameScore = calculateFuzzyScore(name, doc.documentField.name)
      const titleScore = doc.documentField.documentMetadata?.title 
        ? calculateFuzzyScore(name, doc.documentField.documentMetadata.title)
        : 0
      
      // Take the best score
      const confidence = Math.max(nameScore, titleScore)
      
      return {
        document: doc,
        confidence
      }
    })
    .filter(result => result.confidence > 0.3) // Minimum threshold
    .sort((a, b) => b.confidence - a.confidence) // Best first
  
  if (scoredDocuments.length === 0) {
    return null
  }
  
  // Return the best match
  const best = scoredDocuments[0]
  const doc = best.document
  
  return {
    type: 'document',
    name,
    documentField: doc.documentField,
    tableId: doc.tableId,
    fieldId: doc.fieldId,
    path: `${doc.databaseName} → ${doc.tableName} → ${doc.fieldName}`,
    confidence: best.confidence
  }
}

/**
 * Resolve table reference using fuzzy search
 */
export async function resolveTableReference(
  name: string,
  availableTables: TableData[] = []
): Promise<ResolvedTableReference | null> {
  if (!name || availableTables.length === 0) {
    return null
  }
  
  // Handle database/table format
  let searchName = name
  let searchDatabase: string | undefined
  
  if (name.includes('/')) {
    const parts = name.split('/')
    if (parts.length === 2) {
      searchDatabase = parts[0]
      searchName = parts[1]
    }
  }
  
  // Calculate scores for all tables
  const scoredTables = availableTables
    .map(table => {
      let confidence = calculateFuzzyScore(searchName, table.name)
      
      // Boost score if database also matches
      if (searchDatabase) {
        const dbScore = calculateFuzzyScore(searchDatabase, table.databaseName)
        confidence = Math.max(confidence * (0.5 + dbScore * 0.5), confidence * 0.8)
      }
      
      return {
        table,
        confidence
      }
    })
    .filter(result => result.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence)
  
  if (scoredTables.length === 0) {
    return null
  }
  
  const best = scoredTables[0]
  const table = best.table
  
  return {
    type: 'table',
    name,
    tableId: table.id,
    databaseId: table.databaseId,
    path: `${table.databaseName} → ${table.name}`,
    confidence: best.confidence,
    metadata: table.metadata
  }
}

/**
 * Resolve agent reference using fuzzy search
 */
export async function resolveAgentReference(
  name: string,
  availableAgents: AgentData[] = []
): Promise<ResolvedAgentReference | null> {
  if (!name || availableAgents.length === 0) {
    return null
  }
  
  const scoredAgents = availableAgents
    .map(agent => {
      const nameScore = calculateFuzzyScore(name, agent.name)
      const descScore = agent.description 
        ? calculateFuzzyScore(name, agent.description)
        : 0
      
      const confidence = Math.max(nameScore, descScore * 0.7) // Description match worth less
      
      return {
        agent,
        confidence
      }
    })
    .filter(result => result.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence)
  
  if (scoredAgents.length === 0) {
    return null
  }
  
  const best = scoredAgents[0]
  const agent = best.agent
  
  return {
    type: 'agent',
    name,
    agentId: agent.id,
    path: agent.name,
    confidence: best.confidence,
    metadata: {
      description: agent.description,
      status: agent.status,
      capabilities: agent.capabilities
    }
  }
}

/**
 * Extract all references from a message
 */
export function extractReferences(message: string): Array<{
  type: keyof typeof REFERENCE_PATTERNS
  name: string
  fullMatch: string
  startIndex: number
  endIndex: number
}> {
  const references: Array<{
    type: keyof typeof REFERENCE_PATTERNS
    name: string
    fullMatch: string
    startIndex: number
    endIndex: number
  }> = []
  
  // Extract each type of reference
  Object.entries(REFERENCE_PATTERNS).forEach(([type, pattern]) => {
    const matches = Array.from(message.matchAll(pattern))
    matches.forEach(match => {
      if (match.index !== undefined) {
        references.push({
          type: type as keyof typeof REFERENCE_PATTERNS,
          name: match[1], // Captured group
          fullMatch: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        })
      }
    })
  })
  
  // Sort by position in message
  return references.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Check if a message contains any references
 */
export function hasReferences(message: string): boolean {
  return Object.values(REFERENCE_PATTERNS).some(pattern => pattern.test(message))
}

/**
 * Enrich resolved reference for AI context
 */
export function enrichReferenceForAI(reference: ResolvedReference): string {
  switch (reference.type) {
    case 'document':
      const doc = reference.documentField
      const meta = doc.documentMetadata
      const title = meta?.title || doc.name
      const wordCount = meta?.tiptapMetadata?.wordCount
      const wordInfo = wordCount ? ` (${wordCount.toLocaleString()} words)` : ''
      
      return `Document "${title}" in ${reference.path}${wordInfo}`
    
    case 'table':
      const rowInfo = reference.metadata?.rowCount 
        ? ` (${reference.metadata.rowCount.toLocaleString()} rows)`
        : ''
      
      return `Table "${reference.name}" in ${reference.path}${rowInfo}`
    
    case 'agent':
      const desc = reference.metadata?.description 
        ? ` - ${reference.metadata.description}`
        : ''
      
      return `Agent "${reference.name}"${desc}`
    
    default:
      // TypeScript exhaustiveness check - this should never be reached
      return (reference as any).name || 'Unknown reference'
  }
}

// AIDEV-NOTE: This provides simple fuzzy search resolution using existing metadata.
// No complex hierarchies - just score-based matching with confidence levels.
// Path generation happens here to provide rich AI context.