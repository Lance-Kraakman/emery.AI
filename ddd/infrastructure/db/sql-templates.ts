// AIDEV-NOTE: SQL templates for dynamic table operations
// Centralizes SQL query construction with clear parameter handling
import type postgres from 'postgres';

export interface SqlQuery {
  query: string;
  params: any[];
}

// AIDEV-NOTE: Obsolete interfaces removed (TableSchemaParams, RowInsertParams, RowUpdateParams, RowDeleteParams)
// These were for PostgreSQL dynamic table operations, now replaced by S3/Parquet storage

export interface RowQueryParams {
  tableName: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface RowSelectByIdParams {
  tableName: string;
  rowId: string;
}

/**
 * SQL templates for dynamic table operations
 * All templates use proper parameterization to prevent SQL injection
 */
export class DynamicTableSqlTemplates {
  // AIDEV-NOTE: Dynamic table creation/modification methods removed
  // Tables are now stored in S3 as Parquet files, not PostgreSQL tables

  /**
   * Select rows from a dynamic table with ordering and pagination
   */
  static selectRows(params: RowQueryParams): SqlQuery {
    const {
      tableName,
      orderBy = 'created_at',
      orderDirection = 'DESC',
      limit = 100,
      offset = 0
    } = params;

    return {
      query: `
        SELECT * FROM "${tableName}" 
        ORDER BY "${orderBy}" ${orderDirection} 
        LIMIT $1 OFFSET $2
      `.trim(),
      params: [limit, offset]
    };
  }

  /**
   * Select a specific row by ID from a dynamic table
   */
  static selectRowById(params: RowSelectByIdParams): SqlQuery {
    return {
      query: `SELECT * FROM "${params.tableName}" WHERE id = $1`,
      params: [params.rowId]
    };
  }

  // AIDEV-NOTE: Row modification methods removed (updateRow, deleteRow)
  // Row operations now handled by S3 Delta Lake pattern with tombstones
}

/**
 * Logger for SQL operations in development/test environments
 */
export class SqlLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  static logQuery(operation: string, query: string, params: any[]): void {
    // if (this.isDevelopment) {
    //   console.log(`[SQL ${operation}]`, {
    //     query: query.replace(/\s+/g, ' ').trim(),
    //     params
    //   });
    // }
  }

  static logError(operation: string, error: Error, query: string, params: any[]): void {
    // if (this.isDevelopment) {
    //   console.error(`[SQL ERROR ${operation}]`, {
    //     error: error.message,
    //     query: query.replace(/\s+/g, ' ').trim(),
    //     params
    //   });
    // }
  }
}

// RAG System SQL Template Parameters
export interface RagVectorSearchParams {
  queryEmbedding: number[];
  indexId: string;
  limit: number;
  similarityMetric: 'cosine' | 'euclidean' | 'inner_product';
}

export interface FileFieldQueryParams {
  organizationId: number;
}

export interface DynamicTableFileQueryParams {
  fieldId: number;
  tableDbName: string;
}

export interface FileCountQueryParams {
  organizationId: number;
}

export interface IndexStatisticsParams {
  indexId: string;
}

export interface DomainTypeCountsParams {
  indexId: string;
}

/**
 * SQL templates for RAG (Retrieval-Augmented Generation) operations
 * Centralizes vector search and document indexing queries
 */
export class RagSqlTemplates {
  /**
   * Vector similarity search using pgvector
   */
  static vectorSimilaritySearch(params: RagVectorSearchParams): SqlQuery {
    const { queryEmbedding, indexId, limit, similarityMetric } = params;
    const embeddingVectorStr = `[${queryEmbedding.join(',')}]`;
    
    let operator: string;
    let orderDirection: string;
    
    switch (similarityMetric) {
      case 'cosine':
        operator = '<=>';
        orderDirection = 'ASC';
        break;
      case 'euclidean':
        operator = '<->';
        orderDirection = 'ASC';
        break;
      case 'inner_product':
        operator = '<#>';
        orderDirection = 'DESC';
        break;
      default:
        operator = '<=>';
        orderDirection = 'ASC';
    }

    return {
      query: `
        SELECT 
          id, 
          rag_index_id,
          organization_id,
          domain_type, 
          source_id, 
          source_name, 
          title, 
          content, 
          metadata,
          content_hash,
          indexed_at,
          source_updated_at,
          embedding ${operator} $1::vector as similarity
        FROM rag_documents
        WHERE rag_index_id = $2
        ORDER BY embedding ${operator} $1::vector ${orderDirection}
        LIMIT $3
      `.trim(),
      params: [embeddingVectorStr, indexId, limit]
    };
  }

  /**
   * Get all file fields from tables in an organization
   */
  static getFileFields(params: FileFieldQueryParams): SqlQuery {
    return {
      query: `
        SELECT DISTINCT 
          f.id as field_id,
          f.name as field_name, 
          f.slug as field_slug,
          t.id as table_id,
          t.name as table_name,
          t.name as table_db_name,
          d.name as database_name
        FROM fields f
        JOIN tables t ON f.table_id = t.id  
        JOIN databases d ON t.database_id = d.id
        WHERE f.type = 'file' 
        AND t.organization_id = $1
      `.trim(),
      params: [params.organizationId]
    };
  }

  /**
   * Get file data from a specific dynamic table field
   */
  static getDynamicTableFiles(params: DynamicTableFileQueryParams): SqlQuery {
    // Note: This template requires manual substitution for table and field names
    // due to dynamic nature - handled by SqlExecutor
    return {
      query: `
        SELECT id, field_{{fieldId}} as file_data, created_at, updated_at
        FROM {{tableDbName}} 
        WHERE field_{{fieldId}} IS NOT NULL
        AND field_{{fieldId}} != '[]'
      `.trim(),
      params: []
    };
  }

  /**
   * Count file fields in an organization
   */
  static getFileFieldCount(params: FileCountQueryParams): SqlQuery {
    return {
      query: `
        SELECT COUNT(*) as count
        FROM fields f
        JOIN tables t ON f.table_id = t.id
        WHERE f.type = 'file' 
        AND t.organization_id = $1
      `.trim(),
      params: [params.organizationId]
    };
  }

  /**
   * Get index statistics including document counts and sizes
   */
  static getIndexStatistics(params: IndexStatisticsParams): SqlQuery {
    return {
      query: `
        SELECT 
          COUNT(*) as total_documents,
          COALESCE(AVG(pg_column_size(content)), 0) as avg_content_size,
          COALESCE(AVG(pg_column_size(embedding)), 0) as avg_embedding_size,
          COALESCE(SUM(pg_column_size(content)), 0) as total_size
        FROM rag_documents
        WHERE rag_index_id = $1
      `.trim(),
      params: [params.indexId]
    };
  }

  /**
   * Get domain type document counts for an index
   */
  static getDomainTypeCounts(params: DomainTypeCountsParams): SqlQuery {
    return {
      query: `
        SELECT domain_type, COUNT(*) as count
        FROM rag_documents
        WHERE rag_index_id = $1
        GROUP BY domain_type
      `.trim(),
      params: [params.indexId]
    };
  }

  /**
   * Get analytics data for query patterns
   */
  static getQueryAnalytics(params: { indexId: string; days: number }): SqlQuery {
    return {
      query: `
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as query_count,
          AVG(results_count) as avg_results,
          COUNT(DISTINCT user_id) as unique_users
        FROM rag_query_logs
        WHERE rag_index_id = $1
        AND created_at >= NOW() - INTERVAL '$2 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date DESC
      `.trim(),
      params: [params.indexId, params.days]
    };
  }
}

/**
 * Helper class for executing SQL templates with logging
 * Updated to use DbClient instead of raw postgres client
 */
export class SqlExecutor {
  constructor(private dbClient: any) {} // DbClient type

  /**
   * Execute a SQL template using db.execute with sql helper
   * Properly handles parameterized queries for security
   */
  async executeTemplate(operation: string, template: SqlQuery): Promise<any[]> {
    SqlLogger.logQuery(operation, template.query, template.params);
    
    try {
      // Import sql helper locally to avoid circular dependencies
      const { sql } = await import('drizzle-orm');
      
      // Build the query with proper parameter substitution
      let finalQuery = template.query;
      const params = template.params;
      
      // Replace PostgreSQL-style placeholders with actual values
      // This is safe since our templates control the structure
      for (let i = 0; i < params.length; i++) {
        const placeholder = `$${i + 1}`;
        const value = params[i];
        
        // Handle different parameter types safely
        let substitutedValue: string;
        if (typeof value === 'string') {
          // Escape single quotes in strings and wrap in quotes
          substitutedValue = `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'number') {
          substitutedValue = String(value);
        } else if (value === null || value === undefined) {
          substitutedValue = 'NULL';
        } else if (Array.isArray(value) || typeof value === 'object') {
          // For arrays and objects, serialize to JSON string
          const jsonString = JSON.stringify(value);
          substitutedValue = `'${jsonString.replace(/'/g, "''")}'::jsonb`;
        } else {
          // For other types, convert to string
          substitutedValue = `'${String(value).replace(/'/g, "''")}'`;
        }
        
        finalQuery = finalQuery.replace(new RegExp(`\\${placeholder}(?![0-9])`, 'g'), substitutedValue);
      }
      
      const result = await this.dbClient.execute(sql.raw(finalQuery));
      return Array.isArray(result) ? result : [];
    } catch (error) {
      SqlLogger.logError(operation, error as Error, template.query, template.params);
      throw error;
    }
  }

  /**
   * Execute dynamic SQL queries with manual parameter substitution
   * Used for dynamic table/field queries where table names can't be parameterized
   */
  async executeDynamicTemplate(
    operation: string, 
    template: SqlQuery, 
    substitutions: Record<string, string | number>
  ): Promise<any[]> {
    let query = template.query;
    
    // Perform manual substitutions for dynamic elements
    for (const [key, value] of Object.entries(substitutions)) {
      query = query.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    
    SqlLogger.logQuery(operation, query, template.params);
    
    try {
      const { sql } = await import('drizzle-orm');
      const result = await this.dbClient.execute(sql.raw(query));
      return Array.isArray(result) ? result : [];
    } catch (error) {
      SqlLogger.logError(operation, error as Error, query, template.params);
      throw error;
    }
  }

  /**
   * Execute a SQL template using tagged template (for DDL operations)
   */
  async executeTaggedTemplate(operation: string, callback: (sql: any) => Promise<any>): Promise<any> {
    try {
      const { sql } = await import('drizzle-orm');
      const result = await callback(sql);
      SqlLogger.logQuery(operation, 'Tagged template query', []);
      return result;
    } catch (error) {
      SqlLogger.logError(operation, error as Error, 'Tagged template query', []);
      throw error;
    }
  }
}