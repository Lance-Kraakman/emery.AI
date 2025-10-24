/**
 * Query key factory for data table queries
 *
 * Centralizes all query key definitions for type safety and consistency.
 * Follows TanStack Query's recommended factory pattern.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys#use-query-key-factories
 */

import type { FilterConfig } from "@/app/(app)/data/components/FilterPopover"

/**
 * Sort state for query keys
 * Matches the store's sortBy type where field is optional
 */
export interface SortState {
  field?: string
  order: 'asc' | 'desc'
}

/**
 * Query key factory for row-related queries
 *
 * Structure:
 * - ['rows', tableId] - All queries for a table
 * - ['rows', tableId, 'infinite', ...] - Infinite scroll queries
 * - ['rows', tableId, 'search', ...] - Search queries
 * - ['rows', tableId, 'detail', rowId] - Single row queries
 */
export const rowQueryKeys = {
  /**
   * Base key for all row queries for a table
   */
  all: (tableId: number) => ['rows', tableId] as const,

  /**
   * Infinite scroll query with sort and filter dependencies
   * Used by useInfiniteQuery for paginated data
   */
  infinite: (tableId: number, sortBy: SortState, filters: FilterConfig[]) =>
    ['rows', tableId, 'infinite', sortBy, filters] as const,

  /**
   * Search query key with search term dependency
   * Used by useQuery for search results
   */
  search: (tableId: number, searchTerm: string) =>
    ['rows', tableId, 'search', searchTerm] as const,

  /**
   * Single row detail query
   * Used by useQuery for fetching individual rows
   */
  detail: (tableId: number, rowId: string) =>
    ['rows', tableId, 'detail', rowId] as const,
}

/**
 * Query key factory for field-related queries
 */
export const fieldQueryKeys = {
  /**
   * All fields for a table
   */
  all: (tableId: number) => ['fields', tableId] as const,

  /**
   * Single field detail
   */
  detail: (tableId: number, fieldId: number) =>
    ['fields', tableId, 'detail', fieldId] as const,
}

/**
 * Utility function to invalidate all queries for a table
 * Useful for refreshing after mutations that affect multiple query types
 */
export const invalidateTableQueries = (queryClient: any, tableId: number) => {
  queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(tableId) })
  queryClient.invalidateQueries({ queryKey: fieldQueryKeys.all(tableId) })
}
