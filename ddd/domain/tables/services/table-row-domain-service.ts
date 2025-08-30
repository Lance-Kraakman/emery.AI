/**
 * Table Row Domain Service
 * 
 * Pure domain service that coordinates row operations between DynamicTable entity
 * and repositories. Uses table's consolidated field methods for validation and
 * processing, eliminating need for separate field repositories and processors.
 * 
 * AIDEV-NOTE: Updated to use table's domain methods (validateRowData, processRowForStorage)
 * instead of separate FieldRepository/FieldProcessor. Clean consolidation complete.
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { Result } from '@/ddd/domain/shared/result';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { Row, RowCollection } from '@/ddd/domain/tables/value-objects/row';
import { TableId, UserId } from '@/ddd/domain/shared/value-objects';

export interface RowFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface AddRowCommand {
  table: DynamicTable;
  data: Record<string, any>;
  createdBy?: UserId;
}

export interface UpdateRowCommand {
  table: DynamicTable;
  rowId: string;
  data: Record<string, any>;
  updatedBy?: UserId;
}

export interface BulkAddRowsCommand {
  table: DynamicTable;
  rows: Array<Record<string, any>>;
  createdBy?: UserId;
}

/**
 * Domain service for table row operations
 */
export class TableRowDomainService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository
  ) {}

  /**
   * Add a new row to a table
   */
  async addRow(command: AddRowCommand): Promise<Result<Row>> {
    try {
      const { table, data } = command;

      // 1. Validate row data using table's domain methods
      const validation = table.validateRowData(data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 2. Process data for storage using table's domain methods
      const columnData = table.processRowForStorage(data);

      // 3. Create row through repository
      const rowData = await this.tableRepository.insertRow(table.id, columnData);

      // 4. Convert back to domain Row object using field names
      const fieldNames = table.fields.map(f => f.name);
      const fieldTypes = table.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.type }), {});
      const processedRowData = table.processRowFromStorage(rowData);
      const row = Row.fromPlainObject(processedRowData, table.id.value, fieldNames, fieldTypes);

      return {
        success: true,
        data: row
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add row'
      };
    }
  }

  /**
   * Get a single row from a table
   */
  async getRow(table: DynamicTable, rowId: string): Promise<Row | null> {
    const rowData = await this.tableRepository.getRow(table.id, rowId);
    if (!rowData) {
      return null;
    }

    // Process row data from storage format using table's domain methods
    const processedData = table.processRowFromStorage(rowData);
    const fieldNames = table.fields.map(f => f.name);
    const fieldTypes = table.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.type }), {});

    return Row.fromPlainObject(processedData, table.id.value, fieldNames, fieldTypes);
  }

  /**
   * Get rows from a table with optional filters
   */
  async getRows(table: DynamicTable, filters?: RowFilters): Promise<RowCollection> {
    try {
      // Convert filters to repository format
      const options = this.convertFiltersToQueryOptions(filters);
      
      // Get rows from repository
      const rowsData = await this.tableRepository.findRows(table.id, options);

      // Process rows from storage format to domain objects using table's methods
      const fieldNames = table.fields.map(f => f.name);
      const fieldTypes = table.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.type }), {});

      const processedRowsData = [];
      for (const rowData of rowsData) {
        const processedData = table.processRowFromStorage(rowData);
        processedRowsData.push(processedData);
      }

      return RowCollection.fromPlainObjects(processedRowsData, table.id.value, fieldNames, fieldTypes);

    } catch (error) {
      console.error('[TableRowDomainService] Error getting rows:', error);
      // Return empty collection on error
      return RowCollection.fromPlainObjects([], table.id.value, [], {});
    }
  }

  /**
   * Update a row in a table
   */
  async updateRow(command: UpdateRowCommand): Promise<Result<Row>> {
    try {
      const { table, rowId, data } = command;

      // 1. Verify row exists
      const existingRow = await this.tableRepository.getRow(table.id, rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${rowId} not found`
        };
      }

      // 2. Validate update data using table's domain methods
      const validation = table.validateRowData(data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process data for storage using table's domain methods
      const columnData = table.processRowForStorage(data);

      // 4. Update row through repository
      const updatedRowData = await this.tableRepository.updateRow(table.id, rowId, columnData);

      // 5. Convert back to domain Row object using field names
      const fieldNames = table.fields.map(f => f.name);
      const fieldTypes = table.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.type }), {});
      const processedRowData = table.processRowFromStorage(updatedRowData);
      const row = Row.fromPlainObject(processedRowData, table.id.value, fieldNames, fieldTypes);

      return {
        success: true,
        data: row
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update row'
      };
    }
  }

  /**
   * Delete a row from a table
   */
  async deleteRow(table: DynamicTable, rowId: string): Promise<Result<void>> {
    try {
      // 1. Verify row exists
      const existingRow = await this.tableRepository.getRow(table.id, rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${rowId} not found`
        };
      }

      // 2. Delete row through repository
      await this.tableRepository.deleteRow(table.id, rowId);

      return {
        success: true
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete row'
      };
    }
  }

  /**
   * Bulk add multiple rows to a table
   */
  async bulkAddRows(command: BulkAddRowsCommand): Promise<Result<RowCollection>> {
    try {
      const { table, rows } = command;

      // 1. Validate all rows using table's domain methods
      const validationErrors: Array<{ row: number; errors: Array<{ field: string; error: string }> }> = [];
      
      for (let i = 0; i < rows.length; i++) {
        const validation = table.validateRowData(rows[i]);
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

      // 2. Create all rows using table's domain methods
      const createdRowsData = [];
      for (const rowData of rows) {
        const columnData = table.processRowForStorage(rowData);
        const newRowData = await this.tableRepository.insertRow(table.id, columnData);
        createdRowsData.push(newRowData);
      }

      // 3. Convert to domain objects using field names
      const fieldNames = table.fields.map(f => f.name);
      const fieldTypes = table.fields.reduce((acc, f) => ({ ...acc, [f.name]: f.type }), {});
      
      const processedRowsData = [];
      for (const rowData of createdRowsData) {
        const processedData = table.processRowFromStorage(rowData);
        processedRowsData.push(processedData);
      }

      const rowCollection = RowCollection.fromPlainObjects(processedRowsData, table.id.value, fieldNames, fieldTypes);

      return {
        success: true,
        data: rowCollection
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk add rows'
      };
    }
  }

  /**
   * Check if table has any rows
   */
  async hasRows(table: DynamicTable): Promise<boolean> {
    return await this.tableRepository.hasRows(table.id);
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Convert domain filters to repository query options
   */
  private convertFiltersToQueryOptions(filters?: RowFilters): any {
    if (!filters) {
      return undefined;
    }

    return {
      limit: filters.limit,
      offset: filters.offset,
      orderBy: filters.orderBy,
      orderDirection: filters.orderDirection,
      filters: filters.filters
    };
  }
}