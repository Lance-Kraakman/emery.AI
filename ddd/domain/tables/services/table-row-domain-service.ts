/**
 * Table Row Domain Service
 * 
 * Pure domain service that coordinates row operations between DynamicTable entity
 * and repositories. Handles all row-related business logic while keeping the
 * DynamicTable entity pure and free from infrastructure dependencies.
 * 
 * AIDEV-NOTE: Domain service implementing "Table owns Rows" pattern correctly.
 * Entity stays pure, domain service coordinates with infrastructure.
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { Result } from '@/ddd/domain/shared/result';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { Row, RowCollection } from '@/ddd/domain/tables/value-objects/row';
import { TableId, UserId } from '@/ddd/domain/shared/value-objects';
import { FieldProcessor } from '@/ddd/domain/fields/services/field-processor';
import { FieldMapper } from '@/ddd/infrastructure/fields/field-mapper';

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
  private readonly fieldProcessor = new FieldProcessor();
  private readonly fieldMapper = new FieldMapper();

  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly fieldRepository: IFieldRepository
  ) {}

  /**
   * Add a new row to a table
   */
  async addRow(command: AddRowCommand): Promise<Result<Row>> {
    try {
      const { table, data } = command;

      // 1. Get field definitions and validate row data
      const fields = await this.fieldRepository.findByTableId(table.id);
      const validation = this.fieldProcessor.validateRowData(fields, data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 2. Process data for storage
      const processedData = this.fieldProcessor.processRowForStorage(fields, data);
      const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);

      // 3. Create row through repository
      const rowData = await this.tableRepository.insertRow(table.id, columnData);

      // 4. Convert back to domain Row object
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const processedRowData = this.fieldProcessor.processRowFromStorage(fields, rowData);
      const row = Row.fromPlainObject(processedRowData, table.id.value, fieldSlugs, fieldTypes);

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

    // Process row data from storage format
    const fields = await this.fieldRepository.findByTableId(table.id);
    const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
    const fieldSlugs = fields.map((f: any) => f.slug);
    const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

    return Row.fromPlainObject(processedData, table.id.value, fieldSlugs, fieldTypes);
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

      // Process rows from storage format to domain objects
      const fields = await this.fieldRepository.findByTableId(table.id);
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

      const processedRowsData = [];
      for (const rowData of rowsData) {
        const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
        processedRowsData.push(processedData);
      }

      return RowCollection.fromPlainObjects(processedRowsData, table.id.value, fieldSlugs, fieldTypes);

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

      // 2. Validate update data
      const fields = await this.fieldRepository.findByTableId(table.id);
      const validation = this.fieldProcessor.validateRowData(fields, data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process data for storage
      const processedData = this.fieldProcessor.processRowForStorage(fields, data);
      const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);

      // 4. Update row through repository
      const updatedRowData = await this.tableRepository.updateRow(table.id, rowId, columnData);

      // 5. Convert back to domain Row object
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const processedRowData = this.fieldProcessor.processRowFromStorage(fields, updatedRowData);
      const row = Row.fromPlainObject(processedRowData, table.id.value, fieldSlugs, fieldTypes);

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

      // 1. Get field definitions and validate all rows
      const fields = await this.fieldRepository.findByTableId(table.id);
      const validationErrors: Array<{ row: number; errors: Array<{ field: string; error: string }> }> = [];
      
      for (let i = 0; i < rows.length; i++) {
        const validation = this.fieldProcessor.validateRowData(fields, rows[i]);
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

      // 2. Create all rows
      const createdRowsData = [];
      for (const rowData of rows) {
        const processedData = this.fieldProcessor.processRowForStorage(fields, rowData);
        const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);
        const newRowData = await this.tableRepository.insertRow(table.id, columnData);
        createdRowsData.push(newRowData);
      }

      // 3. Convert to domain objects
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      
      const processedRowsData = [];
      for (const rowData of createdRowsData) {
        const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
        processedRowsData.push(processedData);
      }

      const rowCollection = RowCollection.fromPlainObjects(processedRowsData, table.id.value, fieldSlugs, fieldTypes);

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