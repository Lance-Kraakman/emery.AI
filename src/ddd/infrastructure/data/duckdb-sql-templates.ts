/**
 * DuckDB SQL Templates for Dynamic Table Operations
 *
 * Infrastructure layer SQL templates for DuckDB operations on Arrow files.
 * Each domain table maps 1:1 to a DuckDB virtual table backed by S3 Arrow file.
 *
 * Mapping:
 * - Domain: DynamicTable (id: 123, s3Path: "org_1/db_5/table_123/")
 * - S3: s3://bucket/org_1/db_5/table_123/data.arrow
 * - DuckDB: table_123 (virtual table pointing to S3 Arrow file)
 *
 * AIDEV-NOTE: DuckDB templates for analytical queries on Arrow-backed tables
 * Designed for big data analytics with complex operations
 */

import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field'

// ============================================
// TEMPLATE PARAMETER INTERFACES
// ============================================

export interface TableCreateParams {
  tableId: number
  s3Path: string  // Full S3 path including bucket
  fields: Array<{ name: string; type: FieldType; required: boolean }>
}

export interface RowInsertParams {
  tableId: number
  rowData: Record<string, any>
}

export interface RowUpdateParams {
  tableId: number
  rowId: string
  rowData: Record<string, any>
}

export interface RowDeleteParams {
  tableId: number
  rowId: string
}

export interface RowQueryParams {
  tableId: number
  filters?: Array<{ field: string; operator: string; value: any }>
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
}

export interface RowSelectByIdParams {
  tableId: number
  rowId: string
}

// ============================================
// SQL TEMPLATE CLASS
// ============================================

export class DuckDBSqlTemplates {

  // ==========================================
  // TABLE LIFECYCLE OPERATIONS
  // ==========================================

  /**
   * Create virtual table pointing to S3 Arrow file
   * This creates a 1:1 mapping: domain table → DuckDB virtual table → S3 file
   *
   * Example:
   * - Domain table id: 123
   * - Creates: table_123
   * - Points to: s3://bucket/org_1/db_5/table_123/data.arrow
   *
   * AIDEV-NOTE: Uses read_arrow (nanoarrow) instead of read_arrow_ipc
   * The community arrow extension (nanoarrow) uses read_arrow for IPC format
   */
  static createVirtualTable(params: TableCreateParams): string {
    const { tableId, s3Path } = params

    return `
      CREATE OR REPLACE TABLE table_${tableId} AS
      SELECT * FROM read_arrow('${s3Path}')
    `.trim()
  }

  /**
   * Drop virtual table (when domain table is deleted)
   */
  static dropVirtualTable(tableId: number): string {
    return `DROP TABLE IF EXISTS table_${tableId}`
  }

  /**
   * Refresh virtual table with latest S3 data
   * Called after writes to sync DuckDB view with S3
   *
   * AIDEV-NOTE: Uses read_arrow (nanoarrow) instead of read_arrow_ipc
   * The community arrow extension (nanoarrow) uses read_arrow for IPC format
   */
  static refreshVirtualTable(params: { tableId: number; s3Path: string }): string {
    const { tableId, s3Path } = params

    return `
      CREATE OR REPLACE TABLE table_${tableId} AS
      SELECT * FROM read_arrow('${s3Path}')
    `.trim()
  }

  // ==========================================
  // ROW CRUD OPERATIONS
  // ==========================================

  /**
   * Insert row into Arrow-backed table
   * DuckDB handles writing back to Arrow file
   */
  static insertRow(params: RowInsertParams): string {
    const { tableId, rowData } = params

    const columns = Object.keys(rowData)
    const values = Object.values(rowData).map(v => this.sqlValue(v))

    return `
      INSERT INTO table_${tableId} (${columns.join(', ')})
      VALUES (${values.join(', ')})
    `.trim()
  }

  /**
   * Bulk insert multiple rows
   * More efficient than individual inserts for big data
   */
  static bulkInsertRows(params: {
    tableId: number
    rows: Array<Record<string, any>>
  }): string {
    const { tableId, rows } = params

    if (rows.length === 0) return ''

    const columns = Object.keys(rows[0])
    const valueRows = rows.map(row => {
      const values = columns.map(col => this.sqlValue(row[col]))
      return `(${values.join(', ')})`
    })

    return `
      INSERT INTO table_${tableId} (${columns.join(', ')})
      VALUES ${valueRows.join(',\n       ')}
    `.trim()
  }

  /**
   * Update row in Arrow-backed table
   */
  static updateRow(params: RowUpdateParams): string {
    const { tableId, rowId, rowData } = params

    const setClause = Object.entries(rowData)
      .map(([key, val]) => `${key} = ${this.sqlValue(val)}`)
      .join(', ')

    return `
      UPDATE table_${tableId}
      SET ${setClause}
      WHERE id = ${this.sqlValue(rowId)}
    `.trim()
  }

  /**
   * Delete row from Arrow-backed table
   */
  static deleteRow(params: RowDeleteParams): string {
    const { tableId, rowId } = params

    return `
      DELETE FROM table_${tableId}
      WHERE id = ${this.sqlValue(rowId)}
    `.trim()
  }

  // ==========================================
  // ROW QUERY OPERATIONS (ANALYTICAL)
  // ==========================================

  /**
   * Select rows with filtering, sorting, pagination
   * Optimized for analytical queries on big data
   */
  static selectRows(params: RowQueryParams): string {
    const { tableId, filters, orderBy, orderDirection, limit, offset } = params

    let sql = `SELECT * FROM table_${tableId}`

    // WHERE clause
    if (filters && filters.length > 0) {
      const conditions = filters.map(f =>
        `${f.field} ${f.operator} ${this.sqlValue(f.value)}`
      )
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    // ORDER BY
    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${orderDirection || 'ASC'}`
    }

    // PAGINATION (efficient with DuckDB)
    if (limit !== undefined) {
      sql += ` LIMIT ${limit}`
    }
    if (offset !== undefined) {
      sql += ` OFFSET ${offset}`
    }

    return sql.trim()
  }

  /**
   * Select single row by ID
   */
  static selectRowById(params: RowSelectByIdParams): string {
    const { tableId, rowId } = params

    return `
      SELECT * FROM table_${tableId}
      WHERE id = ${this.sqlValue(rowId)}
      LIMIT 1
    `.trim()
  }

  /**
   * Count total rows with optional filters
   */
  static countRows(params: {
    tableId: number
    filters?: Array<{ field: string; operator: string; value: any }>
  }): string {
    const { tableId, filters } = params

    let sql = `SELECT COUNT(*) as count FROM table_${tableId}`

    if (filters && filters.length > 0) {
      const conditions = filters.map(f =>
        `${f.field} ${f.operator} ${this.sqlValue(f.value)}`
      )
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    return sql.trim()
  }

  /**
   * Check if table has any rows
   */
  static hasRows(tableId: number): string {
    return `
      SELECT EXISTS(SELECT 1 FROM table_${tableId} LIMIT 1) as has_rows
    `.trim()
  }

  // ==========================================
  // ANALYTICAL QUERIES (BIG DATA)
  // ==========================================

  /**
   * Aggregate query with grouping
   * For analytical workloads (reports, dashboards)
   */
  static aggregateQuery(params: {
    tableId: number
    groupBy: string[]
    aggregates: Array<{ field: string; function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' }>
    filters?: Array<{ field: string; operator: string; value: any }>
    orderBy?: string
    orderDirection?: 'ASC' | 'DESC'
    limit?: number
  }): string {
    const { tableId, groupBy, aggregates, filters, orderBy, orderDirection, limit } = params

    const selectParts = [
      ...groupBy,
      ...aggregates.map(agg => `${agg.function}(${agg.field}) as ${agg.field}_${agg.function.toLowerCase()}`)
    ]

    let sql = `SELECT ${selectParts.join(', ')} FROM table_${tableId}`

    if (filters && filters.length > 0) {
      const conditions = filters.map(f =>
        `${f.field} ${f.operator} ${this.sqlValue(f.value)}`
      )
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    if (groupBy.length > 0) {
      sql += ` GROUP BY ${groupBy.join(', ')}`
    }

    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${orderDirection || 'ASC'}`
    }

    if (limit) {
      sql += ` LIMIT ${limit}`
    }

    return sql.trim()
  }

  /**
   * Join two tables for analytical queries
   */
  static joinTables(params: {
    leftTableId: number
    rightTableId: number
    joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
    onCondition: string
    selectColumns?: string[]
    filters?: Array<{ field: string; operator: string; value: any }>
    limit?: number
  }): string {
    const { leftTableId, rightTableId, joinType, onCondition, selectColumns, filters, limit } = params

    const columns = selectColumns ? selectColumns.join(', ') : '*'

    let sql = `
      SELECT ${columns}
      FROM table_${leftTableId} AS t1
      ${joinType} JOIN table_${rightTableId} AS t2
      ON ${onCondition}
    `.trim()

    if (filters && filters.length > 0) {
      const conditions = filters.map(f =>
        `${f.field} ${f.operator} ${this.sqlValue(f.value)}`
      )
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    if (limit) {
      sql += ` LIMIT ${limit}`
    }

    return sql
  }

  // ==========================================
  // TABLE STATISTICS
  // ==========================================

  /**
   * Get table statistics for analytics
   */
  static getTableStats(tableId: number): string {
    return `
      SELECT
        COUNT(*) as row_count,
        COUNT(DISTINCT id) as unique_ids,
        MIN(created_at) as first_created,
        MAX(updated_at) as last_updated
      FROM table_${tableId}
    `.trim()
  }

  /**
   * Get distinct values for a field (for filters/facets)
   */
  static getDistinctValues(params: {
    tableId: number
    field: string
    limit?: number
  }): string {
    const { tableId, field, limit } = params

    let sql = `
      SELECT DISTINCT ${field}, COUNT(*) as count
      FROM table_${tableId}
      WHERE ${field} IS NOT NULL
      GROUP BY ${field}
      ORDER BY count DESC
    `.trim()

    if (limit) {
      sql += ` LIMIT ${limit}`
    }

    return sql
  }

  // ==========================================
  // TRANSACTION OPERATIONS
  // ==========================================

  static beginTransaction(): string {
    return 'BEGIN TRANSACTION'
  }

  static commitTransaction(): string {
    return 'COMMIT'
  }

  static rollbackTransaction(): string {
    return 'ROLLBACK'
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Convert JavaScript value to SQL literal
   * Handles all field types with proper escaping
   */
  private static sqlValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    }

    if (typeof value === 'number') {
      return String(value)
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'::TIMESTAMP`
    }

    if (Array.isArray(value)) {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::JSON`
    }

    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::JSON`
    }

    return `'${String(value).replace(/'/g, "''")}'`
  }

  /**
   * Escape identifier (column name)
   */
  static escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
  }
}

// ============================================
// SQL LOGGER
// ============================================

export class DuckDBSqlLogger {
  private static isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

  static logQuery(operation: string, sql: string): void {
    if (this.isDevelopment) {
      console.log(`[DuckDB SQL] 🔍 ${operation}:`, {
        sql: sql.replace(/\s+/g, ' ').trim()
      })
    }
  }

  static logError(operation: string, error: Error, sql: string): void {
    console.error(`[DuckDB SQL] ❌ ${operation} FAILED:`, {
      error: error.message,
      sql: sql.replace(/\s+/g, ' ').trim()
    })
  }
}

// ============================================
// SQL EXECUTOR
// ============================================

import type { DuckDBConnection } from '@duckdb/node-api'

/**
 * Executes DuckDB SQL templates with logging using @duckdb/node-api
 * Part of infrastructure layer - handles DuckDB connection with promise-based interface
 */
export class DuckDBSqlExecutor {
  constructor(private duckdb: DuckDBConnection) {}

  /**
   * Execute query and return rows using promise-based API
   */
  async execute(operation: string, sql: string): Promise<any[]> {
    DuckDBSqlLogger.logQuery(operation, sql)

    try {
      const result = await this.duckdb.run(sql)
      const rows = await result.getRows()
      return rows || []
    } catch (err) {
      DuckDBSqlLogger.logError(operation, err as Error, sql)
      throw err
    }
  }

  /**
   * Execute non-query statement (INSERT, UPDATE, DELETE, CREATE, etc.)
   */
  async executeNonQuery(operation: string, sql: string): Promise<void> {
    DuckDBSqlLogger.logQuery(operation, sql)

    try {
      await this.duckdb.run(sql)
    } catch (err) {
      DuckDBSqlLogger.logError(operation, err as Error, sql)
      throw err
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  async executeTransaction(operation: string, statements: string[]): Promise<void> {
    try {
      await this.executeNonQuery('BEGIN', DuckDBSqlTemplates.beginTransaction())

      for (const sql of statements) {
        await this.executeNonQuery(operation, sql)
      }

      await this.executeNonQuery('COMMIT', DuckDBSqlTemplates.commitTransaction())
    } catch (error) {
      await this.executeNonQuery('ROLLBACK', DuckDBSqlTemplates.rollbackTransaction())
      throw error
    }
  }
}
