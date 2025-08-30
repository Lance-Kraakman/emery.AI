/**
 * Table Row Domain Service
 * 
 * Pure domain service that coordinates row operations between DynamicTable entity
 * and field repository. Gets fields separately and handles validation/processing
 * through dedicated field services.
 * 
 * AIDEV-NOTE: Uses separate field repository pattern - table entity stays pure
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { Result } from '@/ddd/domain/shared/result';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableId, UserId } from '@/ddd/domain/shared/value-objects';
import type { RowData } from '@/ddd/domain/tables/value-objects/field-values';

export interface RowFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface AddRowCommand {
  table: DynamicTable;
  data: RowData;
  createdBy?: UserId;
}

export interface UpdateRowCommand {
  table: DynamicTable;
  rowId: string;
  data: Partial<RowData>;
  updatedBy?: UserId;
}

export interface BulkAddRowsCommand {
  table: DynamicTable;
  rows: Array<RowData>;
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
  async addRow(command: AddRowCommand): Promise<Result<RowData>> {
    try {
      const { table, data } = command;

      // 1. Validate row data using table's domain methods
      const validation = table.validateRowData(data);
      if (!validation.valid) {
        // Build detailed error message from validation errors
        const errorMessages = validation.errors.map(e => e.error).join(', ');
        return {
          success: false,
          error: errorMessages || 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 2. Process data for storage using table's domain methods
      const columnData = table.processRowForStorage(data);

      // 3. Create row through repository
      const rowData = await this.tableRepository.insertRow(table.id, columnData);

      // 4. Repository returns RowData directly
      return {
        success: true,
        data: rowData
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
  async getRow(table: DynamicTable, rowId: string): Promise<RowData | null> {
    const rowData = await this.tableRepository.getRow(table.id, rowId);
    return rowData; // Repository returns RowData directly
  }

  /**
   * Get rows from a table with optional filters
   */
  async getRows(table: DynamicTable, filters?: RowFilters): Promise<RowData[]> {
    try {
      // Convert filters to repository format
      const options = this.convertFiltersToQueryOptions(filters);
      
      // Get rows from repository (returns RowData directly)
      return await this.tableRepository.findRows(table.id, options);

    } catch (error) {
      console.error('[TableRowDomainService] Error getting rows:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Update a row in a table
   */
  async updateRow(command: UpdateRowCommand): Promise<Result<RowData>> {
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
        // Build detailed error message from validation errors
        const errorMessages = validation.errors.map(e => e.error).join(', ');
        return {
          success: false,
          error: errorMessages || 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process data for storage using table's domain methods
      const columnData = table.processRowForStorage(data);

      // 4. Update row through repository
      const updatedRowData = await this.tableRepository.updateRow(table.id, rowId, columnData);

      // 5. Repository returns RowData directly
      return {
        success: true,
        data: updatedRowData
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
  async bulkAddRows(command: BulkAddRowsCommand): Promise<Result<RowData[]>> {
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

      // 3. Repository returns RowData directly
      return {
        success: true,
        data: createdRowsData
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