// AIDEV-NOTE: Chat-time reference resolution
// Parses @category:path patterns and resolves to actual data for AI context

import { getTableApplicationService } from "@/ddd/application/di/container";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { RowMapper, type DocumentFieldValue, type FileFieldValue } from "@/app/mappers/row-mapper";
import { isDocumentArray, isFileArray } from "@/ddd/domain/tables/value-objects/field-values";

// Import client-safe patterns
import { REFERENCE_PATTERNS } from './reference-patterns';

export interface ParsedReference {
  type: 'doc' | 'file' | 'table' | 'agent' | 'tool'
  fullPath: string
  originalMatch: string
  startIndex: number
  endIndex: number
}

export interface ResolvedReference extends ParsedReference {
  data?: any
  metadata?: {
    title?: string
    description?: string
    content?: string
    size?: number
    mimeType?: string
    wordCount?: number
    error?: string
  }
}

export interface ReferenceResolutionResult {
  originalMessage: string
  parsedReferences: ParsedReference[]
  resolvedReferences: ResolvedReference[]
  enrichedContext: string
  hasErrors: boolean
}

/**
 * Parse all references from a chat message
 */
export function parseReferences(message: string): ParsedReference[] {
  const references: ParsedReference[] = [];

  // Extract each type of reference
  Object.entries(REFERENCE_PATTERNS).forEach(([type, pattern]) => {
    // Reset the regex lastIndex to avoid global flag state issues
    pattern.lastIndex = 0;
    const matches = Array.from(message.matchAll(pattern));
    matches.forEach(match => {
      if (match.index !== undefined) {
        references.push({
          type: type as any,
          fullPath: match[1],
          originalMatch: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        });
      }
    });
  });

  // Sort by position in message
  return references.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Resolve all references in a message and return enriched context
 */
export async function resolveReferences(
  message: string,
  emeryData: any
): Promise<ReferenceResolutionResult> {
  const parsedReferences = parseReferences(message);
  
  if (parsedReferences.length === 0) {
    return {
      originalMessage: message,
      parsedReferences: [],
      resolvedReferences: [],
      enrichedContext: message,
      hasErrors: false
    };
  }

  const resolvedReferences: ResolvedReference[] = [];
  let hasErrors = false;

  // Resolve each reference
  for (const ref of parsedReferences) {
    try {
      const resolved = await resolveReference(ref, emeryData);
      resolvedReferences.push(resolved);
      if (resolved.metadata?.error) {
        hasErrors = true;
      }
    } catch (error) {
      console.error(`Error resolving reference ${ref.originalMatch}:`, error);
      resolvedReferences.push({
        ...ref,
        metadata: {
          error: `Failed to resolve ${ref.originalMatch}`
        }
      });
      hasErrors = true;
    }
  }

  // Create enriched context for AI
  const enrichedContext = createEnrichedContext(message, resolvedReferences);

  return {
    originalMessage: message,
    parsedReferences,
    resolvedReferences,
    enrichedContext,
    hasErrors
  };
}

/**
 * Resolve a single reference to actual data
 */
async function resolveReference(
  ref: ParsedReference,
  emeryData: any
): Promise<ResolvedReference> {
  switch (ref.type) {
    case 'doc':
      return await resolveDocumentReference(ref, emeryData);
    case 'file':
      return await resolveFileReference(ref, emeryData);
    case 'table':
      return await resolveTableReference(ref, emeryData);
    case 'agent':
      return resolveAgentReference(ref);
    case 'tool':
      return resolveToolReference(ref);
    default:
      return {
        ...ref,
        metadata: {
          error: `Unknown reference type: ${ref.type}`
        }
      };
  }
}

/**
 * Resolve document reference: @doc:database/table/document-title
 */
async function resolveDocumentReference(
  ref: ParsedReference,
  emeryData: any
): Promise<ResolvedReference> {
  try {
    const pathParts = ref.fullPath.split('/');
    if (pathParts.length !== 3) {
      return {
        ...ref,
        metadata: {
          error: `Invalid document path format. Expected: database/table/title`
        }
      };
    }

    const [databaseName, tableName, documentTitle] = pathParts;
    
    // Find the table
    const table = findTable(emeryData, databaseName, tableName);
    if (!table) {
      return {
        ...ref,
        metadata: {
          error: `Table not found: ${databaseName}/${tableName}`
        }
      };
    }

    // Search for document in table
    const tableAppService = getTableApplicationService();
    const rowsData = await tableAppService.getRows(
      TableId.fromNumber(table.id),
      { limit: 50, offset: 0 }
    );

    // Find document with matching title
    for (const row of rowsData) {
      const rowDTO = RowMapper.toDTO(row);
      
      for (const fieldValue of rowDTO.fieldValues) {
        if (fieldValue.fieldType === 'document' && fieldValue.value && isDocumentArray(fieldValue.value)) {
          // Handle DocumentArrayFieldValue - iterate through each document in the array
          const docArray = fieldValue.value as DocumentFieldValue[];
          for (const docField of docArray) {
            const title = docField.documentMetadata?.title || docField.name;
            
            if (title === documentTitle) {
              return {
                ...ref,
                data: docField,
                metadata: {
                  title,
                  description: `Document from ${databaseName} → ${tableName}`,
                  wordCount: docField.documentMetadata?.tiptapMetadata?.wordCount,
                  content: docField.documentMetadata?.title // Add content for artifact display
                }
              };
            }
          }
        }
      }
    }

    return {
      ...ref,
      metadata: {
        error: `Document not found: ${documentTitle} in ${databaseName}/${tableName}`
      }
    };

  } catch (error) {
    return {
      ...ref,
      metadata: {
        error: `Failed to resolve document: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Resolve file reference: @file:database/table/filename
 */
async function resolveFileReference(
  ref: ParsedReference,
  emeryData: any
): Promise<ResolvedReference> {
  try {
    const pathParts = ref.fullPath.split('/');
    if (pathParts.length !== 3) {
      return {
        ...ref,
        metadata: {
          error: `Invalid file path format. Expected: database/table/filename`
        }
      };
    }

    const [databaseName, tableName, fileName] = pathParts;
    
    // Find the table
    const table = findTable(emeryData, databaseName, tableName);
    if (!table) {
      return {
        ...ref,
        metadata: {
          error: `Table not found: ${databaseName}/${tableName}`
        }
      };
    }

    // Search for file in table
    const tableAppService = getTableApplicationService();
    const rowsData = await tableAppService.getRows(
      TableId.fromNumber(table.id),
      { limit: 50, offset: 0 }
    );

    // Find file with matching name
    for (const row of rowsData) {
      const rowDTO = RowMapper.toDTO(row);
      
      for (const fieldValue of rowDTO.fieldValues) {
        if (fieldValue.fieldType === 'file' && fieldValue.value && isFileArray(fieldValue.value)) {
          // Handle FileArrayFieldValue - iterate through each file in the array
          const fileArray = fieldValue.value as FileFieldValue[];
          for (const fileField of fileArray) {
            
            if (fileField.name === fileName) {
              return {
                ...ref,
                data: fileField,
                metadata: {
                  title: fileName,
                  description: `File from ${databaseName} → ${tableName}`,
                  size: fileField.size,
                  mimeType: fileField.mimeType
                }
              };
            }
          }
        }
      }
    }

    return {
      ...ref,
      metadata: {
        error: `File not found: ${fileName} in ${databaseName}/${tableName}`
      }
    };

  } catch (error) {
    return {
      ...ref,
      metadata: {
        error: `Failed to resolve file: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Resolve table reference: @table:database/table-name
 */
async function resolveTableReference(
  ref: ParsedReference,
  emeryData: any
): Promise<ResolvedReference> {
  try {
    const pathParts = ref.fullPath.split('/');
    if (pathParts.length !== 2) {
      return {
        ...ref,
        metadata: {
          error: `Invalid table path format. Expected: database/table`
        }
      };
    }

    const [databaseName, tableName] = pathParts;
    
    // Find the table
    const table = findTable(emeryData, databaseName, tableName);
    if (!table) {
      return {
        ...ref,
        metadata: {
          error: `Table not found: ${databaseName}/${tableName}`
        }
      };
    }

    return {
      ...ref,
      data: table,
      metadata: {
        title: tableName,
        description: `Table from ${databaseName}`,
      }
    };

  } catch (error) {
    return {
      ...ref,
      metadata: {
        error: `Failed to resolve table: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    };
  }
}

/**
 * Resolve agent reference: @agent:agent-id
 */
function resolveAgentReference(ref: ParsedReference): ResolvedReference {
  // Placeholder - would query actual agent database
  const knownAgents = {
    'data-analyst': {
      name: 'Data Analyst',
      description: 'Specialized in data analysis and insights',
      capabilities: ['data-analysis', 'pattern-recognition', 'insight-generation']
    },
    'report-writer': {
      name: 'Report Writer', 
      description: 'Creates comprehensive business reports',
      capabilities: ['report-generation', 'data-visualization', 'executive-summaries']
    }
  };

  const agent = knownAgents[ref.fullPath as keyof typeof knownAgents];
  
  if (!agent) {
    return {
      ...ref,
      metadata: {
        error: `Unknown agent: ${ref.fullPath}`
      }
    };
  }

  return {
    ...ref,
    data: agent,
    metadata: {
      title: agent.name,
      description: agent.description
    }
  };
}

/**
 * Resolve tool reference: @tool:tool-name
 */
function resolveToolReference(ref: ParsedReference): ResolvedReference {
  const knownTools = {
    'analyze-data': {
      name: 'Data Analysis',
      description: 'Analyze patterns in data and generate actionable business insights',
      capabilities: ['pattern-analysis', 'statistical-analysis', 'trend-identification']
    },
    'generate-report': {
      name: 'Report Generator',
      description: 'Generate comprehensive reports from data',
      capabilities: ['report-creation', 'data-formatting', 'chart-generation']
    },
    'visualize-trends': {
      name: 'Trend Visualization',
      description: 'Create charts and visualizations for trends',
      capabilities: ['chart-creation', 'trend-analysis', 'data-visualization']
    },
    'export-data': {
      name: 'Data Export',
      description: 'Export data in various formats',
      capabilities: ['csv-export', 'json-export', 'excel-export']
    }
  };

  const tool = knownTools[ref.fullPath as keyof typeof knownTools];
  
  if (!tool) {
    return {
      ...ref,
      metadata: {
        error: `Unknown tool: ${ref.fullPath}`
      }
    };
  }

  return {
    ...ref,
    data: tool,
    metadata: {
      title: tool.name,
      description: tool.description
    }
  };
}

/**
 * Create enriched context string for AI processing
 */
function createEnrichedContext(
  message: string,
  resolvedReferences: ResolvedReference[]
): string {
  if (resolvedReferences.length === 0) {
    return message;
  }

  let enrichedContext = message + '\n\n=== REFERENCE CONTEXT ===\n';
  
  resolvedReferences.forEach((ref, index) => {
    enrichedContext += `\n[${index + 1}] ${ref.originalMatch}:\n`;
    
    if (ref.metadata?.error) {
      enrichedContext += `   ERROR: ${ref.metadata.error}\n`;
    } else {
      enrichedContext += `   Title: ${ref.metadata?.title || 'Unknown'}\n`;
      enrichedContext += `   Description: ${ref.metadata?.description || 'No description'}\n`;
      
      if (ref.metadata?.content) {
        const truncatedContent = ref.metadata.content.length > 500 
          ? ref.metadata.content.substring(0, 500) + '...[truncated]'
          : ref.metadata.content;
        enrichedContext += `   Content: ${truncatedContent}\n`;
      }
      
      if (ref.metadata?.wordCount) {
        enrichedContext += `   Word Count: ${ref.metadata.wordCount.toLocaleString()}\n`;
      }
      
      if (ref.metadata?.size) {
        enrichedContext += `   File Size: ${(ref.metadata.size / 1024).toFixed(1)} KB\n`;
      }
      
      if (ref.metadata?.mimeType) {
        enrichedContext += `   MIME Type: ${ref.metadata.mimeType}\n`;
      }
    }
  });

  return enrichedContext;
}

/**
 * Helper function to find a table by database and table name
 */
function findTable(emeryData: any, databaseName: string, tableName: string) {
  if (!emeryData?.databases) return null;
  
  for (const db of emeryData.databases) {
    if (db.name === databaseName) {
      return db.tables?.find((table: any) => table.name === tableName) || null;
    }
  }
  
  return null;
}

// Re-export hasReferences from patterns for backward compatibility
export { hasReferences } from './reference-patterns';