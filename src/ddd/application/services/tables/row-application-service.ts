/**
 * Row Application Service
 *
 * Handles all row-level operations: CRUD, search, validation.
 * Delegates trigger handling to TableEventCoordinatorService.
 *
 * AIDEV-NOTE: Extracted from TableApplicationService for Single Responsibility Principle.
 * This service focuses solely on row data operations, not table structure.
 */

import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { OrganizationId, TableId } from '@/ddd/domain/shared/value-objects';
import { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import { Row, RowId } from '@/ddd/domain/tables/value-objects/row';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import type { TableChangeEvent } from '@/ddd/domain/scheduling/types/scheduling-types';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import { AutoFieldProcessor } from './auto-field-processor';
import type { TableEventCoordinatorService } from './table-event-coordinator-service';

const logger = createDebugLogger('RowService');

// Row operation commands
export interface CreateRowCommand {
  tableId: TableId;
  data: Row;
  createdBy?: import('@/ddd/domain/shared/value-objects').UserId;
}

export interface CreateRowsCommand {
  tableId: TableId;
  rows: Row[];
  createdBy?: import('@/ddd/domain/shared/value-objects').UserId;
}

export interface UpdateRowCommand {
  tableId: TableId;
  rowId: RowId;
  data: Row;
  updatedBy?: import('@/ddd/domain/shared/value-objects').UserId;
}

export interface BulkCreateRowsCommand {
  tableId: TableId;
  rows: Row[];
  createdBy?: import('@/ddd/domain/shared/value-objects').UserId;
}

export interface BulkUpdateRowsCommand {
  tableId: TableId;
  updates: Array<{
    rowId: RowId;
    data: Row;
  }>;
  updatedBy?: import('@/ddd/domain/shared/value-objects').UserId;
}

export interface SearchTableRowsCommand {
  tableId: TableId;
  query: string;
  limit?: number;
  organizationId: OrganizationId;
}

export class RowApplicationService {
  private readonly autoFieldProcessor: AutoFieldProcessor;

  constructor(
    private readonly dynamicTableService: DynamicTableService,
    private readonly dynamicTableRepository: IDynamicTableRepository,
    private readonly eventCoordinator?: TableEventCoordinatorService
  ) {
    this.autoFieldProcessor = new AutoFieldProcessor();
  }

  /**
   * Validate relation fields in a row
   */
  private async validateRelationFields(
    table: any,
    data: any
  ): Promise<{ valid: boolean; error?: string }> {
    const relationFields = table.fields.filter((field: any) => field.type === 'relation');

    for (const field of relationFields) {
      if (!field.relatedTableId) {
        continue;
      }

      const fieldValue = data.getFieldValue(field.id.value.toString());
      if (!fieldValue || fieldValue.isNull()) {
        if (field.required) {
          return { valid: false, error: `${field.name} is required` };
        }
        continue;
      }

      const relations = fieldValue.value as any[];

      // Validate each relation ID exists
      for (const relation of relations) {
        const row = await this.dynamicTableRepository.getRow(
          field.relatedTableId!,
          relation.id.toString()
        );

        if (!row) {
          return {
            valid: false,
            error: `Related record ${relation.id} not found in table ${field.relatedTableId.value}`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Emit table trigger event (delegates to event coordinator)
   */
  private async emitTableTrigger(event: TableChangeEvent): Promise<void> {
    if (this.eventCoordinator) {
      await this.eventCoordinator.handleTableTriggers(event);
    }
  }

  /**
   * Create a new row in a table
   */
  async createRow(command: CreateRowCommand): Promise<Result<Row>> {
    try {
      const { tableId, data } = command;

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Process auto-fields BEFORE storing to data lake
      const plainData = data.toPlainObject(table.fields);
      const enrichedPlainData = this.autoFieldProcessor.processAutoFields(
        table,
        plainData,
        'create'
      );
      const enrichedRow = Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);

      // Validate relation fields
      const relationValidation = await this.validateRelationFields(table, enrichedRow);
      if (!relationValidation.valid) {
        return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
      }

      // Insert single row using batch method
      const rows = await this.dynamicTableRepository.insertRows(tableId, [enrichedRow]);
      const createdRow = rows[0];

      // Emit table trigger event (non-blocking)
      await this.emitTableTrigger({
        tableId: tableId.value,
        tableName: table.name,
        operation: 'INSERT',
        organizationId: table.organizationId,
        rowId: createdRow.id.value,
        rowData: createdRow.toPlainObject(table.fields),
        timestamp: new Date()
      });

      return ResultHelpers.success(createdRow);

    } catch (error) {
      logger.error('Error creating row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create row');
    }
  }

  /**
   * Create multiple rows in a table (batch operation)
   */
  async createRows(command: CreateRowsCommand): Promise<Result<Row[]>> {
    try {
      const { tableId, rows } = command;

      if (rows.length === 0) {
        return ResultHelpers.success([]);
      }

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Process auto-fields for all rows in batch
      const enrichedRows = rows.map(row => {
        const plainData = row.toPlainObject(table.fields);
        const enrichedPlainData = this.autoFieldProcessor.processAutoFields(table, plainData, 'create');
        return Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);
      });

      // Validate relation fields for all enriched rows
      for (const row of enrichedRows) {
        const relationValidation = await this.validateRelationFields(table, row);
        if (!relationValidation.valid) {
          return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
        }
      }

      // Batch insert all rows in single gRPC call
      const createdRows = await this.dynamicTableRepository.insertRows(tableId, enrichedRows);

      // Emit table trigger events for each created row (non-blocking)
      for (const createdRow of createdRows) {
        await this.emitTableTrigger({
          tableId: tableId.value,
          tableName: table.name,
          operation: 'INSERT',
          organizationId: table.organizationId,
          rowId: createdRow.id.value,
          rowData: createdRow.toPlainObject(table.fields),
          timestamp: new Date()
        });
      }

      return ResultHelpers.success(createdRows);

    } catch (error) {
      logger.error('Error creating rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create rows');
    }
  }

  /**
   * Update an existing row in a table
   */
  async updateRow(command: UpdateRowCommand): Promise<Result<Row>> {
    try {
      const { tableId, rowId, data } = command;

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Get previous row data for UPDATE trigger event and watchFields comparison
      const previousRow = await this.dynamicTableRepository.getRow(tableId, rowId.value);

      // Process auto-fields for updates (last-updated timestamps)
      const plainData = data.toPlainObject(table.fields);
      const enrichedPlainData = this.autoFieldProcessor.processAutoFields(
        table,
        plainData,
        'update',
        previousRow?.toPlainObject(table.fields)
      );
      const enrichedRow = Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);

      // Validate relation fields
      const relationValidation = await this.validateRelationFields(table, enrichedRow);
      if (!relationValidation.valid) {
        return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
      }

      // Update single row using batch method
      const updatedRows = await this.dynamicTableRepository.updateRows(tableId, [{
        rowId: rowId.value,
        row: enrichedRow
      }]);
      const updatedRow = updatedRows[0];

      // Emit table trigger event (non-blocking)
      await this.emitTableTrigger({
        tableId: tableId.value,
        tableName: table.name,
        operation: 'UPDATE',
        organizationId: table.organizationId,
        rowId: updatedRow.id.value,
        rowData: updatedRow.toPlainObject(table.fields),
        previousRowData: previousRow?.toPlainObject(table.fields),
        timestamp: new Date()
      });

      return ResultHelpers.success(updatedRow);

    } catch (error) {
      logger.error('Error updating row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update row');
    }
  }

  /**
   * Update multiple rows in a table (bulk update)
   * OPTIMIZED: Single transaction, single Delta Lake merge operation
   */
  async updateRows(command: BulkUpdateRowsCommand): Promise<Result<Row[]>> {
    try {
      const { tableId, updates } = command;

      if (updates.length === 0) {
        return ResultHelpers.success([]);
      }

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Process auto-fields for bulk updates
      const enrichedUpdates = updates.map(update => {
        const plainData = update.data.toPlainObject(table.fields);
        logger.debug('[updateRows] Row before auto-field processing', {
          rowId: update.rowId.value,
          plainDataKeys: Object.keys(plainData),
          sampleFieldId: Object.keys(plainData)[1],
          sampleValue: plainData[Object.keys(plainData)[1]]
        });
        const enrichedPlainData = this.autoFieldProcessor.processAutoFields(table, plainData, 'update');
        const enrichedRow = Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);
        return {
          rowId: update.rowId,
          data: enrichedRow
        };
      });

      // Validate relation fields for all enriched rows
      for (const update of enrichedUpdates) {
        const relationValidation = await this.validateRelationFields(table, update.data);
        if (!relationValidation.valid) {
          return ResultHelpers.failure(
            `Relation validation failed for row ${update.rowId.value}: ${relationValidation.error}`
          );
        }
      }

      // Fetch previous row data for all rows being updated (needed for UPDATE trigger events)
      const previousRows = await Promise.all(
        enrichedUpdates.map(update =>
          this.dynamicTableRepository.getRow(tableId, update.rowId.value)
        )
      );
      const previousRowsMap = new Map(
        previousRows.filter(row => row !== null).map(row => [row!.id.value, row])
      );

      // Bulk update using repository (single Delta Lake merge)
      const updatedRows = await this.dynamicTableRepository.updateRows(
        tableId,
        enrichedUpdates.map(u => ({
          rowId: u.rowId.value,
          row: u.data
        }))
      );

      // Emit table trigger events for each updated row (non-blocking)
      for (const updatedRow of updatedRows) {
        const previousRow = previousRowsMap.get(updatedRow.id.value);
        await this.emitTableTrigger({
          tableId: tableId.value,
          tableName: table.name,
          operation: 'UPDATE',
          organizationId: table.organizationId,
          rowId: updatedRow.id.value,
          rowData: updatedRow.toPlainObject(table.fields),
          previousRowData: previousRow?.toPlainObject(table.fields),
          timestamp: new Date()
        });
      }

      logger.summary('Bulk update completed', {
        rows: updatedRows.length,
        tableId: tableId.value
      });
      return ResultHelpers.success(updatedRows);

    } catch (error) {
      logger.error('Error bulk updating rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to bulk update rows');
    }
  }

  /**
   * Delete a row from a table
   */
  async deleteRow(tableId: TableId, rowId: RowId): Promise<Result<void>> {
    try {
      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Get row data before deletion for DELETE trigger event
      const rowToDelete = await this.dynamicTableRepository.getRow(tableId, rowId.value);

      // Delete row using repository (pass as single-element array)
      await this.dynamicTableRepository.deleteRows(tableId, [rowId.value]);

      // Emit table trigger event (non-blocking)
      if (rowToDelete) {
        await this.emitTableTrigger({
          tableId: tableId.value,
          tableName: table.name,
          operation: 'DELETE',
          organizationId: table.organizationId,
          rowId: rowId.value,
          rowData: rowToDelete.toPlainObject(table.fields),
          timestamp: new Date()
        });
      }

      return ResultHelpers.success(undefined);

    } catch (error) {
      logger.error('Error deleting row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to delete row');
    }
  }

  /**
   * Get a single row from a table
   */
  async getRow(tableId: TableId, rowId: RowId): Promise<Row | null> {
    try {
      return await this.dynamicTableRepository.getRow(tableId, rowId.value);
    } catch (error) {
      logger.error('Error getting row:', error);
      return null;
    }
  }

  /**
   * Get rows from a table with pagination
   */
  async getRows(tableId: TableId, options: RowQueryOptions): Promise<Row[]> {
    try {
      return await this.dynamicTableRepository.getRows(tableId, options);
    } catch (error) {
      logger.error('Error getting rows:', error);
      return [];
    }
  }

  /**
   * Get rows using pre-fetched table data (bypasses findById)
   * Used for public view access where table metadata is already fetched via rawDb
   */
  async getRowsWithTableData(
    tableData: { tableId: number; s3Path: string; organizationId: number; databaseId: number },
    fields: TableField[],
    options: RowQueryOptions
  ): Promise<Row[]> {
    try {
      return await this.dynamicTableRepository.getRowsWithParams(
        {
          tableId: tableData.tableId,
          s3Path: tableData.s3Path,
          organizationId: tableData.organizationId,
        },
        fields,
        options
      );
    } catch (error) {
      logger.error('Error getting rows with table data:', error);
      return [];
    }
  }

  /**
   * Bulk create multiple rows in a table
   */
  async bulkCreateRows(command: BulkCreateRowsCommand): Promise<Result<Row[]>> {
    try {
      const { tableId, rows } = command;

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Process auto-fields for all rows in bulk create
      const enrichedRows = rows.map(row => {
        const plainData = row.toPlainObject(table.fields);
        const enrichedPlainData = this.autoFieldProcessor.processAutoFields(table, plainData, 'create');
        return Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);
      });

      // Batch insert all rows in single call
      const createdRows = await this.dynamicTableRepository.insertRows(tableId, enrichedRows);

      return ResultHelpers.success(createdRows);

    } catch (error) {
      logger.error('Error bulk creating rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to bulk create rows');
    }
  }

  /**
   * Check if a table has any rows
   */
  async tableHasRows(tableId: TableId): Promise<boolean> {
    try {
      return await this.dynamicTableRepository.hasRows(tableId);
    } catch (error) {
      logger.error('Error checking if table has rows:', error);
      return false;
    }
  }

  /**
   * Search for rows in a table based on a query string
   */
  async searchTableRows(command: SearchTableRowsCommand): Promise<Result<Row[]>> {
    try {
      const { tableId, query, limit = 20, organizationId } = command;

      // Verify table exists and user has access
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Verify organization access
      if (!table.organizationId.equals(organizationId)) {
        return ResultHelpers.failure('Access denied: Table belongs to different organization');
      }

      // Build text search filters using existing RowQueryOptions
      const textFields = table.fields
        .filter(field => field.type === 'text')
        .map(field => field.name);

      // Create filters for text search across all text fields
      const searchFilters = textFields.map(fieldName => ({
        field: fieldName,
        operator: 'ilike' as const,
        value: `%${query}%`
      }));

      // Use existing getRows method with search filters
      const rows = await this.dynamicTableRepository.getRows(tableId, {
        limit,
        offset: 0,
        filters: searchFilters
      });

      return ResultHelpers.success(rows);

    } catch (error) {
      logger.error('Error searching table rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to search table rows');
    }
  }
}
