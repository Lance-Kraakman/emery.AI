// AIDEV-NOTE: Dynamic Table repository interface - defines business operations for runtime table management
// Supports Baserow-style dynamic table creation with field_{id} column naming and complex operations

import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  UpdateDynamicTableData,
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions,
  DynamicTableStats,
  BulkRowOperation,
  TableOperation,
  TableMigration
} from '../entities/dynamic-table';

export interface IDynamicTableRepository {
  // Basic Table CRUD operations
  findById(id: number): Promise<DynamicTable | null>;
  findByDbName(dbName: string): Promise<DynamicTable | null>;
  findByOrganization(organizationId: number): Promise<DynamicTable[]>;
  findByDatabase(databaseId: number): Promise<DynamicTable[]>;
  create(data: CreateDynamicTableData): Promise<DynamicTable>;
  update(id: number, data: UpdateDynamicTableData): Promise<DynamicTable>;
  delete(id: number): Promise<void>;
  
  // Table Schema Operations (PostgreSQL DDL)
  createPhysicalTable(dbName: string): Promise<void>;
  dropPhysicalTable(dbName: string): Promise<void>;
  renamePhysicalTable(oldDbName: string, newDbName: string): Promise<void>;
  
  // Row CRUD Operations (Dynamic Data)
  insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow>;
  findRowById(tableId: number, rowId: string): Promise<DynamicTableRow | null>;
  findRows(tableId: number, options?: RowQueryOptions): Promise<DynamicTableRow[]>;
  updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow>;
  deleteRow(tableId: number, rowId: string): Promise<void>;
  
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
  }>): Promise<Record<string, any>>;
  
  // Table Validation
  validateTableIntegrity(tableId: number): Promise<{
    valid: boolean;
    issues: Array<{
      type: 'MISSING_FIELD' | 'ORPHANED_DATA' | 'CONSTRAINT_VIOLATION' | 'INDEX_CORRUPTION';
      field?: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  }>;
  
  // Real-time Operations
  watchTableChanges(tableId: number, callback: (change: {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    rowId: string;
    oldData?: DynamicTableRow;
    newData?: DynamicTableRow;
    timestamp: Date;
  }) => void): Promise<() => void>; // Returns unsubscribe function
}