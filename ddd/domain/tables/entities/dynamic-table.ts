// AIDEV-NOTE: Dynamic Table domain entities - manages runtime-created tables in Baserow-style system
// Dynamic tables use field_{id} column naming and support complex types like JSONB relations

import type { TableMetadata } from '../value-objects/table-metadata';
import { TableId, DatabaseId, OrganizationId, UserId, FieldId } from '@/ddd/domain/shared/value-objects';

export class DynamicTable {
  private constructor(
    private readonly _id: TableId,
    private readonly _databaseId: DatabaseId,              // References databases.id
    private readonly _organizationId: OrganizationId,      // References organizations.id (denormalized for RLS)
    private _name: string,                                 // Human-readable table name
    private _storageLocation: string,                      // Generic storage location (S3 path, table name, etc.)
    private _metadata: TableMetadata | undefined,         // JSONB metadata using value object
    private readonly _createdBy: UserId,                   // UUID reference to users.id
    private readonly _createdAt: Date | null,
    private _updatedAt: Date | null
  ) {}

  // Getters
  get id(): TableId { return this._id; }
  get databaseId(): DatabaseId { return this._databaseId; }
  get organizationId(): OrganizationId { return this._organizationId; }
  get name(): string { return this._name; }
  get storageLocation(): string { return this._storageLocation; }
  get metadata(): TableMetadata | undefined { return this._metadata; }
  get createdBy(): UserId { return this._createdBy; }
  get createdAt(): Date | null { return this._createdAt ? new Date(this._createdAt) : null; }
  get updatedAt(): Date | null { return this._updatedAt ? new Date(this._updatedAt) : null; }

  // Business methods
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Table name cannot be empty');
    }
    if (newName.length > 100) {
      throw new Error('Table name cannot exceed 100 characters');
    }
    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  updateStorageLocation(newStorageLocation: string): void {
    if (!newStorageLocation || newStorageLocation.trim().length === 0) {
      throw new Error('Storage location cannot be empty');
    }
    this._storageLocation = newStorageLocation.trim();
    this._updatedAt = new Date();
  }

  updateMetadata(newMetadata: TableMetadata | undefined): void {
    this._metadata = newMetadata;
    this._updatedAt = new Date();
  }

  canBeDeleted(): boolean {
    // Add business logic for when tables can be deleted
    // For example, tables with dependent relations might not be deletable
    return true; // Placeholder - implement actual business rules
  }

  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._organizationId.equals(organizationId);
  }

  belongsToDatabase(databaseId: DatabaseId): boolean {
    return this._databaseId.equals(databaseId);
  }

  // Factory methods
  static create(data: CreateDynamicTableData): DynamicTable {
    // Validate creation data
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Table name is required');
    }
    if (!data.storageLocation || data.storageLocation.trim().length === 0) {
      throw new Error('Storage location is required');
    }

    return new DynamicTable(
      TableId.placeholder(), // Will be set by repository
      data.databaseId,
      data.organizationId,
      data.name.trim(),
      data.storageLocation.trim(),
      data.metadata,
      data.createdBy,
      null, // Will be set by repository
      null
    );
  }

  static fromPersistence(data: {
    id: number;
    databaseId: number;
    organizationId: number;
    name: string;
    storageLocation: string;
    metadata?: TableMetadata;
    createdBy: string;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }): DynamicTable {
    return new DynamicTable(
      TableId.fromNumber(data.id),
      DatabaseId.fromNumber(data.databaseId),
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      data.storageLocation,
      data.metadata,
      UserId.fromString(data.createdBy),
      data.createdAt || null,
      data.updatedAt || null
    );
  }

  // Conversion method for persistence
  toPersistence(): {
    id: number;
    databaseId: number;
    organizationId: number;
    name: string;
    storageLocation: string;
    metadata?: TableMetadata;
    createdBy: string;
    createdAt: Date | null;
    updatedAt: Date | null;
  } {
    return {
      id: this._id.value,
      databaseId: this._databaseId.value,
      organizationId: this._organizationId.value,
      name: this._name,
      storageLocation: this._storageLocation,
      metadata: this._metadata,
      createdBy: this._createdBy.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}

// Database entity (parent of tables)
export interface Database {
  id: DatabaseId;
  organizationId: OrganizationId;
  name: string;
  slug: string;                        // URL-safe database identifier
  metadata?: DatabaseMetadata | null;
  createdBy: UserId;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface DatabaseMetadata {
  description?: string;
  [key: string]: any;                  // Additional metadata for RAG indexing
}


export interface CreateDynamicTableData {
  databaseId: DatabaseId;
  organizationId: OrganizationId;
  name: string;
  storageLocation: string;             // Generated storage location (S3 path, table name, etc.)
  metadata?: TableMetadata;
  createdBy: UserId;
}

export interface UpdateDynamicTableData {
  databaseId?: DatabaseId;
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
    id: FieldId;
    name: string;
    type: string;
    required: boolean;
  }>;
}
