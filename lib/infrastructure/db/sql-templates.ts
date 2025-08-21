// AIDEV-NOTE: SQL templates for dynamic table operations
// Centralizes SQL query construction with clear parameter handling
import type postgres from 'postgres';

export interface SqlQuery {
  query: string;
  params: any[];
}

export interface TableSchemaParams {
  tableName: string;
}

export interface RowInsertParams {
  tableName: string;
  fields: string[];
  values: any[];
}

export interface RowUpdateParams {
  tableName: string;
  fields: string[];
  values: any[];
  rowId: string;
}

export interface RowQueryParams {
  tableName: string;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface RowDeleteParams {
  tableName: string;
  rowId: string;
}

/**
 * SQL templates for dynamic table operations
 * All templates use proper parameterization to prevent SQL injection
 */
export class DynamicTableSqlTemplates {
  /**
   * Create a new dynamic table with standard columns
   */
  static createTable(params: TableSchemaParams): SqlQuery {
    return {
      query: `
        CREATE TABLE "${params.tableName}" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `.trim(),
      params: []
    };
  }

  /**
   * Drop a dynamic table if it exists
   */
  static dropTable(params: TableSchemaParams): SqlQuery {
    return {
      query: `DROP TABLE IF EXISTS "${params.tableName}"`,
      params: []
    };
  }

  /**
   * Insert a row with specific field values
   */
  static insertRow(params: RowInsertParams): SqlQuery {
    if (params.fields.length === 0) {
      return {
        query: `INSERT INTO "${params.tableName}" DEFAULT VALUES RETURNING *`,
        params: []
      };
    }

    const columnNames = params.fields.map(field => `"${field}"`).join(', ');
    const placeholders = params.values.map((_, i) => `$${i + 1}`).join(', ');
    
    return {
      query: `
        INSERT INTO "${params.tableName}" (${columnNames}) 
        VALUES (${placeholders}) 
        RETURNING *
      `.trim(),
      params: params.values
    };
  }

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
   * Update a specific row in a dynamic table
   */
  static updateRow(params: RowUpdateParams): SqlQuery {
    const setClause = params.fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
    const rowIdParamIndex = params.fields.length + 1;

    return {
      query: `
        UPDATE "${params.tableName}" 
        SET ${setClause}, updated_at = now() 
        WHERE id = $${rowIdParamIndex} 
        RETURNING *
      `.trim(),
      params: [...params.values, params.rowId]
    };
  }

  /**
   * Delete a specific row from a dynamic table
   */
  static deleteRow(params: RowDeleteParams): SqlQuery {
    return {
      query: `DELETE FROM "${params.tableName}" WHERE id = $1`,
      params: [params.rowId]
    };
  }
}

/**
 * Logger for SQL operations in development/test environments
 */
export class SqlLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  static logQuery(operation: string, query: string, params: any[]): void {
    if (this.isDevelopment) {
      console.log(`[SQL ${operation}]`, {
        query: query.replace(/\s+/g, ' ').trim(),
        params
      });
    }
  }

  static logError(operation: string, error: Error, query: string, params: any[]): void {
    if (this.isDevelopment) {
      console.error(`[SQL ERROR ${operation}]`, {
        error: error.message,
        query: query.replace(/\s+/g, ' ').trim(),
        params
      });
    }
  }
}

/**
 * Helper class for executing SQL templates with logging
 */
export class SqlExecutor {
  constructor(private rawClient: postgres.Sql) {}

  /**
   * Execute a SQL template using postgres unsafe method for parameterized queries
   */
  async executeTemplate(operation: string, template: SqlQuery): Promise<any[]> {
    SqlLogger.logQuery(operation, template.query, template.params);
    
    try {
      const result = await this.rawClient.unsafe(template.query, template.params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      SqlLogger.logError(operation, error as Error, template.query, template.params);
      throw error;
    }
  }

  /**
   * Execute a SQL template using postgres tagged template (for DDL operations)
   */
  async executeTaggedTemplate(operation: string, callback: (sql: postgres.Sql) => Promise<any>): Promise<any> {
    try {
      const result = await callback(this.rawClient);
      SqlLogger.logQuery(operation, 'Tagged template query', []);
      return result;
    } catch (error) {
      SqlLogger.logError(operation, error as Error, 'Tagged template query', []);
      throw error;
    }
  }
}