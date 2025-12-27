'use client';

/**
 * useChildDataBlock - Hook for child DataBlocks that need dynamic data in filters
 *
 * AIDEV-NOTE: Handles client-side data fetching when filters reference:
 * - {rowData.fieldName} - Parent row data (nested DataBlocks)
 * - {state.key} - State values (flat namespace, dynamic filtering)
 *
 * Also handles client-side sorting when sortConfig includes dynamic state values.
 *
 * Features:
 * - Detects {rowData.fieldName} and {state.key} patterns
 * - Subscribes to state changes for reactive re-fetch
 * - Uses useParentRowData() for row data resolution
 * - Fetches data client-side via executeView server action
 * - Applies client-side sorting for static and dynamic sort configs
 * - Returns rows, loading state, and error info
 */

import { useState, useEffect, useMemo, useReducer, useCallback } from 'react';
import { useParentRowData } from '@/components/puck/contexts/RowDataContext';
import { useStateContext } from '@/components/puck/contexts/StateContext';
import { executeView } from '@/app/actions/views';
import type { RowFilterConfig, FilterCondition } from '../../fields/MultiFilterField';
import type { RowSortConfig, SortCondition } from '../../fields/MultiSortField';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type {
  RelationArrayFieldValue,
  FileArrayFieldValue,
  DocumentArrayFieldValue,
} from '@/ddd/domain/tables/value-objects/field-values';

/** Regex to match {rowData.fieldName} pattern */
const ROW_DATA_VAR_REGEX = /\{rowData\.(\w+)\}/g;

/** Regex to match {state.key} pattern (flat namespace) */
const STATE_VAR_REGEX = /\{state\.([^}]+)\}/g;

/** Check if a condition has rowData variables */
function hasRowDataVariable(condition: FilterCondition): boolean {
  return typeof condition.value === 'string' && condition.value.includes('{rowData.');
}

/** Check if a condition has state variables */
function hasStateVariable(condition: FilterCondition): boolean {
  return typeof condition.value === 'string' && condition.value.includes('{state.');
}

/** Check if any condition in the filter config has rowData variables */
function filterHasRowDataVariables(filterConfig?: RowFilterConfig): boolean {
  if (!filterConfig?.conditions?.length) return false;
  return filterConfig.conditions.some(hasRowDataVariable);
}

/** Check if any condition in the filter config has state variables */
function filterHasStateVariables(filterConfig?: RowFilterConfig): boolean {
  if (!filterConfig?.conditions?.length) return false;
  return filterConfig.conditions.some(hasStateVariable);
}


/**
 * Extract filter-friendly value based on field type
 * Uses field metadata to determine how to extract the value
 */
function extractFilterValue(
  value: unknown,
  fieldType: FieldType
): string {
  if (value === undefined || value === null) {
    return '';
  }

  // Handle array-based field types using known types
  switch (fieldType) {
    case 'relation': {
      const relations = value as RelationArrayFieldValue;
      if (Array.isArray(relations) && relations.length > 0) {
        // Extract first ID for equality filter
        return String(relations[0].id);
      }
      return '';
    }

    case 'file': {
      const files = value as FileArrayFieldValue;
      if (Array.isArray(files) && files.length > 0) {
        return String(files[0].id);
      }
      return '';
    }

    case 'document': {
      const docs = value as DocumentArrayFieldValue;
      if (Array.isArray(docs) && docs.length > 0) {
        return String(docs[0].id);
      }
      return '';
    }

    case 'multi-select': {
      // Multi-select stores array of option values
      if (Array.isArray(value)) {
        return value.map(String).join(',');
      }
      return String(value);
    }

    // Primitive types - direct conversion
    case 'text':
    case 'email':
    case 'phone':
    case 'single-select':
    case 'number':
    case 'autonumber':
    case 'boolean':
    case 'date':
    case 'last-updated':
    case 'created-at':
    case 'json':
    case 'embedding':
    default:
      return String(value);
  }
}

/**
 * Resolve all {rowData.fieldName} variables in a string value
 * Uses field metadata to properly extract values based on field type
 */
function resolveRowDataVariables(
  value: string,
  resolveVariable: (fieldName: string) => unknown,
  getFieldType: (fieldName: string) => FieldType | undefined
): string {
  return value.replace(ROW_DATA_VAR_REGEX, (_, fieldName) => {
    const resolved = resolveVariable(fieldName);

    // Special case: 'id' is always a number/string primitive
    if (fieldName === 'id') {
      return resolved !== undefined && resolved !== null ? String(resolved) : '';
    }

    const fieldType = getFieldType(fieldName);
    if (!fieldType) {
      console.warn(`[resolveRowDataVariables] Unknown field type for: ${fieldName}`);
      return resolved !== undefined && resolved !== null ? String(resolved) : '';
    }

    return extractFilterValue(resolved, fieldType);
  });
}

/**
 * Resolve all {state.key} variables in a string value (flat namespace)
 */
function resolveStateVariables(
  value: string,
  getStateValue: (key: string) => unknown
): string {
  // Reset regex lastIndex
  STATE_VAR_REGEX.lastIndex = 0;

  return value.replace(STATE_VAR_REGEX, (_, key) => {
    const resolved = getStateValue(key);
    return resolved !== undefined && resolved !== null ? String(resolved) : '';
  });
}

interface UseChildDataBlockProps {
  viewId?: number;
  filterConfig?: RowFilterConfig;
  sortConfig?: RowSortConfig;
  pageSize: number;
  mode: 'single' | 'list';
}

/**
 * Sort rows by the given sort conditions
 */
function sortRows(
  rows: Record<string, unknown>[],
  conditions: Array<{ field: string; direction: 'asc' | 'desc' }>
): Record<string, unknown>[] {
  if (!conditions.length) return rows;

  return [...rows].sort((a, b) => {
    for (const condition of conditions) {
      const aVal = a[condition.field];
      const bVal = b[condition.field];

      // Handle null/undefined
      if (aVal == null && bVal == null) continue;
      if (aVal == null) return condition.direction === 'asc' ? -1 : 1;
      if (bVal == null) return condition.direction === 'asc' ? 1 : -1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      if (comparison !== 0) {
        return condition.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
}

interface UseChildDataBlockResult {
  /** Fetched rows (empty if using server data) */
  rows: Record<string, unknown>[];
  /** Single resolved row (for single mode) */
  resolvedRow: Record<string, unknown> | undefined;
  /** Total count of matching rows */
  totalCount: number;
  /** Whether data is being fetched */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether this hook needs to fetch data client-side */
  needsClientFetch: boolean;
}

/**
 * Hook for child DataBlocks that need parent row data in their filters
 *
 * @example
 * ```tsx
 * const childData = useChildDataBlock({
 *   viewId: 123,
 *   filterConfig: {
 *     conditions: [{
 *       id: '1',
 *       field: 'parent_id',
 *       operator: 'eq',
 *       valueType: 'parentRow',
 *       value: '{rowData.id}',
 *     }],
 *     logic: 'and',
 *   },
 *   pageSize: 10,
 *   mode: 'list',
 * });
 *
 * if (childData.needsClientFetch) {
 *   if (childData.loading) return <Loading />;
 *   // Use childData.rows instead of server-resolved _rows
 * }
 * ```
 */
export function useChildDataBlock({
  viewId,
  filterConfig,
  sortConfig,
  pageSize,
  mode,
}: UseChildDataBlockProps): UseChildDataBlockResult {
  const parentContext = useParentRowData();
  const stateContext = useStateContext();

  // Force re-render counter for state subscriptions
  const [refetchTrigger, forceRefetch] = useReducer(x => x + 1, 0);

  // Check if we need client-side fetching (rowData or state variables)
  const needsClientFetch = useMemo(() => {
    return filterHasRowDataVariables(filterConfig) || filterHasStateVariables(filterConfig);
  }, [filterConfig]);

  // Check if filters or sort config have state references
  const hasStateReferences = useMemo(() => {
    if (filterHasStateVariables(filterConfig)) return true;
    if (sortConfig?.dynamicField) return true;
    if (sortConfig?.dynamicDirection) return true;
    return false;
  }, [filterConfig, sortConfig]);

  // Subscribe to state changes for reactive re-fetch (flat namespace - one subscription)
  useEffect(() => {
    if (!stateContext || !hasStateReferences) return;

    const unsub = stateContext.subscribe(forceRefetch);
    return unsub;
  }, [stateContext, hasStateReferences]);

  // Resolve sort conditions (static + dynamic from state)
  const resolvedSortConditions = useMemo(() => {
    if (!sortConfig) return [];

    const conditions: Array<{ field: string; direction: 'asc' | 'desc' }> = [];

    // Add static sort conditions
    for (const condition of sortConfig.conditions || []) {
      if (condition.field) {
        conditions.push({
          field: condition.field,
          direction: condition.direction || 'asc',
        });
      }
    }

    // Add dynamic sort from state (overrides static if set)
    // Note: dynamicField is now just a key name (flat namespace)
    if (sortConfig.dynamicField && stateContext) {
      const dynamicFieldValue = stateContext.getValue(sortConfig.dynamicField);

      if (dynamicFieldValue && typeof dynamicFieldValue === 'string') {
        // Get dynamic direction
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.dynamicDirection) {
          const dirValue = stateContext.getValue(sortConfig.dynamicDirection);
          if (dirValue === 'desc' || dirValue === 'descending') {
            direction = 'desc';
          }
        }

        // Prepend dynamic sort (takes precedence)
        conditions.unshift({
          field: dynamicFieldValue,
          direction,
        });
      }
    }

    return conditions;
  }, [sortConfig, stateContext]);

  // State for client-fetched data
  const [data, setData] = useState<{
    rows: Record<string, unknown>[];
    totalCount: number;
    loading: boolean;
    error: string | null;
  }>({
    rows: [],
    totalCount: 0,
    loading: false,
    error: null,
  });

  // Build resolved filters with parent row data and state variables substituted
  const resolvedFilters = useMemo(() => {
    if (!needsClientFetch || !filterConfig?.conditions?.length) {
      return null;
    }

    const filters: Array<{ field: string; operator: string; value: unknown }> = [];

    for (const condition of filterConfig.conditions) {
      if (!condition.field || !condition.value) continue;

      let resolvedValue: unknown = condition.value;
      let couldNotResolve = false;

      if (typeof condition.value === 'string') {
        let valueStr = condition.value;

        // Resolve {rowData.x} variables
        if (valueStr.includes('{rowData.')) {
          if (!parentContext) {
            // Need parent context but don't have it
            console.warn(`[useChildDataBlock] No parent context for: ${condition.value}`);
            couldNotResolve = true;
          } else {
            // Get field type lookup function from parent context
            const getFieldType = (fieldName: string): FieldType | undefined => {
              if (fieldName === 'id') return 'number'; // Built-in ID field
              const parent = parentContext.parentStack?.[0];
              const field = parent?.fields.find(f => f.name === fieldName);
              return field?.type;
            };

            const resolved = resolveRowDataVariables(
              valueStr,
              parentContext.resolveRowDataVariable,
              getFieldType
            );
            // Check if variable was resolved
            if (resolved === '' || resolved === valueStr) {
              console.warn(`[useChildDataBlock] Could not resolve rowData: ${condition.value}`);
              couldNotResolve = true;
            }
            valueStr = resolved;
          }
        }

        // Resolve {state.key} variables (flat namespace)
        if (valueStr.includes('{state.') && stateContext) {
          const resolved = resolveStateVariables(valueStr, stateContext.getValue);
          // Check if variable was resolved
          if (resolved.includes('{state.')) {
            console.warn(`[useChildDataBlock] Could not resolve state: ${condition.value}`);
            couldNotResolve = true;
          }
          valueStr = resolved;
        }

        resolvedValue = valueStr;
      }

      // Skip conditions that couldn't be resolved
      if (couldNotResolve) {
        continue;
      }

      filters.push({
        field: condition.field,
        operator: condition.operator || 'eq',
        value: resolvedValue,
      });
    }

    return filters.length > 0 ? filters : null;
    // Include refetchTrigger to re-compute when state changes trigger a refetch
  }, [needsClientFetch, parentContext, filterConfig, stateContext, refetchTrigger]);

  // Fetch data when filters are resolved
  useEffect(() => {
    // Skip if we don't need client fetch or missing required data
    if (!needsClientFetch || !viewId || !resolvedFilters) {
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        // TODO: Pass filterConfig.logic for AND/OR support when backend supports it
        const result = await executeView(
          viewId,
          undefined, // context
          {
            pageSize: mode === 'single' ? 1 : pageSize,
            offset: 0,
          },
          resolvedFilters
        );

        if (cancelled) return;

        if (result) {
          setData({
            rows: result.rows,
            totalCount: result.totalCount,
            loading: false,
            error: null,
          });
        } else {
          setData(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to fetch data',
          }));
        }
      } catch (error) {
        if (cancelled) return;

        setData(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data',
        }));
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // refetchTrigger is included to force re-fetch when state changes
  }, [needsClientFetch, viewId, resolvedFilters, pageSize, mode, refetchTrigger]);

  // Apply client-side sorting
  const sortedRows = useMemo(() => {
    if (!resolvedSortConditions.length) return data.rows;
    return sortRows(data.rows, resolvedSortConditions);
  }, [data.rows, resolvedSortConditions]);

  return {
    rows: sortedRows,
    resolvedRow: mode === 'single' ? sortedRows[0] : undefined,
    totalCount: data.totalCount,
    loading: data.loading,
    error: data.error,
    needsClientFetch,
  };
}

export default useChildDataBlock;
