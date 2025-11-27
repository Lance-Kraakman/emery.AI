// AIDEV-NOTE: Pagination Value Objects for Connection queries
// Encapsulates pagination logic with cursor-based navigation

/**
 * Cursor-based pagination options for connection queries
 */
export interface ConnectionPaginationOptions {
  readonly limit: number;
  readonly after?: string;   // Cursor for next page
  readonly before?: string;  // Cursor for previous page (future use)
}

/**
 * Paginated result with cursor information
 * Generic type allows reuse across different entity types
 */
export interface PaginatedResult<T> {
  readonly data: T[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
  readonly totalCount?: number; // Optional - Pipedream may not always provide this
}

/**
 * Creates default pagination options
 */
export function createDefaultPaginationOptions(limit: number = 50): ConnectionPaginationOptions {
  return { limit };
}

/**
 * Type guard to check if pagination options are valid
 */
export function isValidPaginationOptions(opts: Partial<ConnectionPaginationOptions>): opts is ConnectionPaginationOptions {
  return (
    typeof opts.limit === 'number' &&
    opts.limit > 0 &&
    opts.limit <= 100 && // Max limit
    (!opts.after || typeof opts.after === 'string') &&
    (!opts.before || typeof opts.before === 'string')
  );
}
