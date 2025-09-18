/**
 * Data Storage Service Interface
 * 
 * Domain service interface for storing and retrieving table data using proper Value Objects.
 * Implementation can be Arrow IPC, CSV, JSON, Avro, etc.
 * 
 * AIDEV-NOTE: Uses Row domain objects for type safety and DDD consistency.
 * Fields are accessed via table.fields - no separate fields parameter needed
 */

import type { Result } from '@/src/ddd/domain/shared/result';
import type { DynamicTable } from '../entities/dynamic-table';
import type { Row } from '../value-objects/row';
import type { TableId } from '@/src/ddd/domain/shared/value-objects/table-id';
import type { DatabaseId } from '@/src/ddd/domain/shared/value-objects/database-id';
import type { OrganizationId } from '@/src/ddd/domain/shared/value-objects/organization-id';

export interface StorageMetadata {
  format: string;
  totalRows: number;
  totalBytes: number;
  lastModified: Date;
  tableId: TableId;
  databaseId: DatabaseId;
  organizationId: OrganizationId;
}

export interface DataStorageService {
  /**
   * Convert and store row data in optimized format using domain entities
   * Rows contain field values, table contains field definitions
   */
  storeData(
    rows: Row[],
    table: DynamicTable
  ): Promise<Result<Buffer>>;

  /**
   * Retrieve and convert stored data back to Row objects using domain entities
   * Uses table.fields to reconstruct Row objects with proper field metadata
   */
  retrieveData(
    buffer: Buffer,
    table: DynamicTable
  ): Promise<Result<Row[]>>;

  /**
   * Read storage metadata without loading data, using table context for domain metadata
   */
  readMetadata(buffer: Buffer, table: DynamicTable): Promise<Result<StorageMetadata>>;
}