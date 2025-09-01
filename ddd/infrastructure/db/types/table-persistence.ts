/**
 * Table Persistence Types
 * 
 * Infrastructure-specific types for database operations and storage.
 * These types represent the database layer concerns, not domain concepts.
 * 
 * AIDEV-NOTE: Moved from dynamic-table.ts to properly separate infrastructure 
 * concerns from domain logic. These are storage implementation details.
 */

import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';

// ========================================
// Database Row Format (S3 + PostgreSQL)
// ========================================

/**
 * The actual row format stored in S3 Arrow files and used by repositories.
 * Contains system fields (id, timestamps) and dynamic field columns (field_1, field_2, etc.)
 */
export interface DynamicTableRow {
  id: string;                          // UUID primary key
  created_at?: Date | string | null;   // Auto-managed timestamp
  updated_at?: Date | string | null;   // Auto-managed timestamp
  [fieldKey: string]: any;             // Dynamic field_{id} columns with typed values
}

// ========================================
// Query Operations & Filtering
// ========================================

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
  | 'contains'     // Contains operator (for relation fields)
  | 'contained_by' // Contained by operator
  | 'has_key';     // Has key operator

// ========================================
// Database Entity Creation
// ========================================

// AIDEV-NOTE: CreateDynamicTableData removed from infrastructure types
// Use the version from application service with proper Value Objects instead

// ========================================
// Database Update Operations
// ========================================

export interface UpdateDynamicTableData {
  databaseId?: number;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
  fields?: TableField[];  // Allow field synchronization for saveTable operations
  // Note: organizationId typically not changed after creation
}