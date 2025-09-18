/**
 * DuckDB Table Query Service Implementation
 * 
 * Infrastructure implementation for executing analytical queries against Apache Arrow files
 * stored in S3 using DuckDB's powerful analytical capabilities with zero-copy performance.
 * 
 * AIDEV-NOTE: Infrastructure implementation of TableQueryService using DuckDB for Arrow analytical queries
 */

import { DuckDBConnection } from '@duckdb/node-api';

import { BUCKET_NAME } from '@/src/lib/s3/client';

import type { Result } from '@/src/ddd/domain/shared/result';
import type { 
  TableQueryService, 
  QueryResult
} from '@/src/ddd/domain/tables/services/table-query-service';
import { TableId } from '@/src/ddd/domain/shared/value-objects';
import { S3TablePath } from '@/src/ddd/domain/tables/value-objects/s3-table-path';
import { DuckDB, eq, gt, gte, lt, lte, like, type QueryFilter } from './duckdb-sql-builder';

export class DuckDBTableQueryService implements TableQueryService {
  private connection: DuckDBConnection | null = null;
  private isInitialized = false;

  constructor() {
    // AIDEV-NOTE: Initialize DuckDB at construction time following the documentation example
    // https://duckdb.org/docs/stable/clients/nodejs/overview#inserting-data-via-arrow
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create DuckDB connection using new API
      this.connection = await DuckDBConnection.create();
      
      // Install extensions using new Promise-based API
      await this.connection.run("INSTALL arrow FROM community; LOAD arrow;");
      console.log('[DuckDB] Arrow extension loaded successfully');
      
      // Install httpfs for S3 access
      await this.connection.run("INSTALL httpfs; LOAD httpfs;");
      
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
        
        try {
          await this.connection.run(s3Config.join(' '));
          console.log('[DuckDB] S3 configuration applied');
        } catch (err) {
          console.warn('[DuckDB] Failed to configure S3:', err);
        }
      } else {
        this.isInitialized = true;
      }
      
      this.isInitialized = true;
      
      console.log('[DuckDB] Database initialized successfully');
      
    } catch (error) {
      console.error('[DuckDB] Failed to initialize database:', error);
      throw error;
    }
  }

  private async executeQuery(sql: string): Promise<Result<QueryResult>> {
    try {
      if (!this.connection || !this.isInitialized) {
        return { success: false, error: 'DuckDB not initialized' };
      }

      const startTime = Date.now();
      
      // Use new Promise-based API for queries
      const reader = await this.connection.runAndReadAll(sql);
      const executionTime = Date.now() - startTime;
      
      // Get rows from the reader
      const rows = reader.getRows();
      
      return {
        success: true,
        data: {
          rows: rows || [],
          rowCount: rows?.length || 0,
          executionTime
        }
      };
      
    } catch (error) {
      console.error('[DuckDB] Error executing query:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute query'
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
      const { db } = require('@/src/lib/db/client');
      const { tables } = require('@/src/lib/db/schema');
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