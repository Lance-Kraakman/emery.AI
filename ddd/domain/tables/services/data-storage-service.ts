/**
 * Data Storage Service Interface
 * 
 * Domain service interface for storing and retrieving table data using proper Value Objects.
 * Implementation can be Arrow IPC, CSV, JSON, Avro, etc.
 * 
 * AIDEV-NOTE: Refactored to use DynamicTable and Field entities instead of primitive schemas
 */

import type { Result } from '@/ddd/domain/shared/result';
import type { DynamicTable } from '../entities/dynamic-table';
import type { Field } from '@/ddd/domain/fields/entities/field';
import type { TableId } from '@/ddd/domain/shared/value-objects/table-id';
import type { DatabaseId } from '@/ddd/domain/shared/value-objects/database-id';
import type { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';

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
   */
  storeData(
    data: Array<Record<string, any>>,
    table: DynamicTable,
    fields: Field[]
  ): Promise<Result<Buffer>>;

  /**
   * Retrieve and convert stored data back to JSON using domain entities
   */
  retrieveData(
    buffer: Buffer,
    table: DynamicTable,
    fields: Field[]
  ): Promise<Result<Array<Record<string, any>>>>;

  /**
   * Read storage metadata without loading data, using table context for domain metadata
   */
  readMetadata(buffer: Buffer, table: DynamicTable): Promise<Result<StorageMetadata>>;
}