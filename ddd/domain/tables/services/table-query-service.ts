/**
 * Table Query Service Interface
 * 
 * Generic domain service interface for querying table data.
 * Implementation can be PostgreSQL, DuckDB, BigQuery, etc.
 * 
 * AIDEV-NOTE: Generic domain service interface for table querying (not tech-specific)
 */

import type { Result } from '@/ddd/domain/shared/result';

export interface QueryResult {
  rows: Array<Record<string, any>>;
  rowCount: number;
}

export interface TableQueryService {
  /**
   * Query single table with filters, ordering, pagination
   */
  queryTable(
    tableId: number,
    filters?: Record<string, any>,
    orderBy?: string,
    orderDirection?: 'ASC' | 'DESC',
    limit?: number,
    offset?: number
  ): Promise<Result<QueryResult>>;
}