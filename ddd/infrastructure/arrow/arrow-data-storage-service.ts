/**
 * Arrow Data Storage Service
 * 
 * Infrastructure implementation for S3/Arrow data conversion.
 * Handles JSON ↔ Arrow IPC conversion for table data storage using domain entities.
 * 
 * AIDEV-NOTE: Refactored to use DynamicTable and Field entities instead of primitive schemas
 */

import type { DataStorageService, StorageMetadata } from '@/ddd/domain/tables/services/data-storage-service';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Field } from '@/ddd/domain/fields/entities/field';
import type { Result } from '@/ddd/domain/shared/result';

// Apache Arrow imports for direct conversion
import { 
  Table, 
  tableFromIPC, 
  tableToIPC,
  tableFromArrays,
  Field as ArrowField,
  Schema,
  DataType,
  Float64,
  Bool,
  Utf8,
  Timestamp,
  TimeUnit
} from 'apache-arrow';

// Type mapping registry for Field types to Arrow types
const FIELD_TYPE_TO_ARROW_TYPE: Record<string, () => DataType> = {
  'text': () => new Utf8(),
  'email': () => new Utf8(),
  'url': () => new Utf8(),
  'number': () => new Float64(),
  'boolean': () => new Bool(),
  'date': () => new Timestamp(TimeUnit.MILLISECOND),
  'relation': () => new Utf8(), // Store as JSON string
  'file': () => new Utf8(),     // Store as JSON string
};

export class ArrowDataStorageService implements DataStorageService {
  
  /**
   * Convert JSON data to Arrow IPC buffer for S3 storage using domain entities
   */
  async storeData(
    data: Array<Record<string, any>>,
    table: DynamicTable,
    fields: Field[]
  ): Promise<Result<Buffer>> {
    try {
      // 1. Build Arrow schema from domain entities
      const arrowSchema = this.buildArrowSchema(fields);
      
      // 2. Process data to match Arrow schema requirements
      const processedData = await this.processDataForArrow(data, fields);
      
      // 3. Create Arrow Table using tableFromArrays
      const arrowTable = tableFromArrays(processedData);
      
      // 4. Convert to IPC buffer
      const buffer = tableToIPC(arrowTable);
      
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
   * Convert Arrow IPC buffer back to JSON data using domain entities
   */
  async retrieveData(
    buffer: Buffer,
    table: DynamicTable,
    fields: Field[]
  ): Promise<Result<Array<Record<string, any>>>> {
    try {
      // Convert Buffer to Uint8Array for Arrow
      const uint8Array = new Uint8Array(buffer);
      
      // Read Arrow Table from IPC buffer
      const arrowTable = tableFromIPC(uint8Array);
      
      // Convert Arrow Table back to JavaScript objects
      const rows = await this.processRowsFromArrow(arrowTable, fields);
      
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
   * Read metadata from Arrow IPC buffer with table context for domain metadata
   */
  async readMetadata(
    buffer: Buffer, 
    table: DynamicTable
  ): Promise<Result<StorageMetadata>> {
    try {
      const uint8Array = new Uint8Array(buffer);
      const arrowTable = tableFromIPC(uint8Array);
      
      return {
        success: true,
        data: {
          format: 'Apache Arrow IPC',
          totalRows: arrowTable.numRows,
          totalBytes: buffer.length,
          lastModified: new Date(),
          tableId: table.id,
          databaseId: table.databaseId,
          organizationId: table.organizationId
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
  private buildArrowSchema(fields: Field[]): Schema {
    const arrowFields = fields.map(field => {
      const createDataType = FIELD_TYPE_TO_ARROW_TYPE[field.type];
      const dataType = createDataType ? createDataType() : new Utf8();
      
      return new ArrowField(field.slug, dataType, !field.required);
    });

    return new Schema(arrowFields);
  }

  private async processDataForArrow(
    data: Array<Record<string, any>>,
    fields: Field[]
  ): Promise<Record<string, any[]>> {
    const columns: Record<string, any[]> = {};
    
    // Initialize columns
    fields.forEach(field => {
      columns[field.slug] = [];
    });
    
    // Process each row
    for (const row of data) {
      for (const field of fields) {
        let value = row[field.slug];
        
        // Handle null/undefined values
        if (value === undefined || value === null) {
          value = null;
        } else {
          // Type conversions for Arrow compatibility
          switch (field.type) {
            case 'number':
              value = Number(value);
              if (isNaN(value)) value = null;
              break;
            case 'boolean':
              value = Boolean(value);
              break;
            case 'date':
              // FieldProcessor converts dates to ISO strings
              // Convert ISO string to timestamp for Arrow storage
              value = new Date(value).getTime();
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
    fields: Field[]
  ): Promise<Array<Record<string, any>>> {
    const rows: Array<Record<string, any>> = [];
    
    // Convert Arrow table to array of objects
    const tableArray = table.toArray();
    
    for (let i = 0; i < table.numRows; i++) {
      const row: Record<string, any> = {};
      
      for (const field of fields) {
        const columnIndex = table.schema.fields.findIndex((f: any) => f.name === field.slug);
        if (columnIndex !== -1) {
          let value = tableArray[columnIndex].get(i);
          
          // Type conversions back from Arrow
          switch (field.type) {
            case 'date':
              // Convert timestamp back to ISO string for FieldProcessor
              value = value ? new Date(value).toISOString() : value;
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