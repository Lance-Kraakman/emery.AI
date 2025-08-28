/**
 * Dynamic Table Domain Service
 * 
 * Central domain service for all table and row operations. This service orchestrates
 * business logic for dynamic table management, providing a single entry point for
 * all table-related operations throughout the application.
 * 
 * AIDEV-NOTE: Domain service that centralizes all table/row business logic.
 * All application services should use this instead of directly accessing repositories.
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { Result } from '@/ddd/domain/shared/result';
import type { 
  DynamicTable, 
  CreateDynamicTableData,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/ddd/domain/tables/entities/dynamic-table';
import { Row, RowCollection } from '@/ddd/domain/tables/value-objects/row';
import { TableId, OrganizationId, DatabaseId, UserId } from '@/ddd/domain/shared/value-objects';
import { FieldProcessor } from '@/ddd/domain/fields/services/field-processor';
import { FieldMapper } from '@/ddd/infrastructure/fields/field-mapper';

export interface RowFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
  where?: RowFilterCondition[];
}

export interface RowFilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'isNull' | 'isNotNull';
  value?: any;
  values?: any[];
}

export interface CreateTableCommand {
  name: string;
  databaseId: DatabaseId;
  organizationId: OrganizationId;
  createdBy: UserId;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTableCommand {
  id: TableId;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreateRowCommand {
  tableId: TableId;
  data: Record<string, any>;
  createdBy?: UserId;
}

export interface UpdateRowCommand {
  tableId: TableId;
  rowId: string;
  data: Record<string, any>;
  updatedBy?: UserId;
}

export interface BulkCreateRowsCommand {
  tableId: TableId;
  rows: Array<Record<string, any>>;
  createdBy?: UserId;
}

export interface BulkUpdateRowsCommand {
  tableId: TableId;
  updates: Array<{
    rowId: string;
    data: Record<string, any>;
  }>;
  updatedBy?: UserId;
}

/**
 * Central domain service for all dynamic table operations
 */
export class DynamicTableService {
  private readonly fieldProcessor = new FieldProcessor();
  private readonly fieldMapper = new FieldMapper();

  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly fieldRepository: IFieldRepository
  ) {}

  // ===== TABLE OPERATIONS =====

  /**
   * Create a new dynamic table
   */
  async createTable(command: CreateTableCommand): Promise<Result<DynamicTable>> {
    try {
      const tableData: CreateDynamicTableData = {
        name: command.name,
        databaseId: command.databaseId,
        organizationId: command.organizationId,
        createdBy: command.createdBy,
        description: command.description,
        metadata: command.metadata
      };

      const table = await this.tableRepository.create(tableData);

      return {
        success: true,
        data: table
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create table'
      };
    }
  }

  /**
   * Get a table by ID
   */
  async getTable(id: TableId): Promise<DynamicTable | null> {
    return await this.tableRepository.findById(id);
  }

  /**
   * Get tables by organization
   */
  async getTablesByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
    return await this.tableRepository.findByOrganization(organizationId);
  }

  /**
   * Get tables by database
   */
  async getTablesByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]> {
    return await this.tableRepository.findByDatabase(databaseId);
  }

  /**
   * Update a table
   */
  async updateTable(command: UpdateTableCommand): Promise<Result<DynamicTable>> {
    try {
      const table = await this.tableRepository.update(command.id, {
        name: command.name,
        description: command.description,
        metadata: command.metadata
      });

      return {
        success: true,
        data: table
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update table'
      };
    }
  }

  /**
   * Delete a table
   */
  async deleteTable(id: TableId): Promise<Result<void>> {
    try {
      await this.tableRepository.delete(id);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table'
      };
    }
  }

  /**
   * Check if table exists
   */
  async tableExists(id: TableId): Promise<boolean> {
    return await this.tableRepository.tableExists(id);
  }

  /**
   * Get table statistics
   */
  async getTableStats(id: TableId): Promise<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }> {
    return await this.tableRepository.getTableStats(id);
  }

  // ===== ROW OPERATIONS =====

  /**
   * Create a new row in a table
   */
  async createRow(command: CreateRowCommand): Promise<Result<Row>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId.value} not found`
        };
      }

      // 2. Get field definitions and validate row data
      const fields = await this.fieldRepository.findByTableId(command.tableId);
      const validation = this.fieldProcessor.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process data for storage
      const processedData = this.fieldProcessor.processRowForStorage(fields, command.data);
      const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);

      // 4. Create row through repository
      const rowData = await this.tableRepository.insertRow(command.tableId, columnData);

      // 5. Convert back to domain Row object
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const processedRowData = this.fieldProcessor.processRowFromStorage(fields, rowData);
      const row = Row.fromPlainObject(processedRowData, command.tableId.value, fieldSlugs, fieldTypes);

      return {
        success: true,
        data: row
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create row'
      };
    }
  }

  /**
   * Get a single row by ID
   */
  async getRow(tableId: TableId, rowId: string): Promise<Row | null> {
    const rowData = await this.tableRepository.getRow(tableId, rowId);
    if (!rowData) {
      return null;
    }

    // Process row data from storage format
    const fields = await this.fieldRepository.findByTableId(tableId);
    const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
    const fieldSlugs = fields.map((f: any) => f.slug);
    const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

    return Row.fromPlainObject(processedData, tableId.value, fieldSlugs, fieldTypes);
  }

  /**
   * Get rows from a table with filters
   */
  async getRows(tableId: TableId, filters?: RowFilters): Promise<RowCollection> {
    try {
      // Convert filters to repository format
      const options = this.convertFiltersToQueryOptions(filters);
      
      // Get rows from repository
      const rowsData = await this.tableRepository.findRows(tableId, options);

      // Process rows from storage format to domain objects
      const fields = await this.fieldRepository.findByTableId(tableId);
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});

      const processedRowsData = [];
      for (const rowData of rowsData) {
        const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
        processedRowsData.push(processedData);
      }

      return RowCollection.fromPlainObjects(processedRowsData, tableId.value, fieldSlugs, fieldTypes);

    } catch (error) {
      console.error('[DynamicTableService] Error getting rows:', error);
      // Return empty collection on error
      return RowCollection.fromPlainObjects([], tableId.value, [], {});
    }
  }

  /**
   * Update a row
   */
  async updateRow(command: UpdateRowCommand): Promise<Result<Row>> {
    try {
      // 1. Verify table and row exist
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId.value} not found`
        };
      }

      const existingRow = await this.tableRepository.getRow(command.tableId, command.rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${command.rowId} not found`
        };
      }

      // 2. Validate update data
      const fields = await this.fieldRepository.findByTableId(command.tableId);
      const validation = this.fieldProcessor.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process data for storage
      const processedData = this.fieldProcessor.processRowForStorage(fields, command.data);
      const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);

      // 4. Update row through repository
      const updatedRowData = await this.tableRepository.updateRow(command.tableId, command.rowId, columnData);

      // 5. Convert back to domain Row object
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      const processedRowData = this.fieldProcessor.processRowFromStorage(fields, updatedRowData);
      const row = Row.fromPlainObject(processedRowData, command.tableId.value, fieldSlugs, fieldTypes);

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
   * Delete a row
   */
  async deleteRow(tableId: TableId, rowId: string): Promise<Result<void>> {
    try {
      // 1. Verify table and row exist
      const table = await this.tableRepository.findById(tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${tableId.value} not found`
        };
      }

      const existingRow = await this.tableRepository.getRow(tableId, rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${rowId} not found`
        };
      }

      // 2. Delete row through repository
      await this.tableRepository.deleteRow(tableId, rowId);

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
   * Bulk create multiple rows
   */
  async bulkCreateRows(command: BulkCreateRowsCommand): Promise<Result<RowCollection>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId.value} not found`
        };
      }

      // 2. Get field definitions and validate all rows
      const fields = await this.fieldRepository.findByTableId(command.tableId);
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

      // 3. Create all rows
      const createdRowsData = [];
      for (const rowData of command.rows) {
        const processedData = this.fieldProcessor.processRowForStorage(fields, rowData);
        const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);
        const newRowData = await this.tableRepository.insertRow(command.tableId, columnData);
        createdRowsData.push(newRowData);
      }

      // 4. Convert to domain objects
      const fieldSlugs = fields.map((f: any) => f.slug);
      const fieldTypes = fields.reduce((acc: any, f: any) => ({ ...acc, [f.slug]: f.type }), {});
      
      const processedRowsData = [];
      for (const rowData of createdRowsData) {
        const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
        processedRowsData.push(processedData);
      }

      const rowCollection = RowCollection.fromPlainObjects(processedRowsData, command.tableId.value, fieldSlugs, fieldTypes);

      return {
        success: true,
        data: rowCollection
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk create rows'
      };
    }
  }

  /**
   * Check if table has any rows
   */
  async hasRows(tableId: TableId): Promise<boolean> {
    return await this.tableRepository.hasRows(tableId);
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Convert domain filters to repository query options
   */
  private convertFiltersToQueryOptions(filters?: RowFilters): RowQueryOptions | undefined {
    if (!filters) {
      return undefined;
    }

    return {
      limit: filters.limit,
      offset: filters.offset,
      orderBy: filters.orderBy,
      orderDirection: filters.orderDirection,
      filters: filters.filters
      // Note: Advanced 'where' conditions would need additional mapping
    };
  }
}