/**
 * Table Query Service Interface
 * 
 * Domain interface for table query operations.
 * Defines the contract for searching and filtering tables
 * without specifying the implementation details.
 * 
 * This is a pure domain interface - no infrastructure dependencies.
 */

import type { DynamicTable } from '../entities/dynamic-table';
import type { TableId, OrganizationId, DatabaseId } from '../../shared/value-objects';
import type { Result } from '../../shared/result';

export interface ITableQueryService {
  /**
   * Find a table by its ID
   */
  findTableById(tableId: TableId): Promise<Result<DynamicTable | null>>;

  /**
   * Find all tables for an organization
   */
  findTablesByOrganization(organizationId: OrganizationId): Promise<Result<DynamicTable[]>>;

  /**
   * Find all tables in a database
   */
  findTablesByDatabase(databaseId: DatabaseId): Promise<Result<DynamicTable[]>>;

  /**
   * Search tables by name or description
   */
  searchTables(query: string, organizationId: OrganizationId): Promise<Result<DynamicTable[]>>;

  /**
   * Check if a table exists
   */
  tableExists(tableId: TableId): Promise<Result<boolean>>;

  /**
   * Check if a table name is available within an organization
   */
  isTableNameAvailable(name: string, organizationId: OrganizationId, excludeTableId?: TableId): Promise<Result<boolean>>;

  /**
   * Get table count for an organization
   */
  getTableCount(organizationId: OrganizationId): Promise<Result<number>>;

  /**
   * Get table count for a database
   */
  getTableCountForDatabase(databaseId: DatabaseId): Promise<Result<number>>;
}