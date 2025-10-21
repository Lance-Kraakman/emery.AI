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
import { Row } from '@/ddd/domain/tables/value-objects/row';
import { RowMapper } from '@/app/mappers/row-mapper';

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
  TimeUnit,
  RecordBatchStreamWriter
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
  'document': () => new Utf8(), // Store as JSON string (like file fields)
};

export class ArrowDataStorageService implements DataStorageService {
  
  /**
   * Convert Row objects to Arrow IPC buffer for S3 storage
   * Stores both field data and system metadata (id, timestamps)
   */
  async storeData(
    rows: Row[],
    table: DynamicTable
  ): Promise<Result<Buffer>> {
    try {
      // 1. Build Arrow schema including system fields + table fields
      const arrowSchema = this.buildArrowSchema(table.fields);
      
      // 2. Process Row objects to match Arrow schema requirements
      const processedData = await this.processRowsForArrow(rows, table.fields);
      
      // 3. Create Arrow Table using tableFromArrays
      const arrowTable = tableFromArrays(processedData);

      // 4. Convert to IPC stream format (not file format)
      // AIDEV-NOTE: Use RecordBatchStreamWriter for Arrow IPC stream format
      // DuckDB's nanoarrow extension has better compatibility with stream format (.arrows)
      // Stream format is simpler (no footer metadata) and matches what DuckDB itself writes
      const writer = RecordBatchStreamWriter.writeAll(arrowTable);
      const uint8Array = await writer.toUint8Array();
      const buffer = Buffer.from(uint8Array);

      return { success: true, data: buffer };
      
    } catch (error) {
      console.error('[ArrowDataStorageService] Error converting to Arrow IPC:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert to Arrow IPC'
      };
    }
  }

  /**
   * Convert Arrow IPC buffer back to Row objects
   * Uses table.fields to reconstruct Row objects with proper field metadata
   */
  async retrieveData(
    buffer: Buffer,
    table: DynamicTable
  ): Promise<Result<Row[]>> {
    try {
      // Convert Buffer to Uint8Array for Arrow
      const uint8Array = new Uint8Array(buffer);
      
      // Read Arrow Table from IPC buffer
      const arrowTable = tableFromIPC(uint8Array);
      
      // Convert Arrow Table back to Row objects
      const rows = await this.processArrowToRows(arrowTable, table);
      
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

  private async processRowsForArrow(
    rows: Row[],
    fields: readonly TableField[]
  ): Promise<Record<string, any[]>> {
    const columns: Record<string, any[]> = {};
    
    // Initialize system field columns (always present in StorageData)
    columns['id'] = [];
    columns['created_at'] = [];
    columns['updated_at'] = [];
    
    // Initialize table field columns
    fields.forEach(field => {
      columns[field.name] = [];
    });
    
    // Process each Row object
    const now = new Date().getTime();
    for (const row of rows) {
      // Validate row object
      if (!row || !row.id) {
        console.error('[ArrowDataStorageService] Invalid row object:', row);
        throw new Error('Invalid row object - missing id');
      }
      
      // Process system fields
      columns['id'].push(row.id.value);
      columns['created_at'].push(now); // Set creation time
      columns['updated_at'].push(now); // Set update time
      
      // Process table fields from Row's field values
      const plainObject = row.toPlainObject();
      for (const field of fields) {
        let value = plainObject[field.name];

        // AIDEV-NOTE: Debug logging for document field values before Arrow conversion
        if (field.type === 'document' || field.type === 'file') {
          console.log(`[processRowsForArrow] ${field.type} field "${field.name}" value from toPlainObject:`, JSON.stringify(value, null, 2));
        }

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
              // Convert Date objects or ISO strings to timestamp for Arrow storage
              value = value instanceof Date ? value.getTime() : new Date(value).getTime();
              break;
            case 'relation':
            case 'file':
            case 'document':
              // Serialize complex types to JSON for Arrow storage
              const jsonValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

              // AIDEV-NOTE: Debug logging to see the JSON serialization
              if (field.type === 'document' || field.type === 'file') {
                console.log(`[processRowsForArrow] ${field.type} field "${field.name}" JSON serialized:`, jsonValue);
              }

              value = jsonValue;
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

  private async processArrowToRows(
    arrowTable: Table,
    table: DynamicTable
  ): Promise<Row[]> {
    const rows: Row[] = [];
    const fields = table.fields;

    // Convert Arrow Table back to Row objects
    for (let i = 0; i < arrowTable.numRows; i++) {
      const rowData: Record<string, any> = {};

      // Get row ID from system fields
      const idColumn = arrowTable.getChild('id');
      if (idColumn) {
        rowData.id = idColumn.get(i);
      }

      // Process table fields (available by field name)
      for (const field of fields) {
        const column = arrowTable.getChild(field.name);

        if (column) {
          let value = column.get(i);

          // Type conversions back from Arrow to StorageData format
          switch (field.type) {
            case 'date':
              // Convert timestamp back to Date object for StorageData
              value = value ? new Date(value) : value;
              break;
            case 'relation':
            case 'file':
            case 'document':
              // AIDEV-NOTE: Debug logging to identify document retrieval issue
              console.log(`[ArrowStorage] ${field.type} field "${field.name}" raw value from Arrow:`, value, `(type: ${typeof value})`);

              // Deserialize JSON back to structured data for StorageData
              if (value !== null && value !== undefined && typeof value === 'string') {
                try {
                  let parsed = JSON.parse(value);
                  console.log(`[ArrowStorage] Parsed ${field.type} value:`, parsed, `(array length: ${Array.isArray(parsed) ? parsed.length : 'N/A'})`);

                  // CRITICAL FIX: Handle legacy data stored with wrapper object {fieldName: array}
                  // Old datasheet grid code stored as {"docs": [...]} instead of [...]
                  // Check if parsed is an object with single key matching field name
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    const keys = Object.keys(parsed);
                    if (keys.length === 1 && keys[0] === field.name) {
                      console.log(`[ArrowStorage] Unwrapping legacy data structure for field "${field.name}"`);
                      parsed = parsed[field.name];
                    }
                  }

                  value = parsed;
                } catch (e) {
                  console.warn(`[ArrowDataStorageService] Malformed ${field.type} field data:`, value, e);
                  value = null;
                }
              } else {
                console.log(`[ArrowStorage] ${field.type} value not a string, using as-is:`, value);
              }
              break;
            // Other types (text, number, boolean) are stored as-is
          }

          rowData[field.name] = value;
        }
      }

      // AIDEV-NOTE: Apply defaults for legacy data BEFORE domain validation
      // Infrastructure prepares clean data, domain validates business rules
      const withDefaults = RowMapper.applyDefaults(rowData, Array.from(fields));

      // Create Row object from the data using new signature with table fields
      const row = Row.fromPlainObject(withDefaults, table.id.value, fields);
      rows.push(row);
    }

    return rows;
  }
}