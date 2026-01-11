// AIDEV-NOTE: Simplified Dynamic Table repository interface - just essential CRUD operations
// Focuses on the methods actually used in the application

import type {
  DynamicTable,
} from '../entities/dynamic-table';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import type { Row } from '../value-objects/row';
import type { TableField } from '../value-objects/table-field';
import { TableId, DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';

// AIDEV-NOTE: CreateDynamicTableData moved to application service
import type { CreateDynamicTableData } from '@/ddd/application/services/tables/table-application-service';

export interface IDynamicTableRepository {
  // Table CRUD - just the basics
  findById(id: TableId): Promise<DynamicTable | null>;
  findByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]>;
  findByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]>;
  create(data: CreateDynamicTableData): Promise<DynamicTable>;
  update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable>;
  delete(id: TableId): Promise<void>;
  existsByStorageLocation(organizationId: OrganizationId, storageLocation: string): Promise<boolean>;
  
  // Row CRUD - works with Row entities directly (batch operations)
  insertRows(tableId: TableId, rows: Row[]): Promise<Row[]>;
  getRows(tableId: TableId, options: RowQueryOptions): Promise<Row[]>;
  getRow(tableId: TableId, rowId: string): Promise<Row | null>;
  updateRows(tableId: TableId, updates: Array<{rowId: string, row: Row}>): Promise<Row[]>;
  deleteRows(tableId: TableId, rowIds: string[]): Promise<void>;

  /**
   * Get rows using raw table parameters
   * Bypasses findById - used when table metadata is already available (e.g., public views)
   */
  getRowsWithParams(
    params: { tableId: number; s3Path: string; organizationId: number },
    fields: readonly TableField[],
    options: RowQueryOptions
  ): Promise<Row[]>;
  
  // Generic table operations for any storage backend
  tableExists(tableId: TableId): Promise<boolean>;
  getTableStats(tableId: TableId): Promise<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }>;
  
  // Table analysis methods needed by application services
  hasRows(tableId: TableId): Promise<boolean>;
  findAll(): Promise<DynamicTable[]>;
  
  // Field operations
  updateFieldOrders(tableId: TableId, fieldOrders: Array<{ fieldName: string; orderIndex: number }>): Promise<void>;
}

