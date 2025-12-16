'use client';

/**
 * useChildDataBlock - Hook for child DataBlocks that need parent row data in filters
 *
 * When a child DataBlock has a filter using {rowData.fieldName}, the filter
 * value can't be resolved server-side (parent row is only known at render time).
 * This hook detects such filters and fetches data client-side with resolved values.
 *
 * Usage:
 * - Detects {rowData.fieldName} pattern in filter conditions
 * - Uses useParentRowData() to resolve variable values
 * - Fetches data client-side via executeView server action
 * - Returns rows, loading state, and error info
 */

import { useState, useEffect, useMemo } from 'react';
import { useParentRowData } from '@/components/puck/contexts/ParentRowDataContext';
import { executeView } from '@/app/actions/views';
import type { RowFilterConfig, FilterCondition } from '../../fields/MultiFilterField';

/** Regex to match {rowData.fieldName} pattern */
const ROW_DATA_VAR_REGEX = /\{rowData\.(\w+)\}/g;

/** Check if a condition has rowData variables */
function hasRowDataVariable(condition: FilterCondition): boolean {
  return typeof condition.value === 'string' && condition.value.includes('{rowData.');
}

/** Check if any condition in the filter config has rowData variables */
function filterHasRowDataVariables(filterConfig?: RowFilterConfig): boolean {
  if (!filterConfig?.conditions?.length) return false;
  return filterConfig.conditions.some(hasRowDataVariable);
}

/**
 * Resolve all {rowData.fieldName} variables in a string value
 */
function resolveRowDataVariables(
  value: string,
  resolveVariable: (fieldName: string) => unknown
): string {
  return value.replace(ROW_DATA_VAR_REGEX, (_, fieldName) => {
    const resolved = resolveVariable(fieldName);
    return resolved !== undefined && resolved !== null ? String(resolved) : '';
  });
}

interface UseChildDataBlockProps {
  viewId?: number;
  filterConfig?: RowFilterConfig;
  pageSize: number;
  mode: 'single' | 'list';
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
  pageSize,
  mode,
}: UseChildDataBlockProps): UseChildDataBlockResult {
  const parentContext = useParentRowData();

  // Check if we need client-side fetching
  const needsClientFetch = useMemo(() => {
    return filterHasRowDataVariables(filterConfig);
  }, [filterConfig]);

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

  // Build resolved filters with parent row data substituted
  const resolvedFilters = useMemo(() => {
    if (!needsClientFetch || !parentContext || !filterConfig?.conditions?.length) {
      return null;
    }

    const filters: Array<{ field: string; operator: string; value: unknown }> = [];

    for (const condition of filterConfig.conditions) {
      if (!condition.field || !condition.value) continue;

      let resolvedValue: unknown = condition.value;

      // Resolve {rowData.x} variables
      if (typeof condition.value === 'string' && condition.value.includes('{rowData.')) {
        const resolved = resolveRowDataVariables(
          condition.value,
          parentContext.resolveRowDataVariable
        );
        resolvedValue = resolved;

        // Skip if variable couldn't be resolved
        if (resolved === '' || resolved === condition.value) {
          console.warn(`[useChildDataBlock] Could not resolve: ${condition.value}`);
          continue;
        }
      }

      filters.push({
        field: condition.field,
        operator: condition.operator || 'eq',
        value: resolvedValue,
      });
    }

    return filters.length > 0 ? filters : null;
  }, [needsClientFetch, parentContext, filterConfig]);

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
  }, [needsClientFetch, viewId, resolvedFilters, pageSize, mode]);

  return {
    rows: data.rows,
    resolvedRow: mode === 'single' ? data.rows[0] : undefined,
    totalCount: data.totalCount,
    loading: data.loading,
    error: data.error,
    needsClientFetch,
  };
}

export default useChildDataBlock;
