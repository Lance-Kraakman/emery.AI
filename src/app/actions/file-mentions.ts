'use server'

// AIDEV-NOTE: Server Actions for fetching file mentions data
// Provides file field data for chat mention system

import { requirePermission } from "./permissions";
import { getTableApplicationService, getRowApplicationService } from "@/ddd/application/di/container";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { RowMapper, type RowDTO, type FileFieldValue } from "@/app/mappers/row-mapper";

export interface FileMention {
  id: string
  name: string
  displayName: string
  description: string
  tableId: number
  fieldId?: number
  fileField: FileFieldValue
  insertText: string
  path: string
}

/**
 * Fetch file mentions for a specific table
 * Returns actual FileFieldValue instances for mention system
 */
export async function getFileMentionsForTable(
  tableId: number,
  limit: number = 10
): Promise<FileMention[]> {
  try {
    await requirePermission("table:manage");
    
    if (!tableId) {
      throw new Error("tableId is required");
    }

    // Get table and row services
    const tableAppService = getTableApplicationService();
    const rowAppService = getRowApplicationService();

    // First, get field definitions to find file fields
    const fields = await tableAppService.getFieldsForTable(TableId.fromNumber(tableId));
    const fileFields = fields.filter(field => field.type === 'file');

    if (fileFields.length === 0) {
      return []; // No file fields in this table
    }

    // Get recent rows that might contain file data
    const rowsData = await rowAppService.getRows(
      TableId.fromNumber(tableId), 
      { limit, offset: 0 }
    );
    
    const mentions: FileMention[] = [];
    
    // Process rows to extract file field values
    for (const row of rowsData) {
      const rowDTO = RowMapper.toDTO(row);
      
      for (const fieldValue of rowDTO.fieldValues) {
        if (fieldValue.fieldType === 'file' && fieldValue.value) {
          const fileField = fieldValue.value as unknown as FileFieldValue;
          
          // Skip if no meaningful file data
          if (!fileField.name) {
            continue;
          }
          
          const fileName = fileField.name || 'Untitled File';
          const fileSize = fileField.size ? ` (${(fileField.size / 1024).toFixed(1)} KB)` : '';
          
          mentions.push({
            id: `file_${tableId}_${fieldValue.fieldId}_${rowDTO.id}`,
            name: fileName.toLowerCase().replace(/\s+/g, '-'),
            displayName: fileName,
            description: `File in table${fileSize}`,
            tableId: tableId,
            fieldId: undefined, // Would need field ID lookup
            fileField: fileField,
            insertText: `@file:${fileName.toLowerCase().replace(/\s+/g, '-')}`,
            path: `Table ${tableId} → ${fileName}`
          });
        }
      }
    }
    
    return mentions.slice(0, limit); // Limit results
    
  } catch (error) {
    console.error("Error fetching file mentions:", error);
    return []; // Return empty array instead of throwing
  }
}

/**
 * Fetch file mentions across all tables in organization
 * Limited to prevent performance issues
 */
export async function getAllFileMentions(limit: number = 50): Promise<FileMention[]> {
  try {
    await requirePermission("table:manage");
    
    // This is a placeholder - in a real implementation, you'd want to:
    // 1. Get all tables for the organization
    // 2. Query file fields efficiently
    // 3. Cache results for performance
    
    // For now, return empty array to avoid performance issues
    console.log('getAllFileMentions: Not implemented yet - would query all tables');
    return [];
    
  } catch (error) {
    console.error("Error fetching all file mentions:", error);
    return [];
  }
}