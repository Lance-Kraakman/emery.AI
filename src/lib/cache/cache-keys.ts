/**
 * Cache Key Definitions
 *
 * Centralized cache key definitions with TTL and tag configurations.
 * Tags enable grouped invalidation when related data changes.
 */

export interface CacheKeyConfig {
  key: string;
  /** TTL in seconds */
  ttl: number;
  /** Tags for grouped invalidation */
  tags: string[];
}

/**
 * Cache key factory functions.
 * Each function returns a config with key, TTL, and tags.
 */
export const CACHE_KEYS = {
  /**
   * Table metadata - changes infrequently
   * Invalidate on: table update, table delete
   */
  tableMetadata: (tableId: number): CacheKeyConfig => ({
    key: `table:${tableId}:metadata`,
    ttl: 300, // 5 minutes
    tags: [`table:${tableId}`, 'tables'],
  }),

  /**
   * Fields for a table - changes when schema modified
   * Invalidate on: field create, field update, field delete
   */
  tableFields: (tableId: number): CacheKeyConfig => ({
    key: `table:${tableId}:fields`,
    ttl: 300, // 5 minutes
    tags: [`table:${tableId}`, `table:${tableId}:fields`, 'fields'],
  }),

  /**
   * Table statistics (row count) - changes on row mutations
   * Invalidate on: row create, row update, row delete
   */
  tableStats: (tableId: number): CacheKeyConfig => ({
    key: `table:${tableId}:stats`,
    ttl: 60, // 1 minute (more volatile)
    tags: [`table:${tableId}`, `table:${tableId}:stats`, 'stats'],
  }),

  /**
   * View configuration - changes when view settings modified
   * Invalidate on: view update, view delete
   */
  viewConfig: (viewId: number): CacheKeyConfig => ({
    key: `view:${viewId}:config`,
    ttl: 300, // 5 minutes
    tags: [`view:${viewId}`, 'views'],
  }),

  /**
   * View aggregation results - expensive to compute
   * Invalidate on: row mutations (for underlying table), view config changes
   */
  viewAggregations: (viewId: number, tableId: number): CacheKeyConfig => ({
    key: `view:${viewId}:aggregations`,
    ttl: 300, // 5 minutes
    tags: [`view:${viewId}`, `table:${tableId}`, `table:${tableId}:stats`, 'aggregations'],
  }),

  /**
   * View execution results (paginated rows)
   * Invalidate on: row mutations, view config changes, filter changes
   */
  viewResults: (viewId: number, tableId: number, page: number, pageSize: number): CacheKeyConfig => ({
    key: `view:${viewId}:results:${page}:${pageSize}`,
    ttl: 120, // 2 minutes (data changes more frequently)
    tags: [`view:${viewId}`, `table:${tableId}`, `table:${tableId}:stats`],
  }),

  /**
   * Tables for an organization - changes when tables added/removed
   * Invalidate on: table create, table delete
   */
  orgTables: (orgId: number): CacheKeyConfig => ({
    key: `org:${orgId}:tables`,
    ttl: 300, // 5 minutes
    tags: [`org:${orgId}`, `org:${orgId}:tables`, 'tables'],
  }),

  /**
   * Views for an organization
   * Invalidate on: view create, view delete
   */
  orgViews: (orgId: number): CacheKeyConfig => ({
    key: `org:${orgId}:views`,
    ttl: 300, // 5 minutes
    tags: [`org:${orgId}`, `org:${orgId}:views`, 'views'],
  }),

  /**
   * Views for a specific table
   * Invalidate on: view create/delete for this table
   */
  tableViews: (tableId: number): CacheKeyConfig => ({
    key: `table:${tableId}:views`,
    ttl: 300, // 5 minutes
    tags: [`table:${tableId}`, `table:${tableId}:views`, 'views'],
  }),

  /**
   * Files for an organization - expensive 10k row scan
   * Invalidate on: file upload, row deletion with files
   */
  orgFiles: (orgId: number): CacheKeyConfig => ({
    key: `org:${orgId}:files`,
    ttl: 600, // 10 minutes (expensive operation, low change frequency)
    tags: [`org:${orgId}`, `org:${orgId}:files`, 'files'],
  }),

  /**
   * Chart view data
   * Invalidate on: row mutations, view config changes
   */
  chartViewData: (viewId: number, tableId: number): CacheKeyConfig => ({
    key: `view:${viewId}:chart`,
    ttl: 300, // 5 minutes
    tags: [`view:${viewId}`, `table:${tableId}`, `table:${tableId}:stats`, 'charts'],
  }),
};

/**
 * Cache invalidation tags.
 * Use these for grouped invalidation of related cache entries.
 */
export const CACHE_TAGS = {
  // Entity-specific tags
  table: (tableId: number) => `table:${tableId}`,
  tableFields: (tableId: number) => `table:${tableId}:fields`,
  tableStats: (tableId: number) => `table:${tableId}:stats`,
  tableViews: (tableId: number) => `table:${tableId}:views`,
  view: (viewId: number) => `view:${viewId}`,
  org: (orgId: number) => `org:${orgId}`,
  orgTables: (orgId: number) => `org:${orgId}:tables`,
  orgViews: (orgId: number) => `org:${orgId}:views`,
  orgFiles: (orgId: number) => `org:${orgId}:files`,

  // Global category tags
  allTables: 'tables',
  allViews: 'views',
  allFields: 'fields',
  allStats: 'stats',
  allAggregations: 'aggregations',
  allCharts: 'charts',
  allFiles: 'files',
};
