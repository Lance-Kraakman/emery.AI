/**
 * DuckDB SQL Query Builder
 * 
 * Provides a type-safe, fluent API for building DuckDB SQL queries similar to Drizzle ORM.
 * Focuses on Arrow file queries with support for filtering, sorting, and pagination.
 * 
 * AIDEV-NOTE: Type-safe SQL builder for DuckDB queries similar to Drizzle's approach
 */

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'isNull' | 'isNotNull';
  value?: any;
  values?: any[];
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export class DuckDBQueryBuilder {
  private readonly s3Url: string;
  private selectColumns: string[] = ['*'];
  private whereConditions: string[] = [];
  private orderByClause?: string;
  private limitClause?: string;
  private offsetClause?: string;

  constructor(s3Url: string) {
    this.s3Url = s3Url;
  }

  /**
   * Select specific columns
   */
  select(columns: string[]): DuckDBQueryBuilder {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Add WHERE conditions
   */
  where(filter: QueryFilter): DuckDBQueryBuilder {
    const condition = this.buildWhereCondition(filter);
    if (condition) {
      this.whereConditions.push(condition);
    }
    return this;
  }

  /**
   * Add multiple WHERE conditions
   */
  whereMany(filters: QueryFilter[]): DuckDBQueryBuilder {
    filters.forEach(filter => this.where(filter));
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): DuckDBQueryBuilder {
    this.orderByClause = `ORDER BY ${this.escapeIdentifier(field)} ${direction}`;
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(count: number): DuckDBQueryBuilder {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(count: number): DuckDBQueryBuilder {
    this.offsetClause = `OFFSET ${count}`;
    return this;
  }

  /**
   * Apply query options all at once
   */
  applyOptions(options?: QueryOptions): DuckDBQueryBuilder {
    if (!options) return this;

    if (options.filters) {
      this.whereMany(options.filters);
    }

    if (options.orderBy) {
      this.orderBy(options.orderBy, options.orderDirection);
    }

    if (options.limit !== undefined) {
      this.limit(options.limit);
    }

    if (options.offset !== undefined) {
      this.offset(options.offset);
    }

    return this;
  }

  /**
   * Build the final SQL query
   */
  build(): string {
    const parts: string[] = [];

    // SELECT clause
    parts.push(`SELECT ${this.selectColumns.join(', ')}`);

    // FROM clause with Arrow IPC reader
    parts.push(`FROM read_arrow_ipc('${this.s3Url}')`);

    // WHERE clause
    if (this.whereConditions.length > 0) {
      parts.push(`WHERE ${this.whereConditions.join(' AND ')}`);
    }

    // ORDER BY clause
    if (this.orderByClause) {
      parts.push(this.orderByClause);
    }

    // LIMIT clause
    if (this.limitClause) {
      parts.push(this.limitClause);
    }

    // OFFSET clause
    if (this.offsetClause) {
      parts.push(this.offsetClause);
    }

    return parts.join(' ');
  }

  /**
   * Build WHERE condition for a single filter
   */
  private buildWhereCondition(filter: QueryFilter): string | null {
    const field = this.escapeIdentifier(filter.field);

    switch (filter.operator) {
      case 'eq':
        return `${field} = ${this.escapeValue(filter.value)}`;
      
      case 'ne':
        return `${field} != ${this.escapeValue(filter.value)}`;
      
      case 'gt':
        return `${field} > ${this.escapeValue(filter.value)}`;
      
      case 'gte':
        return `${field} >= ${this.escapeValue(filter.value)}`;
      
      case 'lt':
        return `${field} < ${this.escapeValue(filter.value)}`;
      
      case 'lte':
        return `${field} <= ${this.escapeValue(filter.value)}`;
      
      case 'like':
        return `${field} LIKE ${this.escapeValue(filter.value)}`;
      
      case 'in':
        if (!filter.values || filter.values.length === 0) return null;
        const inValues = filter.values.map(v => this.escapeValue(v)).join(', ');
        return `${field} IN (${inValues})`;
      
      case 'isNull':
        return `${field} IS NULL`;
      
      case 'isNotNull':
        return `${field} IS NOT NULL`;
      
      default:
        console.warn(`[DuckDBQueryBuilder] Unknown operator: ${filter.operator}`);
        return null;
    }
  }

  /**
   * Escape SQL identifiers (column names, table names)
   */
  private escapeIdentifier(identifier: string): string {
    // Replace quotes and wrap in double quotes
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Escape and quote SQL values
   */
  private escapeValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      // Escape single quotes by doubling them
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    // For other types, stringify and treat as string
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}

/**
 * Static factory methods for common query patterns
 */
export class DuckDB {
  /**
   * Create a new query builder for an Arrow file
   */
  static query(s3Url: string): DuckDBQueryBuilder {
    return new DuckDBQueryBuilder(s3Url);
  }

  /**
   * Build a simple SELECT query with options
   */
  static select(s3Url: string, options?: QueryOptions): string {
    return new DuckDBQueryBuilder(s3Url)
      .applyOptions(options)
      .build();
  }

  /**
   * Build a COUNT query
   */
  static count(s3Url: string, filters?: QueryFilter[]): string {
    const builder = new DuckDBQueryBuilder(s3Url).select(['COUNT(*) as count']);
    
    if (filters) {
      builder.whereMany(filters);
    }
    
    return builder.build();
  }

  /**
   * Build a query to get distinct values for a field
   */
  static distinct(s3Url: string, field: string, filters?: QueryFilter[]): string {
    const builder = new DuckDBQueryBuilder(s3Url)
      .select([`DISTINCT ${field}`])
      .orderBy(field);
    
    if (filters) {
      builder.whereMany(filters);
    }
    
    return builder.build();
  }
}

// Type-safe filter builders (similar to Drizzle's approach)
export const eq = (field: string, value: any): QueryFilter => ({
  field,
  operator: 'eq',
  value
});

export const ne = (field: string, value: any): QueryFilter => ({
  field,
  operator: 'ne',
  value
});

export const gt = (field: string, value: any): QueryFilter => ({
  field,
  operator: 'gt',
  value
});

export const gte = (field: string, value: any): QueryFilter => ({
  field,
  operator: 'gte',
  value
});

export const lt = (field: string, value: any): QueryFilter => ({
  field,
  operator: 'lt',
  value
});

export const lte = (field: string, value: any): QueryFilter => ({
  field,
  operator: 'lte',
  value
});

export const like = (field: string, pattern: string): QueryFilter => ({
  field,
  operator: 'like',
  value: pattern
});

export const inArray = (field: string, values: any[]): QueryFilter => ({
  field,
  operator: 'in',
  values
});

export const isNull = (field: string): QueryFilter => ({
  field,
  operator: 'isNull'
});

export const isNotNull = (field: string): QueryFilter => ({
  field,
  operator: 'isNotNull'
});

// Example usage:
/*
import { DuckDB, eq, gt, like } from './duckdb-sql-builder';

// Simple query
const sql1 = DuckDB.select('s3://bucket/table.arrow', {
  filters: [eq('status', 'active'), gt('price', 100)],
  orderBy: 'created_at',
  orderDirection: 'DESC',
  limit: 50
});

// Fluent API
const sql2 = DuckDB.query('s3://bucket/table.arrow')
  .select(['id', 'name', 'price'])
  .where(eq('category', 'electronics'))
  .where(gt('price', 50))
  .orderBy('price', 'DESC')
  .limit(25)
  .offset(10)
  .build();

// Count query
const countSql = DuckDB.count('s3://bucket/table.arrow', [
  eq('status', 'active')
]);
*/