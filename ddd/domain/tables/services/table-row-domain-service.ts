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
import type { Row } from '@/ddd/domain/tables/value-objects/row';

export interface RowFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface AddRowCommand {
  table: DynamicTable;
  data: Row;
  createdBy?: UserId;
}

export interface UpdateRowCommand {
  table: DynamicTable;
  rowId: string;
  data: Row;
  updatedBy?: UserId;
}

export interface BulkAddRowsCommand {
  table: DynamicTable;
  rows: Array<Row>;
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

      // 1. Row entity should already be validated during construction
      // If we need validation, we should validate the Row entity directly
      
      // 2. Insert row entity directly
      const row = await this.tableRepository.insertRow(table.id, data);

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
    const row = await this.tableRepository.getRow(table.id, rowId);
    return row; // Repository returns Row entity directly
  }

  /**
   * Get rows from a table with optional filters
   */
  async getRows(table: DynamicTable, filters?: RowFilters): Promise<Row[]> {
    try {
      // Convert filters to repository format
      const options = this.convertFiltersToQueryOptions(filters);
      
      // Get rows from repository (returns Row entities directly)
      return await this.tableRepository.findRows(table.id, options);

    } catch (error) {
      console.error('[TableRowDomainService] Error getting rows:', error);
      return []; // Return empty array on error
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
          error: 'Row not found'
        };
      }

      // 2. Row entity should already be validated during construction
      // If we need validation, we should validate the Row entity directly

      // 3. Update row entity directly
      const updatedRow = await this.tableRepository.updateRow(table.id, rowId, data);

      return {
        success: true,
        data: updatedRow
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
          error: 'Row not found'
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
  async bulkAddRows(command: BulkAddRowsCommand): Promise<Result<Row[]>> {
    try {
      const { table, rows } = command;

      // 1. Row entities should already be validated during construction
      
      // 2. Create all rows using repository methods
      const createdRows = [];
      for (const row of rows) {
        const newRow = await this.tableRepository.insertRow(table.id, row);
        createdRows.push(newRow);
      }

      return {
        success: true,
        data: createdRows
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