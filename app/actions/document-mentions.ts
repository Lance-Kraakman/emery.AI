'use server'

// AIDEV-NOTE: Server Actions for fetching document mentions data
// Provides document field data for chat mention system

import { requirePermission } from "./permissions";
import { getTableApplicationService } from "@/ddd/application/di/container";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { RowMapper, type RowDTO, type DocumentFieldValue } from "@/app/mappers/row-mapper";

export interface DocumentMention {
  id: string
  name: string
  displayName: string
  description: string
  tableId: number
  fieldId?: number
  documentField: DocumentFieldValue
  insertText: string
  path: string
}

/**
 * Fetch document mentions for a specific table
 * Returns actual DocumentFieldValue instances for mention system
 */
export async function getDocumentMentionsForTable(
  tableId: number,
  limit: number = 10
): Promise<DocumentMention[]> {
  try {
    await requirePermission("data:manage");
    
    if (!tableId) {
      throw new Error("tableId is required");
    }

    // Get table service
    const tableAppService = getTableApplicationService();
    
    // First, get field definitions to find document fields
    const fields = await tableAppService.getFieldsForTable(TableId.fromNumber(tableId));
    const documentFields = fields.filter(field => field.type === 'document');
    
    if (documentFields.length === 0) {
      return []; // No document fields in this table
    }

    // Get recent rows that might contain document data
    const rowsData = await tableAppService.getRows(
      TableId.fromNumber(tableId), 
      { limit, offset: 0 }
    );
    
    const mentions: DocumentMention[] = [];
    
    // Process rows to extract document field values
    for (const row of rowsData) {
      const rowDTO = RowMapper.toDTO(row);
      
      for (const fieldValue of rowDTO.fieldValues) {
        if (fieldValue.fieldType === 'document' && fieldValue.value) {
          const docField = fieldValue.value as unknown as DocumentFieldValue;
          
          // Skip if no meaningful document data
          if (!docField.name && !docField.documentMetadata?.title) {
            continue;
          }
          
          const title = docField.documentMetadata?.title || docField.name || 'Untitled Document';
          const wordCount = docField.documentMetadata?.tiptapMetadata?.wordCount;
          const wordInfo = wordCount ? ` (${wordCount.toLocaleString()} words)` : '';
          
          mentions.push({
            id: `doc_${tableId}_${fieldValue.fieldSlug}_${rowDTO.id}`,
            name: title.toLowerCase().replace(/\s+/g, '-'),
            displayName: title,
            description: `Document in table${wordInfo}`,
            tableId: tableId,
            fieldId: undefined, // Would need field ID lookup
            documentField: docField,
            insertText: `@doc:${title.toLowerCase().replace(/\s+/g, '-')}`,
            path: `Table ${tableId} → ${title}`
          });
        }
      }
    }
    
    return mentions.slice(0, limit); // Limit results
    
  } catch (error) {
    console.error("Error fetching document mentions:", error);
    return []; // Return empty array instead of throwing
  }
}

/**
 * Fetch document mentions across all tables in organization
 * Limited to prevent performance issues
 */
export async function getAllDocumentMentions(limit: number = 50): Promise<DocumentMention[]> {
  try {
    await requirePermission("data:manage");
    
    // This is a placeholder - in a real implementation, you'd want to:
    // 1. Get all tables for the organization
    // 2. Query document fields efficiently
    // 3. Cache results for performance
    
    // For now, return empty array to avoid performance issues
    console.log('getAllDocumentMentions: Not implemented yet - would query all tables');
    return [];
    
  } catch (error) {
    console.error("Error fetching all document mentions:", error);
    return [];
  }
}