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
import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';
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
    table: DynamicTable
  ): Promise<Result<Buffer>> {
    try {
      // 1. Build Arrow schema from table's fields (now includes system fields)
      const arrowSchema = this.buildArrowSchema(table.fields);
      
      // 2. Process data to match Arrow schema requirements
      const processedData = await this.processDataForArrow(data, table.fields);
      
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
    table: DynamicTable
  ): Promise<Result<Array<Record<string, any>>>> {
    try {
      // Convert Buffer to Uint8Array for Arrow
      const uint8Array = new Uint8Array(buffer);
      
      // Read Arrow Table from IPC buffer
      const arrowTable = tableFromIPC(uint8Array);
      
      // Convert Arrow Table back to JavaScript objects (now includes system fields)
      const rows = await this.processRowsFromArrow(arrowTable, table.fields);
      
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
  private buildArrowSchema(fields: readonly TableField[]): Schema {
    // Start with system fields that are always present in stored data
    const systemFields = [
      new ArrowField('id', new Utf8(), false), // ID is required
      new ArrowField('created_at', new Timestamp(TimeUnit.MILLISECOND), false), // Created timestamp is required
      new ArrowField('updated_at', new Timestamp(TimeUnit.MILLISECOND), false), // Updated timestamp is required
    ];
    
    // Add user-defined table fields
    const tableFields = fields.map(field => {
      const createDataType = FIELD_TYPE_TO_ARROW_TYPE[field.type];
      const dataType = createDataType ? createDataType() : new Utf8();
      
      return new ArrowField(field.name, dataType, !field.required);
    });

    // Combine system fields + table fields
    return new Schema([...systemFields, ...tableFields]);
  }

  private async processDataForArrow(
    data: Array<Record<string, any>>,
    fields: readonly TableField[]
  ): Promise<Record<string, any[]>> {
    const columns: Record<string, any[]> = {};
    
    // Initialize system field columns
    columns['id'] = [];
    columns['created_at'] = [];
    columns['updated_at'] = [];
    
    // Initialize table field columns
    fields.forEach(field => {
      columns[field.name] = [];
    });
    
    // Process each row
    for (const row of data) {
      // Process system fields first
      columns['id'].push(row.id || null);
      columns['created_at'].push(row.created_at ? new Date(row.created_at).getTime() : null);
      columns['updated_at'].push(row.updated_at ? new Date(row.updated_at).getTime() : null);
      
      // Process table fields
      for (const field of fields) {
        let value = row[field.name];
        
        // Debug: console.log(`[ArrowDataStorageService] STORAGE DEBUG: ${field.type} field '${field.name}' input value:`, value, 'type:', typeof value, 'isArray:', Array.isArray(value));
        
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
        
        columns[field.name].push(value);
      }
    }
    
    return columns;
  }

  private async processRowsFromArrow(
    table: Table,
    fields: readonly TableField[]
  ): Promise<Array<Record<string, any>>> {
    const rows: Array<Record<string, any>> = [];
    
    // Get columns directly from table
    for (let i = 0; i < table.numRows; i++) {
      const row: Record<string, any> = {};
      
      // Process system fields first
      const idColumn = table.getChild('id');
      const createdAtColumn = table.getChild('created_at');
      const updatedAtColumn = table.getChild('updated_at');
      
      if (idColumn) {
        row.id = idColumn.get(i);
      }
      
      if (createdAtColumn) {
        const timestamp = createdAtColumn.get(i);
        row.created_at = timestamp ? new Date(timestamp) : null;
      }
      
      if (updatedAtColumn) {
        const timestamp = updatedAtColumn.get(i);
        row.updated_at = timestamp ? new Date(timestamp) : null;
      }
      
      // Process table fields
      for (const field of fields) {
        const column = table.getChild(field.name);
        if (column) {
          let value = column.get(i);
          
          // Type conversions back from Arrow
          switch (field.type) {
            case 'date':
              // Convert timestamp back to ISO string for domain processing
              value = value ? new Date(value).toISOString() : value;
              break;
            case 'relation':
            case 'file':
              // Relation and file fields should already be proper structured data
              // No string parsing needed - they are stored as serialized JSON objects
              // and retrieved as structured data by Arrow
              // Debug: console.log(`[ArrowDataStorageService] DEBUG: ${field.type} field '${field.name}' raw value:`, value, 'type:', typeof value);
              if (value !== null && value !== undefined && typeof value === 'string') {
                try {
                  value = JSON.parse(value);
                  // Debug: console.log(`[ArrowDataStorageService] DEBUG: ${field.type} field '${field.name}' after JSON.parse:`, value, 'isArray:', Array.isArray(value));
                } catch {
                  // If parsing fails, this indicates malformed data
                  console.warn(`[ArrowDataStorageService] Malformed ${field.type} field data:`, value);
                  value = null;
                }
              } else {
                // Debug: console.log(`[ArrowDataStorageService] DEBUG: ${field.type} field '${field.name}' not a string, value:`, value, 'isArray:', Array.isArray(value));
              }
              break;
          }
          
          row[field.name] = value;
        }
      }
      
      rows.push(row);
    }
    
    return rows;
  }
}