/**
 * DuckDB Table Query Service Implementation
 *
 * Infrastructure implementation for executing analytical queries against Apache Arrow files
 * stored in S3 using DuckDB's powerful analytical capabilities with zero-copy performance.
 *
 * AIDEV-NOTE: Infrastructure implementation of TableQueryService using @duckdb/node-api
 * Uses dynamic import and promise-based API for reliable cross-platform compatibility
 */

import { BUCKET_NAME } from '@/lib/s3/client';

import type { Result } from '@/ddd/domain/shared/result';
import type {
  TableQueryService,
  QueryResult
} from '@/ddd/domain/tables/services/table-query-service';
import { TableId } from '@/ddd/domain/shared/value-objects';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import { DuckDB, eq, gt, gte, lt, lte, like, type QueryFilter } from './duckdb-sql-builder';
import type { DuckDBConnection } from '@duckdb/node-api';
import { getDuckDBConnection } from './duckdb-connection-manager';

export class DuckDBTableQueryService implements TableQueryService {
  private connection: DuckDBConnection | null = null;

  constructor() {
    // AIDEV-NOTE: Will get singleton connection on first use
    // Connection is already configured with extensions and S3 by DuckDBConnectionManager
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connection) {
      console.log('[DuckDB Query Service] Getting pre-configured DuckDB connection...');
      this.connection = await getDuckDBConnection();

      if (!this.connection) {
        throw new Error('DuckDB connection unavailable');
      }

      console.log('[DuckDB Query Service] ✅ Using pre-configured DuckDB connection');
    }
  }

  private async executeQuery(sql: string): Promise<Result<QueryResult>> {
    await this.ensureConnection();

    if (!this.connection) {
      console.error('[DuckDB Query Service] ❌ Cannot execute query - DuckDB not initialized');
      return { success: false, error: 'DuckDB not initialized' };
    }

    const startTime = Date.now();

    console.log('[DuckDB Query Service] 🔍 Executing SQL query:', sql);

    try {
      // Use promise-based API for queries
      const result = await this.connection.run(sql);
      const rows = await result.getRows();
      const executionTime = Date.now() - startTime;

      console.log('[DuckDB Query Service] ✅ Query executed successfully:', {
        rowCount: rows?.length || 0,
        executionTime: `${executionTime}ms`
      });

      return {
        success: true,
        data: {
          rows: rows || [],
          rowCount: rows?.length || 0,
          executionTime
        }
      };
    } catch (err: any) {
      const executionTime = Date.now() - startTime;

      console.error('[DuckDB Query Service] ❌ Query execution failed:', {
        error: err.message,
        sql,
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        error: err.message || 'Failed to execute query'
      };
    }
  }

  async queryTable(
    tableId: TableId,
    filters?: Record<string, any>,
    orderBy?: string,
    orderDirection?: 'ASC' | 'DESC',
    limit?: number,
    offset?: number
  ): Promise<Result<QueryResult>> {
    try {
      console.log('[DuckDB Query Service] 📊 Query requested for table:', {
        tableId: tableId.value,
        filters,
        orderBy,
        orderDirection,
        limit,
        offset
      });

      // Get S3 path for table
      const s3Path = await this.getTableS3Path(tableId.value);
      if (!s3Path) {
        console.error('[DuckDB Query Service] ❌ Table not found:', tableId.value);
        return { success: false, error: 'Table not found' };
      }

      // Build SQL query
      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`;
      console.log('[DuckDB Query Service] 📂 Resolved S3 path:', s3Url);

      // Convert basic filters to QueryFilter format for the SQL builder
      const queryFilters: QueryFilter[] = [];
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== null && value !== undefined) {
            queryFilters.push(eq(key, value));
          }
        }
        console.log('[DuckDB Query Service] 🔎 Applying filters:', queryFilters);
      }

      // Use the type-safe SQL builder
      const sql = DuckDB.select(s3Url, {
        filters: queryFilters,
        orderBy,
        orderDirection,
        limit,
        offset
      });

      return await this.executeQuery(sql);

    } catch (error) {
      console.error('[DuckDB Query Service] ❌ Error querying table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query table'
      };
    }
  }

  // Private helper methods

  private async getTableS3Path(tableId: number): Promise<S3TablePath | null> {
    try {
      // Import db client dynamically to avoid circular dependencies
      const { db } = require('@/lib/db/client');
      const { tables } = require('@/lib/db/schema');
      const { eq } = require('drizzle-orm');

      // Query table metadata from PostgreSQL
      const tableRecord = await db
        .select({
          id: tables.id,
          organizationId: tables.organizationId,
          databaseId: tables.databaseId,
          s3Path: tables.s3Path
        })
        .from(tables)
        .where(eq(tables.id, tableId))
        .limit(1);

      if (tableRecord.length === 0) {
        return null;
      }

      const table = tableRecord[0];
      
      // Use existing s3Path if available, otherwise construct from IDs
      if (table.s3Path) {
        return S3TablePath.fromPath(table.s3Path);
      } else {
        return new S3TablePath(table.organizationId, table.databaseId, table.id);
      }
    } catch (error) {
      console.error('[DuckDB] Error getting table S3 path:', error);
      return null;
    }
  }


  /**
   * Count rows in a table with optional filters
   */
  async countRows(tableId: number, queryFilters?: QueryFilter[]): Promise<Result<number>> {
    try {
      console.log('[DuckDB Query Service] 🔢 Count requested for table:', {
        tableId,
        filters: queryFilters
      });

      const s3Path = await this.getTableS3Path(tableId);
      if (!s3Path) {
        console.error('[DuckDB Query Service] ❌ Table not found:', tableId);
        return { success: false, error: 'Table not found' };
      }

      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`;
      console.log('[DuckDB Query Service] 📂 Resolved S3 path:', s3Url);

      const sql = DuckDB.count(s3Url, queryFilters);
      const result = await this.executeQuery(sql);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const count = result.data?.rows[0]?.count || 0;
      console.log('[DuckDB Query Service] ✅ Count result:', count);
      return { success: true, data: count };

    } catch (error) {
      console.error('[DuckDB Query Service] ❌ Error counting rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to count rows'
      };
    }
  }

  /**
   * Get distinct values for a field
   */
  async getDistinctValues(
    tableId: number,
    field: string,
    queryFilters?: QueryFilter[]
  ): Promise<Result<any[]>> {
    try {
      console.log('[DuckDB Query Service] 🎯 Distinct values requested:', {
        tableId,
        field,
        filters: queryFilters
      });

      const s3Path = await this.getTableS3Path(tableId);
      if (!s3Path) {
        console.error('[DuckDB Query Service] ❌ Table not found:', tableId);
        return { success: false, error: 'Table not found' };
      }

      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`;
      console.log('[DuckDB Query Service] 📂 Resolved S3 path:', s3Url);

      const sql = DuckDB.distinct(s3Url, field, queryFilters);
      const result = await this.executeQuery(sql);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const values = result.data?.rows.map(row => row[field]) || [];
      console.log('[DuckDB Query Service] ✅ Distinct values found:', {
        field,
        count: values.length
      });
      return { success: true, data: values };

    } catch (error) {
      console.error('[DuckDB Query Service] ❌ Error getting distinct values:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get distinct values'
      };
    }
  }
}