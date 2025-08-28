// AIDEV-NOTE: Simplified Dynamic Table repository interface - just essential CRUD operations
// Focuses on the methods actually used in the application

import type { 
  DynamicTable, 
  CreateDynamicTableData,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '../entities/dynamic-table';
import { Row } from '../value-objects/row';
import { TableId, DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export type { CreateDynamicTableData } from '../entities/dynamic-table';

export interface IDynamicTableRepository {
  // Table CRUD - just the basics
  findById(id: TableId): Promise<DynamicTable | null>;
  findByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]>;
  findByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]>;
  create(data: CreateDynamicTableData): Promise<DynamicTable>;
  update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable>;
  delete(id: TableId): Promise<void>;
  existsByStorageLocation(organizationId: OrganizationId, storageLocation: string): Promise<boolean>;
  
  // Row CRUD - used by domain services
  insertRow(tableId: TableId, data: CreateRowData): Promise<Row>;
  findRows(tableId: TableId, options?: RowQueryOptions): Promise<Row[]>;
  getRow(tableId: TableId, rowId: string): Promise<Row | null>;
  updateRow(tableId: TableId, rowId: string, data: UpdateRowData): Promise<Row>;
  deleteRow(tableId: TableId, rowId: string): Promise<void>;
  
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
}

