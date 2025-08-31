/**
 * Table Data Mapper
 * 
 * Handles all data format conversions between domain and storage layers.
 * Centralizes the mapping logic to eliminate confusion and data loss.
 * 
 * AIDEV-NOTE: Single source of truth for data transformations.
 * Keeps domain clean of storage concerns while providing clear conversion contracts.
 */

import { nanoid } from 'nanoid';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { RowData, FieldValidationResult } from '@/ddd/domain/tables/value-objects/field-values';

/**
 * Storage format for Arrow/S3 persistence
 * Uses field names (not column names) for simplicity with Arrow
 */
export interface StorageData {
  id: string;
  created_at: Date | string;
  updated_at: Date | string;
  [fieldName: string]: any; // Field names like "Relations", "Name", etc.
}

export class TableDataMapper {
  /**
   * Convert user-facing RowData to storage format
   * Adds system fields and ensures proper typing
   */
  static toStorageFormat(data: RowData, table: DynamicTable): StorageData {
    const now = new Date();
    
    // For new rows, generate ID if not provided
    const id = data.id || nanoid();
    
    // Remove id from data to avoid duplication
    const { id: _id, ...fieldData } = data;
    
    // Return storage format with system fields
    return {
      id,
      created_at: now,
      updated_at: now,
      ...fieldData // Keep field names as-is for Arrow
    };
  }
  
  /**
   * Convert storage format back to user-facing RowData
   * Arrow already stores field names, so this is mostly pass-through
   */
  static fromStorageFormat(data: StorageData): RowData {
    // Extract system fields and return as RowData
    const { created_at, updated_at, ...rowData } = data;
    
    // Include id in the row data (it's part of RowData interface)
    return rowData as RowData;
  }
  
  /**
   * Update existing storage data with new values
   * Preserves system fields while updating user data
   */
  static updateStorageData(existing: StorageData, updates: Partial<RowData>): StorageData {
    // Remove id from updates to prevent changing it
    const { id: _id, ...fieldUpdates } = updates;
    
    return {
      ...existing,
      ...fieldUpdates,
      updated_at: new Date() // Always update timestamp
    };
  }
  
  /**
   * Validate row data against table schema
   * Delegates to domain entity for business rule validation
   */
  static validate(data: RowData, table: DynamicTable): FieldValidationResult {
    return table.validateRowData(data);
  }
  
  /**
   * Process multiple rows for bulk operations
   */
  static toStorageFormatBulk(rows: RowData[], table: DynamicTable): StorageData[] {
    return rows.map(row => TableDataMapper.toStorageFormat(row, table));
  }
  
  /**
   * Process multiple rows from storage
   */
  static fromStorageFormatBulk(rows: StorageData[]): RowData[] {
    return rows.map(row => TableDataMapper.fromStorageFormat(row));
  }
}