'use client';

/**
 * useFieldValue Hook
 *
 * Accesses field value from nearest data context (DataContextBlock or RepeatBlock).
 * This hook implements the "nearest context wins" pattern for nested contexts.
 *
 * Resolution priority:
 * 1. Nearest RowDataContext (from DataContextBlock or RepeatBlock)
 * 2. Query parameters (page-level context)
 * 3. null (no data available)
 *
 * Usage in Field blocks:
 * ```typescript
 * function TextField({ fieldId }) {
 *   const value = useFieldValue(fieldId);
 *   return <span>{value ?? 'No data'}</span>;
 * }
 * ```
 */

import { useRowData } from '@/components/puck/contexts/RowDataContext';
import { useQueryParams } from '@/components/puck/contexts/PageContext';

/**
 * Get field value from nearest context
 *
 * @param fieldId - Field ID to retrieve (numeric, used as key in row data)
 *                  Special value 'id' returns the row ID directly
 * @returns Field value or null if not found
 */
export function useFieldValue(fieldId: number | string): any {
  // 1. Try nearest row context (DataContextBlock or RepeatBlock)
  const rowContext = useRowData();

  if (rowContext?.rowData) {
    // Special case: Row ID is stored as direct property, not as field value
    if (fieldId === 'id') {
      return rowContext.rowData.id ?? null;
    }

    const fieldKey = String(fieldId);
    const value = rowContext.rowData[fieldKey];

    if (value !== undefined) {
      return value;
    }
  }

  // 2. Fall back to query params (page-level context)
  try {
    const queryParams = useQueryParams();
    const fieldKey = String(fieldId);

    if (queryParams && queryParams[fieldKey] !== undefined) {
      return queryParams[fieldKey];
    }
  } catch (error) {
    // useQueryParams throws if not in provider - that's okay, just means no page context
    console.debug('[useFieldValue] No query param context available');
  }

  // 3. No data available
  return null;
}

/**
 * Check if field value exists in any context
 *
 * @param fieldId - Field ID to check
 * @returns true if field has a value in any context
 */
export function useHasFieldValue(fieldId: number | string): boolean {
  const value = useFieldValue(fieldId);
  return value !== null && value !== undefined;
}

/**
 * Check if component is inside a data context
 * (DataContextBlock or RepeatBlock)
 *
 * @returns true if inside a data context
 */
export function useIsInDataContext(): boolean {
  const rowContext = useRowData();
  return rowContext !== null && rowContext.rowData !== null;
}
