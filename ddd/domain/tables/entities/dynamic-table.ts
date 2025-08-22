// AIDEV-NOTE: Dynamic Table domain entities - manages runtime-created tables in Baserow-style system
// Dynamic tables use field_{id} column naming and support complex types like JSONB relations

export interface DynamicTable {
  id: number;
  databaseId: number;                  // References databases.id
  organizationId: number;               // References organizations.id (denormalized for RLS)
  name: string;                        // Human-readable table name
  dbName: string;                      // Actual PostgreSQL table name (slugified, unique)
  metadata?: TableMetadata | null;     // JSONB metadata for descriptions, etc.
  createdBy: string;                   // UUID reference to users.id
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

// Database entity (parent of tables)
export interface Database {
  id: number;
  organizationId: number;
  name: string;
  slug: string;                        // URL-safe database identifier
  metadata?: DatabaseMetadata | null;
  createdBy: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface DatabaseMetadata {
  description?: string;
  [key: string]: any;                  // Additional metadata for RAG indexing
}

export interface TableMetadata {
  description?: string;
  [key: string]: any;                  // Extensible metadata for future features
}

export interface CreateDynamicTableData {
  databaseId: number;
  organizationId: number;
  name: string;
  dbName: string;                      // Generated from name via slugify
  metadata?: TableMetadata;
  createdBy: string;
}

export interface UpdateDynamicTableData {
  databaseId?: number;
  name?: string;
  metadata?: TableMetadata;
  // Note: dbName and organizationId typically not changed after creation
}

export interface DynamicTableRow {
  id: string;                          // UUID primary key
  created_at?: Date | string | null;   // Auto-managed timestamp
  updated_at?: Date | string | null;   // Auto-managed timestamp
  [fieldKey: string]: any;             // Dynamic field_{id} columns with typed values
}

export interface CreateRowData {
  [fieldKey: string]: any;             // Keys should be field_{id} format or field slugs
}                                      // Field processor will map slugs to field_{id}

export interface UpdateRowData {
  [fieldKey: string]: any;             // Partial updates - field_{id} format or field slugs
}                                      // Field processor will handle mapping and JSON parsing

export interface RowQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;                    // Column name to order by
  orderDirection?: 'ASC' | 'DESC';
  filters?: RowFilter[];               // Complex filtering options
}

export interface RowFilter {
  field: string;                       // field_{id} format
  operator: FilterOperator;
  value: any;
}

export type FilterOperator = 
  | 'eq'           // equals
  | 'ne'           // not equals  
  | 'gt'           // greater than
  | 'gte'          // greater than or equal
  | 'lt'           // less than
  | 'lte'          // less than or equal
  | 'like'         // SQL LIKE pattern
  | 'ilike'        // case-insensitive LIKE
  | 'in'           // value in array
  | 'not_in'       // value not in array
  | 'is_null'      // IS NULL
  | 'is_not_null'  // IS NOT NULL
  | 'contains'     // JSONB contains (for relation fields)
  | 'contained_by' // JSONB contained by
  | 'has_key';     // JSONB has key

// Table statistics and metadata
export interface DynamicTableStats {
  table: DynamicTable;
  rowCount: number;
  fieldCount: number;
  lastUpdated?: Date;
  sizeBytes?: number;                  // Approximate table size
}

// Complex queries and operations
export interface TableOperation {
  type: 'CREATE_TABLE' | 'DROP_TABLE' | 'RENAME_TABLE' | 'UPDATE_METADATA';
  tableName: string;
  parameters?: Record<string, any>;
}

export interface BulkRowOperation {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  rows: Array<{
    id?: string;                       // Required for UPDATE/DELETE
    data?: CreateRowData | UpdateRowData; // Required for INSERT/UPDATE
  }>;
}

// Migration and schema operations
export interface TableMigration {
  id: string;
  fromSchema: TableSchema;
  toSchema: TableSchema;
  operations: TableOperation[];
  createdAt: Date;
}

export interface TableSchema {
  tableName: string;
  fields: Array<{
    id: number;
    name: string;
    type: string;
    required: boolean;
  }>;
}
