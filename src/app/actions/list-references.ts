'use server'

// AIDEV-NOTE: Simplified reference listing with proper pagination
// Replaces over-engineered search system with direct path insertion

import { requirePermission } from "./permissions";
import { getTableApplicationService } from "@/ddd/application/di/container";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { RowMapper, type DocumentFieldValue, type FileFieldValue } from "@/app/mappers/row-mapper";

export interface SimpleReference {
  id: string
  insertText: string      // "@doc:database/table/document-title"
  displayName: string     // "John's Profile Document"
  description: string     // "Document in Users table"
  category: 'doc' | 'file' | 'tool' | 'agent' | 'table'
  available: boolean
  metadata?: {
    tableId?: number
    fieldId?: number
    path?: string
    size?: number
    mimeType?: string
  }
}

export interface ReferenceListResult {
  references: SimpleReference[]
  totalCount: number
  hasMore: boolean
  nextOffset: number
}

export interface ListReferencesOptions {
  query?: string
  categories?: ('doc' | 'file' | 'tool' | 'agent' | 'table')[]
  limit?: number
  offset?: number
}

/**
 * List all available references with proper pagination
 * Simple, efficient replacement for complex search system
 */
export async function listReferences(
  emeryData: any,
  options: ListReferencesOptions = {}
): Promise<ReferenceListResult> {
  try {
    await requirePermission("data:manage");
    
    const {
      query = '',
      categories = ['doc', 'file', 'tool', 'agent', 'table'],
      limit = 20,
      offset = 0
    } = options;

    const allReferences: SimpleReference[] = [];

    // Get documents and files from tables
    if (categories.includes('doc') || categories.includes('file')) {
      const tableReferences = await getTableReferences(emeryData, query, categories);
      allReferences.push(...tableReferences);
    }

    // Get tools (hardcoded for now - could be database-driven later)
    if (categories.includes('tool')) {
      const toolReferences = getToolReferences(query);
      allReferences.push(...toolReferences);
    }

    // Get agents (from database)
    if (categories.includes('agent')) {
      const agentReferences = await getAgentReferences(emeryData, query);
      allReferences.push(...agentReferences);
    }

    // Get tables (from emeryData)
    if (categories.includes('table')) {
      const tableListReferences = getTableListReferences(emeryData, query);
      allReferences.push(...tableListReferences);
    }

    // Apply pagination
    const totalCount = allReferences.length;
    const paginatedReferences = allReferences.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;
    const nextOffset = hasMore ? offset + limit : totalCount;

    return {
      references: paginatedReferences,
      totalCount,
      hasMore,
      nextOffset
    };

  } catch (error) {
    console.error("Error listing references:", error);
    return {
      references: [],
      totalCount: 0,
      hasMore: false,
      nextOffset: 0
    };
  }
}

/**
 * Get document and file references from tables
 */
async function getTableReferences(
  emeryData: any,
  query: string,
  categories: string[]
): Promise<SimpleReference[]> {
  // Defensive check for SSR/build time when emeryData might be undefined or malformed
  if (!emeryData?.databases || !Array.isArray(emeryData.databases)) {
    return [];
  }

  const tableAppService = getTableApplicationService();
  const references: SimpleReference[] = [];

  // Get all tables from all databases with additional safety check
  const allTables = (emeryData.databases || []).flatMap((db: any) =>
    (db?.tables || []).map((table: any) => ({
      ...table,
      databaseName: db?.name || 'Unknown'
    }))
  );

  // Process each table for document/file fields
  for (const table of allTables) {
    try {
      // Get field definitions
      const fields = await tableAppService.getFieldsForTable(TableId.fromNumber(table.id));
      const relevantFields = fields.filter(field => 
        (categories.includes('doc') && field.type === 'document') ||
        (categories.includes('file') && field.type === 'file')
      );

      if (relevantFields.length === 0) continue;

      // Get rows with data
      const rowsData = await tableAppService.getRows(
        TableId.fromNumber(table.id),
        { limit: 10, offset: 0 } // Limit per table for performance
      );

      // Process rows for field values
      for (const row of rowsData) {
        const rowDTO = RowMapper.toDTO(row);

        for (const fieldValue of rowDTO.fieldValues) {
          if (!fieldValue.value) continue;

          // Handle document fields
          if (categories.includes('doc') && fieldValue.fieldType === 'document') {
            const docField = fieldValue.value as unknown as DocumentFieldValue;
            const title = docField.documentMetadata?.title || docField.name;
            
            if (!title) continue;

            // Simple query matching
            if (query && !title.toLowerCase().includes(query.toLowerCase())) {
              continue;
            }

            const insertText = `@doc:${table.databaseName}/${table.name}/${title}`;
            const wordCount = docField.documentMetadata?.tiptapMetadata?.wordCount;
            const wordInfo = wordCount ? ` (${wordCount.toLocaleString()} words)` : '';

            references.push({
              id: `doc_${table.id}_${fieldValue.fieldSlug}_${rowDTO.id}`,
              insertText,
              displayName: title,
              description: `Document in ${table.databaseName} → ${table.name}${wordInfo}`,
              category: 'doc',
              available: true,
              metadata: {
                tableId: table.id,
                path: `${table.databaseName} → ${table.name} → ${title}`
              }
            });
          }

          // Handle file fields
          if (categories.includes('file') && fieldValue.fieldType === 'file') {
            const fileField = fieldValue.value as unknown as FileFieldValue;
            const fileName = fileField.name;
            
            if (!fileName) continue;

            // Simple query matching
            if (query && !fileName.toLowerCase().includes(query.toLowerCase())) {
              continue;
            }

            const insertText = `@file:${table.databaseName}/${table.name}/${fileName}`;
            const fileSize = fileField.size ? ` (${(fileField.size / 1024).toFixed(1)} KB)` : '';
            const mimeInfo = fileField.mimeType ? ` [${fileField.mimeType}]` : '';

            references.push({
              id: `file_${table.id}_${fieldValue.fieldSlug}_${rowDTO.id}`,
              insertText,
              displayName: fileName,
              description: `File in ${table.databaseName} → ${table.name}${fileSize}${mimeInfo}`,
              category: 'file',
              available: true,
              metadata: {
                tableId: table.id,
                path: `${table.databaseName} → ${table.name} → ${fileName}`,
                size: fileField.size,
                mimeType: fileField.mimeType
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing table ${table.id}:`, error);
      continue;
    }
  }

  return references;
}

/**
 * Get available tools (hardcoded for now)
 */
function getToolReferences(query: string): SimpleReference[] {
  const tools = [
    {
      name: 'analyze-data',
      displayName: 'Data Analysis',
      description: 'Analyze patterns in data and generate insights'
    },
    {
      name: 'generate-report',
      displayName: 'Report Generator', 
      description: 'Generate comprehensive reports from data'
    },
    {
      name: 'visualize-trends',
      displayName: 'Trend Visualization',
      description: 'Create charts and visualizations for trends'
    },
    {
      name: 'export-data',
      displayName: 'Data Export',
      description: 'Export data in various formats'
    }
  ];

  return tools
    .filter(tool => 
      !query || 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.displayName.toLowerCase().includes(query.toLowerCase())
    )
    .map(tool => ({
      id: `tool_${tool.name}`,
      insertText: `@tool:${tool.name}`,
      displayName: tool.displayName,
      description: tool.description,
      category: 'tool' as const,
      available: true
    }));
}

/**
 * Get agent references (placeholder - would come from database)
 */
async function getAgentReferences(emeryData: any, query: string): Promise<SimpleReference[]> {
  // Placeholder - would query actual agent database
  const agents = [
    {
      id: 'data-analyst',
      name: 'Data Analyst',
      description: 'Specialized in data analysis and insights'
    },
    {
      id: 'report-writer', 
      name: 'Report Writer',
      description: 'Creates comprehensive business reports'
    }
  ];

  return agents
    .filter(agent =>
      !query ||
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.description.toLowerCase().includes(query.toLowerCase())
    )
    .map(agent => ({
      id: `agent_${agent.id}`,
      insertText: `@agent:${agent.id}`,
      displayName: agent.name,
      description: agent.description,
      category: 'agent' as const,
      available: true
    }));
}

/**
 * Get table references for direct table mentions
 */
function getTableListReferences(emeryData: any, query: string): SimpleReference[] {
  if (!emeryData?.databases) return [];

  const references: SimpleReference[] = [];

  for (const db of emeryData.databases) {
    for (const table of db.tables || []) {
      const tableName = table.name || 'Untitled Table';
      
      // Simple query matching
      if (query && !tableName.toLowerCase().includes(query.toLowerCase())) {
        continue;
      }

      const insertText = `@table:${db.name}/${tableName}`;
      
      references.push({
        id: `table_${table.id}`,
        insertText,
        displayName: tableName,
        description: `Table in ${db.name}`,
        category: 'table',
        available: true,
        metadata: {
          tableId: table.id,
          path: `${db.name} → ${tableName}`
        }
      });
    }
  }

  return references;
}