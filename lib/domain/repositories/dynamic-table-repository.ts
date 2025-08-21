// AIDEV-NOTE: Simplified Dynamic Table repository interface - just essential CRUD operations
// Focuses on the methods actually used in the application

import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '../entities/dynamic-table';

export interface IDynamicTableRepository {
  // Table CRUD - just the basics
  findById(id: number): Promise<DynamicTable | null>;
  findByOrganization(organizationId: number): Promise<DynamicTable[]>;
  create(data: CreateDynamicTableData): Promise<DynamicTable>;
  delete(id: number): Promise<void>;
  
  // Row CRUD - what's actually used
  insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow>;
  findRows(tableId: number, options?: RowQueryOptions): Promise<DynamicTableRow[]>;
  updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow>;
  deleteRow(tableId: number, rowId: string): Promise<void>;
}