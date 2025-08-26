/**
 * Arrow Data Storage Service Implementation
 * 
 * Infrastructure implementation for converting between JSON row data and Apache Arrow IPC format.
 * Handles complex field types (files, relations) and maintains schema consistency.
 * 
 * AIDEV-NOTE: Infrastructure implementation for Arrow IPC data conversion using apache-arrow
 */
import { 
  Table, 
  tableFromIPC, 
  tableToIPC,
  tableFromArrays,
  Field,
  Schema,
  DataType,
  Int64,
  Float64,
  Bool,
  Utf8,
  Timestamp,
  TimeUnit
} from 'apache-arrow';

import type { Result } from '@/ddd/domain/shared/result';
import type { 
  DataStorageService, 
  StorageMetadata 
} from '@/ddd/domain/tables/services/data-storage-service';
import type { TableSchema, FieldSchema } from '@/ddd/domain/tables/value-objects/table-schema';

export class ArrowDataStorageService implements DataStorageService {

  async storeData(
    data: Array<Record<string, any>>,
    schema: TableSchema
  ): Promise<Result<Buffer>> {
    try {
      // 1. Build Arrow schema from table schema
      const arrowSchema = this.buildArrowSchema(schema);
      
      // 2. Process data to match Arrow schema requirements
      const processedData = await this.processDataForArrow(data, schema);
      
      // 3. Create Arrow Table using tableFromArrays
      const table = tableFromArrays(processedData);
      
      // 4. Convert to IPC buffer
      const buffer = tableToIPC(table);
      
      return { success: true, data: Buffer.from(buffer) };
      
    } catch (error) {
      console.error('[ArrowConverter] Error converting to Arrow IPC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert to Arrow IPC'
      };
    }
  }

  async retrieveData(
    buffer: Buffer,
    schema: TableSchema
  ): Promise<Result<Array<Record<string, any>>>> {
    try {
      // Convert Buffer to Uint8Array for Arrow
      const uint8Array = new Uint8Array(buffer);
      
      // Read Arrow Table from IPC buffer
      const table = tableFromIPC(uint8Array);
      
      // Convert Arrow Table back to JavaScript objects
      const rows = await this.processRowsFromArrow(table, schema);
      
      return { success: true, data: rows };
      
    } catch (error) {
      console.error('[ArrowConverter] Error converting from Arrow IPC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert from Arrow IPC'
      };
    }
  }

  async readMetadata(buffer: Buffer): Promise<Result<StorageMetadata>> {
    try {
      // Convert Buffer to Uint8Array for Arrow
      const uint8Array = new Uint8Array(buffer);
      
      // Read Arrow Table to get metadata
      const table = tableFromIPC(uint8Array);
      
      const storageMetadata: StorageMetadata = {
        format: 'arrow-ipc',
        totalRows: table.numRows,
        totalBytes: buffer.length,
        lastModified: new Date()
      };
      
      return { success: true, data: storageMetadata };
      
    } catch (error) {
      console.error('[ArrowConverter] Error reading metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read Arrow IPC metadata'
      };
    }
  }

  async convertFieldValue(
    value: any,
    fieldSchema: FieldSchema
  ): Promise<Result<any>> {
    try {
      if (value === null || value === undefined) {
        return { success: true, data: null };
      }
      
      switch (fieldSchema.type) {
        case 'file':
        case 'relation':
          // Convert objects to JSON string for Arrow storage
          if (typeof value === 'object') {
            return { success: true, data: JSON.stringify(value) };
          }
          break;
          
        case 'date':
          // Ensure dates are properly formatted as timestamps
          if (value instanceof Date) {
            return { success: true, data: value.getTime() };
          } else if (typeof value === 'string') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return { success: true, data: date.getTime() };
            }
          }
          break;
          
        case 'boolean':
          return { success: true, data: Boolean(value) };
          
        case 'number':
          const num = Number(value);
          if (!isNaN(num)) {
            return { success: true, data: num };
          }
          break;
          
        default:
          return { success: true, data: String(value) };
      }
      
      return { success: true, data: value };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert field value'
      };
    }
  }

  async convertFieldValueFromArrow(
    value: any,
    fieldSchema: FieldSchema
  ): Promise<Result<any>> {
    try {
      if (value === null || value === undefined) {
        return { success: true, data: null };
      }
      
      switch (fieldSchema.type) {
        case 'file':
        case 'relation':
          // Parse JSON strings back to objects
          if (typeof value === 'string') {
            try {
              return { success: true, data: JSON.parse(value) };
            } catch {
              return { success: true, data: value };
            }
          }
          break;
          
        case 'date':
          // Convert timestamps back to Date objects
          if (typeof value === 'number') {
            return { success: true, data: new Date(value) };
          } else if (typeof value === 'string') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return { success: true, data: date };
            }
          }
          break;
      }
      
      return { success: true, data: value };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert field value from Arrow'
      };
    }
  }

  // Private helper methods

  private buildArrowSchema(schema: TableSchema): Schema {
    const fields: Field[] = [];
    
    // Add system fields
    fields.push(Field.new('id', new Utf8()));
    fields.push(Field.new('created_at', new Timestamp(TimeUnit.MILLISECOND)));
    fields.push(Field.new('updated_at', new Timestamp(TimeUnit.MILLISECOND)));
    
    // Add user fields
    for (const field of schema.fields) {
      const arrowType = this.mapFieldTypeToArrowType(field.type);
      fields.push(Field.new(field.slug, arrowType, !field.required));
    }
    
    return new Schema(fields);
  }

  private mapFieldTypeToArrowType(fieldType: string): DataType {
    switch (fieldType) {
      case 'text':
      case 'email':
      case 'url':
      case 'file':
      case 'relation':
        return new Utf8();
      case 'number':
        return new Float64();
      case 'boolean':
        return new Bool();
      case 'date':
        return new Timestamp(TimeUnit.MILLISECOND);
      default:
        return new Utf8();
    }
  }

  private async processDataForArrow(
    data: Array<Record<string, any>>,
    schema: TableSchema
  ): Promise<Record<string, any[]>> {
    // Prepare column arrays for Arrow Table construction
    const columns: Record<string, any[]> = {};
    
    // Initialize system field arrays
    columns.id = [];
    columns.created_at = [];
    columns.updated_at = [];
    
    // Initialize user field arrays
    for (const field of schema.fields) {
      columns[field.slug] = [];
    }
    
    // Process each row
    for (const row of data) {
      // Add system fields
      columns.id.push(row.id);
      columns.created_at.push(row.created_at instanceof Date ? row.created_at.getTime() : new Date(row.created_at).getTime());
      columns.updated_at.push(row.updated_at instanceof Date ? row.updated_at.getTime() : new Date(row.updated_at).getTime());
      
      // Process user fields
      for (const field of schema.fields) {
        const value = row[field.slug];
        const convertResult = await this.convertFieldValue(value, field);
        columns[field.slug].push(convertResult.success ? convertResult.data : null);
      }
    }
    
    return columns;
  }

  private async processRowsFromArrow(
    table: Table,
    schema: TableSchema
  ): Promise<Array<Record<string, any>>> {
    const rows: Array<Record<string, any>> = [];
    
    // Convert Arrow Table to array of objects
    const tableArray = table.toArray();
    
    for (const arrowRow of tableArray) {
      const processedRow: Record<string, any> = {};
      
      // Copy system fields
      processedRow.id = arrowRow.id;
      processedRow.created_at = new Date(arrowRow.created_at);
      processedRow.updated_at = new Date(arrowRow.updated_at);
      
      // Process user fields
      for (const field of schema.fields) {
        const value = arrowRow[field.slug];
        const convertResult = await this.convertFieldValueFromArrow(value, field);
        if (convertResult.success) {
          processedRow[field.slug] = convertResult.data;
        }
      }
      
      rows.push(processedRow);
    }
    
    return rows;
  }
}