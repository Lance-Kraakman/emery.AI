/**
 * GridContext - Centralized state management for DynamicDataSheetGrid
 *
 * Eliminates prop drilling by providing grid state and actions through React Context.
 * All child components can access grid state using the useGrid() hook.
 *
 * Benefits:
 * - No more passing 20+ props through component tree
 * - Type-safe access to grid state
 * - Easy to extend with new features
 * - Clear separation of concerns
 * - Follows React best practices
 */

"use client"

import { createContext, useContext } from 'react'
import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { DSGRow } from '@/app/mappers/dsg-mapper'
import type { FieldValue as DomainFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import type { FilterConfig } from '../FilterPopover'

/**
 * Grid context value containing all grid state and actions
 */
export interface GridContextValue {
  // Table metadata
  tableName: string
  tableId: number
  organizationId: number

  // Data state
  fields: FieldDTO[]
  rows: DSGRow[]
  totalCount: number
  isLoading: boolean
  error: string | null

  // Search
  searchTerm: string
  onSearchChange: (value: string) => void

  // Filters
  activeFilters: FilterConfig[]
  onAddFilter: (filter: FilterConfig) => void
  onRemoveFilter: (index: number) => void
  onClearFilters: () => void

  // Sort
  sortState: { field?: string, order: 'asc' | 'desc' }
  onSort: (field: string, direction: 'asc' | 'desc') => void
  onClearSort: () => void

  // Actions
  onManageFields: () => void
  onRefresh: () => void
  onUpdateRow: (rowId: string, fieldId: number, value: DomainFieldValue) => Promise<any>
  onAddRows: (rows: Record<string, any>[]) => Promise<void>
  onDeleteRow: (rowId: string) => void
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
}

/**
 * Grid context - provides access to grid state throughout the component tree
 */
export const GridContext = createContext<GridContextValue | null>(null)

/**
 * Hook to access grid context
 *
 * @throws Error if used outside of GridContext.Provider
 * @returns GridContextValue with all grid state and actions
 *
 * @example
 * ```typescript
 * function GridHeaderBar() {
 *   const { tableName, rowCount, onRefresh } = useGrid()
 *   return <div>{tableName} - {rowCount} rows</div>
 * }
 * ```
 */
export function useGrid(): GridContextValue {
  const context = useContext(GridContext)

  if (!context) {
    throw new Error(
      'useGrid must be used within a GridContext.Provider. ' +
      'Make sure your component is wrapped with <GridContext.Provider value={gridValue}>.'
    )
  }

  return context
}
