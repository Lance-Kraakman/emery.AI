/**
 * Arrow Data Storage Service
 * 
 * Infrastructure implementation for S3/Arrow data conversion.
 * Handles JSON ↔ Arrow IPC conversion for table data storage.
 * 
 * AIDEV-NOTE: Simplified from bloated ArrowTableDataService - now contains 
 * only the real, working Arrow conversion functionality
 */

import type { DataStorageService, StorageMetadata } from '@/ddd/domain/tables/services/data-storage-service';
import type { TableSchema } from '@/ddd/domain/tables/types/schema-types';
import type { Result } from '@/ddd/domain/shared/result';

// Apache Arrow imports for direct conversion
import { 
  Table, 
  tableFromIPC, 
  tableToIPC,
  tableFromArrays,
  Field,
  Schema,
  DataType,
  Float64,
  Bool,
  Utf8,
  Timestamp,
  TimeUnit
} from 'apache-arrow';

export class ArrowDataStorageService implements DataStorageService {
  
  /**
   * Convert JSON data to Arrow IPC buffer for S3 storage
   */
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
      console.error('[ArrowDataStorageService] Error converting to Arrow IPC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert to Arrow IPC'
      };
    }
  }

  /**
   * Convert Arrow IPC buffer back to JSON data
   */
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
      console.error('[ArrowDataStorageService] Error converting from Arrow IPC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert from Arrow IPC'
      };
    }
  }

  /**
   * Read metadata from Arrow IPC buffer without loading full data
   */
  async readMetadata(buffer: Buffer): Promise<Result<StorageMetadata>> {
    try {
      const uint8Array = new Uint8Array(buffer);
      const table = tableFromIPC(uint8Array);
      
      return {
        success: true,
        data: {
          format: 'Apache Arrow IPC',
          totalRows: table.numRows,
          totalBytes: buffer.length,
          lastModified: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read Arrow metadata'
      };
    }
  }

  // Arrow conversion helper methods
  private buildArrowSchema(schema: TableSchema): Schema {
    const fields = schema.fields.map(field => {
      let dataType: DataType;
      
      switch (field.type) {
        case 'text':
        case 'email':
        case 'url':
          dataType = new Utf8();
          break;
        case 'number':
          dataType = new Float64();
          break;
        case 'boolean':
          dataType = new Bool();
          break;
        case 'date':
          dataType = new Timestamp(TimeUnit.MILLISECOND);
          break;
        case 'relation':
        case 'file':
          // Store as JSON string for complex types
          dataType = new Utf8();
          break;
        default:
          dataType = new Utf8();
      }
      
      return new Field(field.slug, dataType, !field.required);
    });

    return new Schema(fields);
  }

  private async processDataForArrow(
    data: Array<Record<string, any>>,
    schema: TableSchema
  ): Promise<Record<string, any[]>> {
    const columns: Record<string, any[]> = {};
    
    // Initialize columns
    schema.fields.forEach(field => {
      columns[field.slug] = [];
    });
    
    // Process each row
    for (const row of data) {
      for (const field of schema.fields) {
        let value = row[field.slug];
        
        // Handle null/undefined values
        if (value === undefined || value === null) {
          value = null;
        } else {
          // Type conversions for Arrow compatibility
          switch (field.type) {
            case 'number':
              value = typeof value === 'string' ? parseFloat(value) : Number(value);
              if (isNaN(value)) value = null;
              break;
            case 'boolean':
              value = Boolean(value);
              break;
            case 'date':
              if (value instanceof Date) {
                value = value.getTime();
              } else {
                const parsed = new Date(value);
                value = isNaN(parsed.getTime()) ? null : parsed.getTime();
              }
              break;
            case 'relation':
            case 'file':
              // Serialize complex types to JSON
              value = typeof value === 'object' ? JSON.stringify(value) : String(value);
              break;
            default:
              value = String(value);
          }
        }
        
        columns[field.slug].push(value);
      }
    }
    
    return columns;
  }

  private async processRowsFromArrow(
    table: Table,
    schema: TableSchema
  ): Promise<Array<Record<string, any>>> {
    const rows: Array<Record<string, any>> = [];
    
    // Convert Arrow table to array of objects
    const tableArray = table.toArray();
    
    for (let i = 0; i < table.numRows; i++) {
      const row: Record<string, any> = {};
      
      for (const field of schema.fields) {
        const columnIndex = table.schema.fields.findIndex((f: any) => f.name === field.slug);
        if (columnIndex !== -1) {
          let value = tableArray[columnIndex].get(i);
          
          // Type conversions back from Arrow
          switch (field.type) {
            case 'date':
              if (value !== null && value !== undefined) {
                value = new Date(value);
              }
              break;
            case 'relation':
            case 'file':
              if (value !== null && value !== undefined && typeof value === 'string') {
                try {
                  value = JSON.parse(value);
                } catch {
                  // Keep as string if not valid JSON
                }
              }
              break;
          }
          
          row[field.slug] = value;
        }
      }
      
      rows.push(row);
    }
    
    return rows;
  }
}