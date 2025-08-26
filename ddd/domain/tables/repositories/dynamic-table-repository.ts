// AIDEV-NOTE: Simplified Dynamic Table repository interface - just essential CRUD operations
// Focuses on the methods actually used in the application

import type { 
  DynamicTable, 
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions,
  CreateDynamicTableData
} from '../entities/dynamic-table';

export type { CreateDynamicTableData } from '../entities/dynamic-table';

export interface IDynamicTableRepository {
  // Table CRUD - just the basics
  findById(id: number): Promise<DynamicTable | null>;
  findByOrganization(organizationId: number): Promise<DynamicTable[]>;
  findByDatabase(databaseId: number): Promise<DynamicTable[]>;
  create(data: CreateDynamicTableData): Promise<DynamicTable>;
  update(id: number, data: Partial<DynamicTable>): Promise<DynamicTable>;
  delete(id: number): Promise<void>;
  existsByStorageLocation(organizationId: number, storageLocation: string): Promise<boolean>;
  
  // Row CRUD - what's actually used
  insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow>;
  findRows(tableId: number, options?: RowQueryOptions): Promise<DynamicTableRow[]>;
  getRow(tableId: number, rowId: string): Promise<DynamicTableRow | null>;
  getRows(tableId: number, options?: RowQueryOptions): Promise<DynamicTableRow[]>; 
  updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow>;
  deleteRow(tableId: number, rowId: string): Promise<void>;
  
  // Generic table operations for any storage backend
  tableExists(tableId: number): Promise<boolean>;
  getTableStats(tableId: number): Promise<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }>;
  
  // Table analysis methods needed by application services
  hasRows(tableId: number): Promise<boolean>;
  findAll(): Promise<DynamicTable[]>;
}

// FUTURE-WORK: Additional methods to implement as needed
// The following methods were part of the original comprehensive interface
// but are not currently used in the application. They are preserved here
// for future implementation when these features are required:
/*
export interface IDynamicTableRepositoryFuture extends IDynamicTableRepository {
  // Additional Table CRUD operations
  findByDbName(dbName: string): Promise<DynamicTable | null>;
  findByDatabase(databaseId: number): Promise<DynamicTable[]>;
  update(id: number, data: UpdateDynamicTableData): Promise<DynamicTable>;
  
  // Table Schema Operations (PostgreSQL DDL)
  createPhysicalTable(dbName: string): Promise<void>;
  dropPhysicalTable(dbName: string): Promise<void>;
  renamePhysicalTable(oldDbName: string, newDbName: string): Promise<void>;
  
  // Additional Row Operations
  findRowById(tableId: number, rowId: string): Promise<DynamicTableRow | null>;
  
  // Advanced Row Operations
  bulkInsertRows(tableId: number, rows: CreateRowData[]): Promise<DynamicTableRow[]>;
  bulkUpdateRows(tableId: number, updates: Array<{id: string; data: UpdateRowData}>): Promise<DynamicTableRow[]>;
  bulkDeleteRows(tableId: number, rowIds: string[]): Promise<void>;
  bulkOperation(tableId: number, operation: BulkRowOperation): Promise<DynamicTableRow[]>;
  
  // Row Queries and Filtering
  countRows(tableId: number, options?: Omit<RowQueryOptions, 'limit' | 'offset'>): Promise<number>;
  searchRows(tableId: number, searchTerm: string, searchFields?: string[]): Promise<DynamicTableRow[]>;
  getDistinctValues(tableId: number, fieldKey: string): Promise<any[]>;
  
  // Table Management
  getTableStats(tableId: number): Promise<DynamicTableStats>;
  validateTableOperation(operation: TableOperation): Promise<{ valid: boolean; errors: string[] }>;
  executeTableOperation(operation: TableOperation): Promise<void>;
  
  // Table Discovery and Relationships
  getRelatedTables(tableId: number): Promise<DynamicTable[]>;
  getTableDependencies(tableId: number): Promise<{
    dependsOn: DynamicTable[];        // Tables this table references
    dependedBy: DynamicTable[];       // Tables that reference this table
  }>;
  
  // Data Migration and Export
  exportTableData(tableId: number, format: 'json' | 'csv' | 'sql'): Promise<string>;
  importTableData(tableId: number, data: any[], format: 'json' | 'csv'): Promise<DynamicTableRow[]>;
  createTableMigration(fromTableId: number, toTableId: number): Promise<TableMigration>;
  
  // Performance and Optimization
  analyzeTable(tableId: number): Promise<{
    rowCount: number;
    tableSize: string;
    indexUsage: Record<string, any>;
    queryStats: Record<string, any>;
  }>;
  optimizeTable(tableId: number): Promise<void>;
  rebuildIndexes(tableId: number): Promise<void>;
  
  // Business Logic Operations
  canDeleteTable(tableId: number): Promise<boolean>;
  getTableUsageInfo(tableId: number): Promise<{
    lastAccessed?: Date;
    accessCount: number;
    relatedRecords: number;
    linkedTables: number;
  }>;
  
  // Backup and Recovery
  createTableBackup(tableId: number): Promise<{
    backupId: string;
    location: string;
    size: number;
  }>;
  restoreTableFromBackup(tableId: number, backupId: string): Promise<void>;
  
  // Advanced Queries
  executeRawQuery(tableId: number, query: string, params?: any[]): Promise<DynamicTableRow[]>;
  executeAggregateQuery(tableId: number, aggregations: Array<{
    field: string;
    function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
    alias?: string;
  }>): Promise<Record<string, any>[]>;
}
*/