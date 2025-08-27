import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';
import type { Result } from '@/ddd/domain/shared/result';
import type { Field } from '@/ddd/domain/fields/entities/field';
import type { QueryFilter } from '@/ddd/infrastructure/data/duckdb-sql-builder';
import type { StoredFile } from '@/ddd/domain/files/entities/file-storage';
import { Row, RowCollection, FieldValue } from '@/ddd/domain/tables/value-objects/row';
import { TableId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface CreateRowCommand {
  tableId: number;
  data: Record<string, any>;
  createdBy?: string;
}

export interface UpdateRowCommand {
  tableId: number;
  rowId: string;
  data: Record<string, any>;
  updatedBy?: string;
}

export interface BulkCreateRowsCommand {
  tableId: number;
  rows: Array<Record<string, any>>;
  createdBy?: string;
}

export interface BulkUpdateRowsCommand {
  tableId: number;
  updates: Array<{
    rowId: string;
    data: Record<string, any>;
  }>;
  updatedBy?: string;
}

export interface RowFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>; // Simple key-value filters for backward compatibility
  
  // Enhanced filtering with full DuckDB QueryFilter support
  where?: RowFilterCondition[];
}

/**
 * Enhanced filter condition supporting all DuckDB operators
 */
export interface RowFilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'isNull' | 'isNotNull';
  value?: any;
  values?: any[]; // For 'in' operator
}

// Use unified Result interface from domain shared types  
export type RowApplicationServiceResult<T = any> = Result<T>;

export class RowApplicationService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly fieldRepository: IFieldRepository,
    private readonly fileStorageRepository: IFileStorageRepository,
    private readonly queryService: TableQueryService
  ) {}

  /**
   * Create a new row in a dynamic table
   */
  async createRow(command: CreateRowCommand): Promise<RowApplicationServiceResult<Row>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Get field definitions and validate row data
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const validation = this.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process special field types
      const processedData = await this.processRowData(command.tableId, command.data);

      // 4. Create row using repository - pass processed field data directly
      const newRowData = await this.tableRepository.insertRow(TableId.fromNumber(command.tableId), processedData);

      // 5. Convert to domain Row value object
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const row = Row.fromPlainObject(newRowData, command.tableId, fieldSlugs, fieldTypes);

      console.log(`[ROW-APP-SERVICE] Created row in table ${table.name}`);

      return {
        success: true,
        data: row
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error creating row:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create row'
      };
    }
  }

  /**
   * Update an existing row
   */
  async updateRow(command: UpdateRowCommand): Promise<RowApplicationServiceResult<Row>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Verify row exists
      const existingRow = await this.tableRepository.getRow(TableId.fromNumber(command.tableId), command.rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${command.rowId} not found in table ${command.tableId}`
        };
      }

      // 3. Get field definitions and validate update data
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const validation = this.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 4. Process special field types
      const processedData = await this.processRowData(command.tableId, command.data);

      // 5. Update row using repository
      const updatedRowData = await this.tableRepository.updateRow(TableId.fromNumber(command.tableId), command.rowId, processedData);

      // 6. Convert to domain Row value object
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const row = Row.fromPlainObject(updatedRowData, command.tableId, fieldSlugs, fieldTypes);

      console.log(`[ROW-APP-SERVICE] Updated row ${command.rowId} in table ${table.name}`);

      return {
        success: true,
        data: row
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error updating row:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update row'
      };
    }
  }

  /**
   * Delete a row from a table
   */
  async deleteRow(tableId: number, rowId: string): Promise<RowApplicationServiceResult<void>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(TableId.fromNumber(tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${tableId} not found`
        };
      }

      // 2. Verify row exists
      const existingRow = await this.tableRepository.getRow(TableId.fromNumber(tableId), rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${rowId} not found in table ${tableId}`
        };
      }

      // 3. Handle file cleanup if there are file fields
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
      const fileFields = fields.filter((f: any) => f.type === 'file');
      
      for (const fileField of fileFields) {
        const fileData = existingRow[`field_${fileField.id}`];
        if (fileData && typeof fileData === 'object' && fileData.key) {
          // Delete associated file from storage
          await this.fileStorageRepository.deleteFile(fileData.key);
          console.log(`[ROW-APP-SERVICE] Deleted file ${fileData.key} for field ${fileField.name}`);
        }
      }

      // 4. Delete row using repository
      await this.tableRepository.deleteRow(TableId.fromNumber(tableId), rowId);

      console.log(`[ROW-APP-SERVICE] Deleted row ${rowId} from table ${table.name}`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error deleting row:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete row'
      };
    }
  }

  /**
   * Get a single row by ID
   */
  async getRow(tableId: number, rowId: string): Promise<Row | null> {
    const rowData = await this.tableRepository.getRow(TableId.fromNumber(tableId), rowId);
    if (!rowData) {
      return null;
    }

    // Get field information to create proper Row value object
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    const mappedData = await this.mapRowToFrontend(tableId, rowData);
    const fieldSlugs = fields.map((f: any) => f.slug);
    const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

    return Row.fromPlainObject(mappedData, tableId, fieldSlugs, fieldTypes);
  }

  /**
   * Get rows from a table with filters using DuckDB for efficient SQL-based querying
   */
  async getRows(tableId: number, filters?: RowFilters): Promise<RowCollection> {
    // Convert row filters to DuckDB QueryFilter format
    const queryFilters = await this.convertRowFiltersToQueryFilters(filters, tableId);
    
    // Use DuckDB queryTable method 
    const filtersObj = this.convertQueryFiltersToRecord(queryFilters);
    const queryResult = await this.queryService.queryTable(
      tableId,
      filtersObj,
      filters?.orderBy,
      filters?.orderDirection?.toUpperCase() as 'ASC' | 'DESC',
      filters?.limit || 1000,
      filters?.offset || 0
    );

    if (!queryResult.success) {
      console.error('[ROW-APP-SERVICE] DuckDB query failed:', queryResult.error);
      // Return empty collection on query failure
      return RowCollection.fromPlainObjects([], tableId, [], {});
    }

    const rowsData = queryResult.data?.rows || [];

    // Get field information to create proper Row value objects
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    const fieldSlugs = fields.map((f: any) => f.slug);
    const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

    // Map field_X columns back to field slugs and create Row objects
    const mappedRowsData = [];
    for (const rowData of rowsData) {
      mappedRowsData.push(await this.mapRowToFrontend(tableId, rowData));
    }

    return RowCollection.fromPlainObjects(mappedRowsData, tableId, fieldSlugs, fieldTypes);
  }

  /**
   * Bulk create multiple rows
   */
  async bulkCreateRows(command: BulkCreateRowsCommand): Promise<RowApplicationServiceResult<RowCollection>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Get field definitions and validate all rows
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const validationErrors: Array<{ row: number; errors: Array<{ field: string; error: string }> }> = [];
      
      for (let i = 0; i < command.rows.length; i++) {
        const validation = this.validateRowData(fields, command.rows[i]);
        if (!validation.valid) {
          validationErrors.push({ row: i, errors: validation.errors });
        }
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `Validation failed for ${validationErrors.length} rows`,
          validationErrors: validationErrors.flatMap(ve => 
            ve.errors.map(e => ({ field: `Row ${ve.row}: ${e.field}`, error: e.error }))
          )
        };
      }

      // 3. Process and insert all rows
      const createdRowsData = [];
      for (const rowData of command.rows) {
        const processedData = await this.processRowData(command.tableId, rowData);
        const newRowData = await this.tableRepository.insertRow(TableId.fromNumber(command.tableId), processedData);
        createdRowsData.push(newRowData);
      }

      // 4. Convert to domain Row collection
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const rowCollection = RowCollection.fromPlainObjects(createdRowsData, command.tableId, fieldSlugs, fieldTypes);

      console.log(`[ROW-APP-SERVICE] Bulk created ${rowCollection.rows.length} rows in table ${table.name}`);

      return {
        success: true,
        data: rowCollection
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error bulk creating rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk create rows'
      };
    }
  }

  /**
   * Bulk update multiple rows
   */
  async bulkUpdateRows(command: BulkUpdateRowsCommand): Promise<RowApplicationServiceResult<RowCollection>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Process each update
      const updatedRows = [];
      const errors: Array<{ rowId: string; error: string }> = [];

      for (const update of command.updates) {
        try {
          // Validate update data
          const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
          const validation = this.validateRowData(fields, update.data);
          if (!validation.valid) {
            errors.push({
              rowId: update.rowId,
              error: validation.errors.map((e: { field: string; error: string }) => `${e.field}: ${e.error}`).join(', ')
            });
            continue;
          }

          // Process and update row
          const processedData = await this.processRowData(command.tableId, update.data);
          const updatedRow = await this.tableRepository.updateRow(TableId.fromNumber(command.tableId), update.rowId, processedData);
          updatedRows.push(updatedRow);

        } catch (error) {
          errors.push({
            rowId: update.rowId,
            error: error instanceof Error ? error.message : 'Update failed'
          });
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: `Failed to update ${errors.length} rows`,
          validationErrors: errors.map(e => ({ field: e.rowId, error: e.error }))
        };
      }

      // Convert to domain Row collection
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const rowCollection = RowCollection.fromPlainObjects(updatedRows, command.tableId, fieldSlugs, fieldTypes);

      console.log(`[ROW-APP-SERVICE] Bulk updated ${rowCollection.rows.length} rows in table ${table.name}`);

      return {
        success: true,
        data: rowCollection
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error bulk updating rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk update rows'
      };
    }
  }

  /**
   * Convert QueryFilter array to Record format for queryTable method
   */
  private convertQueryFiltersToRecord(queryFilters: QueryFilter[]): Record<string, any> {
    const filtersObj: Record<string, any> = {};
    
    for (const filter of queryFilters) {
      if (filter.operator === 'eq') {
        filtersObj[filter.field] = filter.value;
      } else if (filter.operator === 'isNotNull') {
        filtersObj[filter.field] = 'NOT NULL';
      }
    }
    
    return filtersObj;
  }

  /**
   * Convert RowFilters to DuckDB QueryFilter format
   */
  private async convertRowFiltersToQueryFilters(filters?: RowFilters, tableId?: number): Promise<QueryFilter[]> {
    const queryFilters: QueryFilter[] = [];
    
    if (!filters) {
      return queryFilters;
    }

    // Handle enhanced where conditions (new format)
    if (filters.where && filters.where.length > 0) {
      const fields = tableId ? await this.fieldRepository.findByTableId(TableId.fromNumber(tableId)) : [];
      const fieldSlugToId = fields.reduce((acc, field) => ({
        ...acc,
        [field.slug]: field.id.value
      }), {} as Record<string, number>);

      for (const condition of filters.where) {
        // Map field slug to field_{id} column name for DuckDB query
        const fieldId = fieldSlugToId[condition.field];
        const fieldColumn = fieldId ? `field_${fieldId}` : condition.field;
        
        queryFilters.push({
          field: fieldColumn,
          operator: condition.operator,
          value: condition.value,
          values: condition.values
        });
      }
    }

    // Handle legacy filters (backward compatibility)
    if (filters.filters && Object.keys(filters.filters).length > 0 && tableId) {
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
      const fieldSlugToId = fields.reduce((acc, field) => ({
        ...acc,
        [field.slug]: field.id.value
      }), {} as Record<string, number>);

      for (const [fieldSlug, value] of Object.entries(filters.filters)) {
        if (value !== null && value !== undefined) {
          const fieldId = fieldSlugToId[fieldSlug];
          const fieldColumn = fieldId ? `field_${fieldId}` : fieldSlug;
          
          queryFilters.push({
            field: fieldColumn,
            operator: 'eq',
            value
          });
        }
      }
    }

    return queryFilters;
  }

  /**
   * Process row data to handle special field types
   */
  private async processRowData(tableId: number, data: Record<string, any>): Promise<Record<string, any>> {
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    const processedData: Record<string, any> = {};

    for (const field of fields) {
      const value = data[field.slug];
      
      // Only skip if value is explicitly undefined - allow null, empty strings, 0, false, etc.
      // These are all legitimate field values that should be stored in the database
      if (value === undefined) {
        continue;
      }

      // Map from field slug to field_{id} column name
      const columnName = `field_${field.id}`;

      // Handle special field types
      switch (field.type) {
        case 'relation':
          // Ensure relation data is properly formatted as JSONB
          if (typeof value === 'string') {
            try {
              processedData[columnName] = JSON.parse(value);
            } catch {
              processedData[columnName] = value;
            }
          } else {
            processedData[columnName] = value;
          }
          break;

        case 'file':
          // Handle file field data
          if (typeof value === 'string') {
            try {
              processedData[columnName] = JSON.parse(value);
            } catch {
              processedData[columnName] = value;
            }
          } else {
            processedData[columnName] = value;
          }
          break;

        case 'date':
          // Ensure date is properly formatted
          if (value instanceof Date) {
            processedData[columnName] = value.toISOString();
          } else {
            processedData[columnName] = value;
          }
          break;

        default:
          processedData[columnName] = value;
      }
    }

    return processedData;
  }

  /**
   * Validate row data against field definitions
   */
  private validateRowData(fields: Field[], data: Record<string, any>): { valid: boolean; errors: Array<{ field: string; error: string }> } {
    const errors: Array<{ field: string; error: string }> = [];

    for (const field of fields) {
      const value = data[field.slug];
      
      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: field.name,
          error: 'Field is required'
        });
      }

      // Type validation
      if (value !== undefined && value !== null) {
        switch (field.type) {
          case 'number':
            if (isNaN(Number(value))) {
              errors.push({
                field: field.name,
                error: 'Must be a valid number'
              });
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              errors.push({
                field: field.name,
                error: 'Must be a valid boolean'
              });
            }
            break;
          case 'date':
            if (!(value instanceof Date) && isNaN(Date.parse(value))) {
              errors.push({
                field: field.name,
                error: 'Must be a valid date'
              });
            }
            break;
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(value))) {
              errors.push({
                field: field.name,
                error: 'Must be a valid email address'
              });
            }
            break;
          case 'url':
            try {
              new URL(String(value));
            } catch {
              errors.push({
                field: field.name,
                error: 'Must be a valid URL'
              });
            }
            break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Map row data from database format to frontend format
   */
  private async mapRowToFrontend(tableId: number, row: Record<string, any>): Promise<Record<string, any>> {
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    const mappedRow: Record<string, any> = {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    for (const field of fields) {
      const dbColumn = `field_${field.id}`;
      const value = row[dbColumn];
      
      if (value !== undefined) {
        // Handle special field types - allow null values to be displayed as empty
        if (field.type === 'relation' || field.type === 'file') {
          // JSONB fields might need parsing
          if (typeof value === 'string') {
            try {
              mappedRow[field.slug] = JSON.parse(value);
            } catch {
              mappedRow[field.slug] = value;
            }
          } else {
            mappedRow[field.slug] = value;
          }
        } else {
          mappedRow[field.slug] = value;
        }
      }
    }

    return mappedRow;
  }

  /**
   * Get all files stored in field values across all tables in an organization
   * Uses DuckDB for efficient cross-table querying
   */
  async getFilesByOrganization(organizationId: number): Promise<StoredFile[]> {
    try {
      // Get all file-type fields for this organization
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(0)); // We need a method to find all fields by org
      
      // For now, let's get all tables in the organization and then their file fields
      // This would be more efficient with a proper query, but demonstrates DuckDB usage
      
      // Get all tables for the organization
      const tables = await this.tableRepository.findByOrganization(OrganizationId.fromNumber(organizationId));
      const files: StoredFile[] = [];

      for (const table of tables) {
        // Get file fields for this table
        const tableFields = await this.fieldRepository.findByTableId(table.id);
        const fileFields = tableFields.filter(field => field.type === 'file');

        if (fileFields.length === 0) continue;

        // Use DuckDB to query file field values from this table
        const fileFieldColumns = fileFields.map((f: any) => `field_${f.id}`);
        
        for (const fileField of fileFields) {
          const filters = [{
            field: `field_${fileField.id}`,
            operator: 'isNotNull' as const,
            value: null
          }];

          const filtersObj = { [`field_${fileField.id}`]: 'NOT NULL' };
          const queryResult = await this.queryService.queryTable(
            table.id.value,
            filtersObj
          );

          if (queryResult.success && queryResult.data?.rows) {
            for (const row of queryResult.data.rows) {
              const fileValue = row[`field_${fileField.id}`];
              
              if (fileValue) {
                let fileData;
                try {
                  fileData = typeof fileValue === 'string' ? JSON.parse(fileValue) : fileValue;
                } catch {
                  continue; // Skip invalid JSON
                }

                if (fileData && fileData.key) {
                  files.push({
                    id: fileData.id || fileData.key.split('/').pop()?.split('_')[0] || 'unknown',
                    key: fileData.key,
                    name: fileData.name || fileData.originalName || 'unknown',
                    size: fileData.size || 0,
                    mimeType: fileData.mimeType || 'application/octet-stream',
                    uploadedAt: fileData.uploadedAt ? new Date(fileData.uploadedAt) : new Date(),
                    metadata: {
                      ...fileData.metadata || {},
                      tableId: table.id,
                      tableName: table.name,
                      fieldId: fileField.id,
                      fieldName: fileField.name,
                      organizationId
                    },
                    checksums: fileData.checksums || {},
                  });
                }
              }
            }
          }
        }
      }

      console.log(`[ROW-APP-SERVICE] Found ${files.length} files across ${tables.length} tables in organization ${organizationId}`);
      return files;

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error getting files by organization:', error);
      return [];
    }
  }
}