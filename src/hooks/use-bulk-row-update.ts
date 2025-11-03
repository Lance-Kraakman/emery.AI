import { useRef, useEffect, useCallback } from 'react'
import { useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import debounce from 'lodash/debounce'
import { rowQueryKeys } from '@/lib/query-keys/rows'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { FieldValue as DomainFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import type { FilterConfig } from '@/lib/types/filters'
import type { DSGRow } from '@/app/mappers/dsg-mapper'

const logger = createDebugLogger('useBulkRowUpdate')

/**
 * Parameters for useBulkRowUpdate hook
 */
export interface UseBulkRowUpdateParams {
  /** Array of table fields for field ID to name conversion */
  fields: FieldDTO[]
  /** TanStack mutation for bulk row updates */
  bulkUpdateMutation: UseMutationResult<
    any,
    Error,
    Array<{ rowId: string; data: Record<string, any> }>,
    unknown
  >
  /** Currently selected table ID */
  selectedTableId: number | undefined
  /** Current sort configuration */
  sortBy: { field?: string; order?: 'asc' | 'desc' }
  /** Active filter configurations */
  activeFilters: FilterConfig[]
  /** Debounce delay in milliseconds (default: 500ms) */
  debounceMs?: number
}

/**
 * Custom hook for bulk row update batching with debouncing
 * 
 * AIDEV-NOTE: This hook manages table-level batching of row updates
 * - Collects rapid cell changes across the entire table
 * - Debounces updates to reduce database load and eliminate race conditions
 * - Performs optimistic UI updates for instant user feedback
 * - Sends all pending changes in a single bulk API call
 * 
 * @example
 * ```tsx
 * const { handleUpdateRow } = useBulkRowUpdate({
 *   fields,
 *   bulkUpdateMutation,
 *   selectedTableId,
 *   sortBy,
 *   activeFilters
 * })
 * 
 * // In grid cell change handler:
 * await handleUpdateRow(rowId, fieldId, newValue)
 * ```
 */
export function useBulkRowUpdate({
  fields,
  bulkUpdateMutation,
  selectedTableId,
  sortBy,
  activeFilters,
  debounceMs = 500
}: UseBulkRowUpdateParams) {
  const queryClient = useQueryClient()

  // AIDEV-NOTE: Debounced mutation tracker for batching rapid cell updates
  // Stores pending mutations per cell (rowId + fieldId) to prevent database thrashing
  // Each cell's updates are debounced independently to batch rapid changes
  const pendingMutationsRef = useRef<Map<string, { rowId: string; fieldId: number; value: any }>>(new Map())

  // AIDEV-NOTE: Keep fields reference fresh without triggering debounce recreation
  // This allows the debounce function to access current field data without being recreated
  const fieldsRef = useRef(fields)
  useEffect(() => {
    fieldsRef.current = fields
  }, [fields])

  // Helper: Convert field ID to field name for row data updates
  // Grid component works with numeric field IDs (1, 2, 3...), but row data is keyed by field names ("email", "age", etc.)
  // This conversion is needed because rows are stored as { email: "test@example.com", age: 25 }, not { 1: "test@example.com", 2: 25 }
  const getFieldNameById = useCallback((fieldId: number): string | null => {
    const field = fieldsRef.current.find(f => f.id === fieldId)
    return field ? field.name : null
  }, [])

  // AIDEV-NOTE: Table-level debounced batch processor
  // Collects ALL pending cell changes across entire table and sends in SINGLE API call
  // This eliminates race conditions and reduces database load significantly
  // SIMPLIFIED: Create debounce ONCE on mount, use fieldsRef for fresh data (no recreation)
  const debouncedBatchUpdateRef = useRef(
    debounce(() => {
      const pendingUpdates = Array.from(pendingMutationsRef.current.values())

      if (pendingUpdates.length === 0) {
        logger.debug('No pending updates to process')
        return
      }

      logger.debug('Processing pending updates', { count: pendingUpdates.length })

      // Group updates by rowId using fresh field data from ref
      const updatesByRow = new Map<string, Record<string, any>>()

      pendingUpdates.forEach(({ rowId, fieldId, value }) => {
        // Access fields from ref - always fresh without recreation!
        const field = fieldsRef.current.find(f => f.id === fieldId)
        if (!field) {
          logger.error('Field not found, skipping update', { fieldId, rowId })
          return
        }

        if (!updatesByRow.has(rowId)) {
          updatesByRow.set(rowId, {})
        }
        // CRITICAL FIX: Use numeric field ID as key, not field name
        // System uses numeric IDs everywhere for immutability
        updatesByRow.get(rowId)![field.id] = value
      })

      // Convert to array format expected by bulk API
      const bulkUpdates = Array.from(updatesByRow.entries()).map(([rowId, data]) => ({
        rowId,
        data
      }))

      if (bulkUpdates.length === 0) {
        logger.error('No valid updates after field resolution', {
          pendingCount: pendingUpdates.length,
          fieldsCount: fieldsRef.current.length
        })
        pendingMutationsRef.current.clear()
        return
      }

      logger.debug('Submitting bulk update', { rows: bulkUpdates.length })

      // Clear pending mutations and trigger bulk update
      pendingMutationsRef.current.clear()
      bulkUpdateMutation.mutate(bulkUpdates)
    }, debounceMs)
  )

  // Cleanup debounce on unmount only (no dependencies - debounce never recreated)
  useEffect(() => {
    return () => {
      debouncedBatchUpdateRef.current?.cancel()
    }
  }, [])

  /**
   * Handle row update with optimistic UI update and batched server sync
   * 
   * AIDEV-NOTE: Two-phase update with table-level batching:
   * 1. Immediate optimistic UI update (instant feedback to user)
   * 2. Collect in batch, debounced bulk server write (eliminates race conditions)
   * 
   * @param rowId - ID of the row being updated
   * @param fieldId - Numeric field ID being changed
   * @param value - New field value
   */
  const handleUpdateRow = useCallback(async (
    rowId: string,
    fieldId: number,
    value: DomainFieldValue
  ) => {
    // Step 1: Immediate optimistic UI update for instant feedback
    const queryKey = selectedTableId
      ? rowQueryKeys.infinite(selectedTableId, sortBy, activeFilters ?? [])
      : ['rows', null, 'infinite']

    // Convert field ID to field name for cache update
    const fieldName = getFieldNameById(fieldId)
    if (fieldName) {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            rows: page.rows.map((row: DSGRow) =>
              row.id === rowId ? { ...row, [fieldName]: value } : row
            )
          }))
        }
      })
    }

    // Step 2: Add to batch and trigger table-level debounced update
    // Key is per-cell to handle same cell being edited multiple times
    const key = `${rowId}-${fieldId}`
    pendingMutationsRef.current.set(key, { rowId, fieldId, value })

    // Trigger table-level debounced batch processor
    // This will collect ALL pending updates and send in single API call
    debouncedBatchUpdateRef.current?.()
  }, [selectedTableId, sortBy, activeFilters, getFieldNameById, queryClient, bulkUpdateMutation])

  return {
    handleUpdateRow
  }
}
