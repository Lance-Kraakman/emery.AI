/**
 * Table Query Service Interface
 * 
 * Generic domain service interface for querying table data.
 * Implementation can be PostgreSQL, DuckDB, BigQuery, etc.
 * 
 * AIDEV-NOTE: Generic domain service interface for table querying (not tech-specific)
 */

import type { Result } from '@/src/ddd/domain/shared/result';
import type { TableId } from '@/src/ddd/domain/shared/value-objects';

export interface QueryResult {
  rows: Array<Record<string, any>>;
  rowCount: number;
  executionTime?: number; // Optional execution time in milliseconds
}

export interface TableQueryService {
  /**
   * Query single table with filters, ordering, pagination
   */
  queryTable(
    tableId: TableId,
    filters?: Record<string, any>,
    orderBy?: string,
    orderDirection?: 'ASC' | 'DESC',
    limit?: number,
    offset?: number
  ): Promise<Result<QueryResult>>;
}