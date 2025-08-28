/**
 * Data Storage Service Interface
 * 
 * Generic domain service interface for storing and retrieving table data.
 * Implementation can be Arrow IPC, CSV, JSON, Avro, etc.
 * 
 * AIDEV-NOTE: Generic domain service interface for data storage (not format-specific)
 */

import type { Result } from '@/ddd/domain/shared/result';
import type { TableSchema } from '../types/schema-types';

export interface StorageMetadata {
  format: string;
  totalRows: number;
  totalBytes: number;
  lastModified: Date;
}

export interface DataStorageService {
  /**
   * Convert and store row data in optimized format
   */
  storeData(
    data: Array<Record<string, any>>,
    schema: TableSchema
  ): Promise<Result<Buffer>>;

  /**
   * Retrieve and convert stored data back to JSON
   */
  retrieveData(
    buffer: Buffer,
    schema: TableSchema
  ): Promise<Result<Array<Record<string, any>>>>;

  /**
   * Read storage metadata without loading data
   */
  readMetadata(buffer: Buffer): Promise<Result<StorageMetadata>>;
}