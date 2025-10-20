/**
 * DuckDB Table Query Service Implementation
 *
 * Infrastructure implementation for executing analytical queries against Apache Arrow files
 * stored in S3 using DuckDB's powerful analytical capabilities with zero-copy performance.
 *
 * AIDEV-NOTE: Infrastructure implementation of TableQueryService using stable duckdb package
 * Uses callback-based API for reliable cross-platform compatibility
 */

import * as duckdb from 'duckdb';

import { BUCKET_NAME } from '@/lib/s3/client';

import type { Result } from '@/ddd/domain/shared/result';
import type { 
  TableQueryService, 
  QueryResult
} from '@/ddd/domain/tables/services/table-query-service';
import { TableId } from '@/ddd/domain/shared/value-objects';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import { DuckDB, eq, gt, gte, lt, lte, like, type QueryFilter } from './duckdb-sql-builder';

export class DuckDBTableQueryService implements TableQueryService {
  private connection: duckdb.Database | null = null;
  private isInitialized = false;

  constructor() {
    // AIDEV-NOTE: Initialize DuckDB at construction time using stable API
    // https://duckdb.org/docs/stable/clients/nodejs/overview
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create in-memory database with unsigned extensions enabled (for Arrow)
        this.connection = new duckdb.Database(':memory:', {
          allow_unsigned_extensions: 'true'
        });

        // Install extensions using stable callback-based API
        this.connection.exec("INSTALL arrow; LOAD arrow; INSTALL httpfs; LOAD httpfs;", (err) => {
          if (err) {
            console.error('[DuckDB] Failed to install extensions:', err);
            reject(err);
            return;
          }

          console.log('[DuckDB] Extensions loaded successfully');

          // Configure S3 credentials if available
          if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            const s3Config = [
              `SET s3_region='${process.env.AWS_REGION || 'ap-southeast-2'}';`,
              `SET s3_access_key_id='${process.env.AWS_ACCESS_KEY_ID}';`,
              `SET s3_secret_access_key='${process.env.AWS_SECRET_ACCESS_KEY}';`
            ];

            if (process.env.S3_ENDPOINT_URL) {
              s3Config.push(`SET s3_endpoint='${process.env.S3_ENDPOINT_URL}';`);
              s3Config.push(`SET s3_use_ssl='${!process.env.S3_ENDPOINT_URL.startsWith('http://')}';`);
            }

            this.connection!.exec(s3Config.join(' '), (s3Err) => {
              if (s3Err) {
                console.warn('[DuckDB] Failed to configure S3:', s3Err);
              } else {
                console.log('[DuckDB] S3 configuration applied');
              }

              this.isInitialized = true;
              console.log('[DuckDB] Database initialized successfully');
              resolve();
            });
          } else {
            this.isInitialized = true;
            console.log('[DuckDB] Database initialized successfully (no S3 credentials)');
            resolve();
          }
        });
      } catch (error) {
        console.error('[DuckDB] Failed to initialize database:', error);
        reject(error);
      }
    });
  }

  private async executeQuery(sql: string): Promise<Result<QueryResult>> {
    if (!this.connection || !this.isInitialized) {
      return { success: false, error: 'DuckDB not initialized' };
    }

    return new Promise((resolve) => {
      const startTime = Date.now();

      // Use stable callback-based API for queries
      this.connection!.all(sql, (err, rows) => {
        const executionTime = Date.now() - startTime;

        if (err) {
          console.error('[DuckDB] Error executing query:', err);
          resolve({
            success: false,
            error: err.message || 'Failed to execute query'
          });
          return;
        }

        resolve({
          success: true,
          data: {
            rows: rows || [],
            rowCount: rows?.length || 0,
            executionTime
          }
        });
      });
    });
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
      // Get S3 path for table
      const s3Path = await this.getTableS3Path(tableId.value);
      if (!s3Path) {
        return { success: false, error: 'Table not found' };
      }

      // Build SQL query
      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`;
      // Convert basic filters to QueryFilter format for the SQL builder
      const queryFilters: QueryFilter[] = [];
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          if (value !== null && value !== undefined) {
            queryFilters.push(eq(key, value));
          }
        }
      }

      // Use the type-safe SQL builder
      const sql = DuckDB.select(s3Url, {
        filters: queryFilters,
        orderBy,
        orderDirection,
        limit,
        offset
      });
      
      console.log(`[DuckDB] Executing query: ${sql}`);
      return await this.executeQuery(sql);
      
    } catch (error) {
      console.error('[DuckDB] Error querying table:', error);
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
      const s3Path = await this.getTableS3Path(tableId);
      if (!s3Path) {
        return { success: false, error: 'Table not found' };
      }

      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`;
      const sql = DuckDB.count(s3Url, queryFilters);
      
      console.log(`[DuckDB] Executing count query: ${sql}`);
      const result = await this.executeQuery(sql);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      const count = result.data?.rows[0]?.count || 0;
      return { success: true, data: count };
      
    } catch (error) {
      console.error('[DuckDB] Error counting rows:', error);
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
      const s3Path = await this.getTableS3Path(tableId);
      if (!s3Path) {
        return { success: false, error: 'Table not found' };
      }

      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`;
      const sql = DuckDB.distinct(s3Url, field, queryFilters);
      
      console.log(`[DuckDB] Executing distinct query: ${sql}`);
      const result = await this.executeQuery(sql);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      const values = result.data?.rows.map(row => row[field]) || [];
      return { success: true, data: values };
      
    } catch (error) {
      console.error('[DuckDB] Error getting distinct values:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get distinct values'
      };
    }
  }
}