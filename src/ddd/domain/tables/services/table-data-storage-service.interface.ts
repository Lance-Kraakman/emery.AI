/**
 * Table Data Storage Service Interface
 * 
 * Domain interface for table data operations.
 * Defines the contract for storing and retrieving table data
 * without specifying the implementation (S3, gRPC, etc.).
 * 
 * This is a pure domain interface - no infrastructure dependencies.
 */

import type { DynamicTable } from '../entities/dynamic-table';
import type { Row } from '../value-objects/row';
import type { Result } from '../../shared/result';

export interface ITableDataStorageService {
  /**
   * Create a new table storage (Delta Lake table)
   */
  createTable(table: DynamicTable): Promise<Result<string>>; // Returns S3 path

  /**
   * Store rows in a table with explicit write mode
   *
   * @param rows - Row entities to store
   * @param table - Table entity containing schema and storage location
   * @param mode - Write mode: "append" adds new rows, "overwrite" replaces entire table
   *
   * AIDEV-NOTE: This is the core storage method. Repository layer uses:
   * - mode="append" for insertRow() operations
   * - mode="overwrite" for updateRow() and deleteRow() operations (read-modify-write pattern)
   */
  storeRows(
    rows: Row[],
    table: DynamicTable,
    mode: 'append' | 'overwrite'
  ): Promise<Result<void>>;

  /**
   * Retrieve rows from a table
   */
  retrieveRows(table: DynamicTable, options?: {
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<Result<Row[]>>;

  /**
   * Get table statistics
   */
  getTableStats(table: DynamicTable): Promise<Result<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }>>;

  /**
   * Check if table has any rows
   */
  hasRows(table: DynamicTable): Promise<Result<boolean>>;

  /**
   * Delete the entire table storage
   */
  deleteTable(table: DynamicTable): Promise<Result<void>>;
}