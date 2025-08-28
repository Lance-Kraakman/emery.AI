import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';
import type { Result } from '@/ddd/domain/shared/result';
import type { QueryFilter } from '@/ddd/infrastructure/data/duckdb-sql-builder';
import { Row, RowCollection } from '@/ddd/domain/tables/value-objects/row';
import { TableId } from '@/ddd/domain/shared/value-objects';
import { FieldProcessor } from '@/ddd/domain/fields/services/field-processor';
import { FieldMapper } from '@/ddd/infrastructure/fields/field-mapper';

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
  private readonly fieldProcessor = new FieldProcessor();
  private readonly fieldMapper = new FieldMapper();

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

      // 2. Get field definitions and validate row data using domain service
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const validation = this.fieldProcessor.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Repository handles all processing (field conversion, storage, etc.)
      const newRowData = await this.tableRepository.insertRow(TableId.fromNumber(command.tableId), command.data);

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

      // 3. Get field definitions and validate update data using domain service
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const validation = this.fieldProcessor.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 4. Repository handles all processing (field conversion, storage, etc.)
      const updatedRowData = await this.tableRepository.updateRow(TableId.fromNumber(command.tableId), command.rowId, command.data);

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

    // Get field information and process row data using domain service
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    const mappedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
    const fieldSlugs = fields.map((f: any) => f.slug);
    const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

    return Row.fromPlainObject(mappedData, tableId, fieldSlugs, fieldTypes);
  }

  /**
   * Get rows from a table with filters using DuckDB for efficient SQL-based querying
   */
  async getRows(tableId: TableId, filters?: RowFilters): Promise<RowCollection> {
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
      return RowCollection.fromPlainObjects([], tableId.value, [], {});
    }

    const rowsData = queryResult.data?.rows || [];

    // Get field information to create proper Row value objects
    const fields = await this.fieldRepository.findByTableId(tableId);
    const fieldSlugs = fields.map((f: any) => f.slug);
    const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

    // Process rows using domain service and create Row objects
    const mappedRowsData = [];
    for (const rowData of rowsData) {
      mappedRowsData.push(this.fieldProcessor.processRowFromStorage(fields, rowData));
    }

    return RowCollection.fromPlainObjects(mappedRowsData, tableId.value, fieldSlugs, fieldTypes);
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

      // 2. Get field definitions and validate all rows using domain service
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const validationErrors: Array<{ row: number; errors: Array<{ field: string; error: string }> }> = [];
      
      for (let i = 0; i < command.rows.length; i++) {
        const validation = this.fieldProcessor.validateRowData(fields, command.rows[i]);
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

      // 3. Insert all rows (repository handles processing)
      const createdRowsData = [];
      for (const rowData of command.rows) {
        const newRowData = await this.tableRepository.insertRow(TableId.fromNumber(command.tableId), rowData);
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
          // Validate update data using domain service
          const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
          const validation = this.fieldProcessor.validateRowData(fields, update.data);
          if (!validation.valid) {
            errors.push({
              rowId: update.rowId,
              error: validation.errors.map((e: { field: string; error: string }) => `${e.field}: ${e.error}`).join(', ')
            });
            continue;
          }

          // Update row (repository handles processing)
          const updatedRow = await this.tableRepository.updateRow(TableId.fromNumber(command.tableId), update.rowId, update.data);
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
   * Convert RowFilters to DuckDB QueryFilter format using FieldMapper
   */
  private async convertRowFiltersToQueryFilters(filters?: RowFilters, tableId?: TableId): Promise<QueryFilter[]> {
    const queryFilters: QueryFilter[] = [];
    
    if (!filters) {
      return queryFilters;
    }

    // Get fields for mapping
    const fields = tableId ? await this.fieldRepository.findByTableId(tableId) : [];
    const slugToColumnMapping = this.fieldMapper.createSlugToColumnMapping(fields);

    // Handle enhanced where conditions (new format)
    if (filters.where && filters.where.length > 0) {
      for (const condition of filters.where) {
        // Map field slug to field_{id} column name for DuckDB query
        const fieldColumn = slugToColumnMapping[condition.field] || condition.field;
        
        queryFilters.push({
          field: fieldColumn,
          operator: condition.operator,
          value: condition.value,
          values: condition.values
        });
      }
    }

    // Handle legacy filters (backward compatibility)
    if (filters.filters && Object.keys(filters.filters).length > 0) {
      for (const [fieldSlug, value] of Object.entries(filters.filters)) {
        if (value !== null && value !== undefined) {
          const fieldColumn = slugToColumnMapping[fieldSlug] || fieldSlug;
          
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
}