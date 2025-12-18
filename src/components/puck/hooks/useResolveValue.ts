'use client';

/**
 * useResolveValue - Hook for resolving ValueSource objects
 *
 * Provides a unified way to resolve values from different sources
 * (params, rowData, state, formData) using available contexts.
 *
 * This hook:
 * - Reads from PageContext for URL params
 * - Reads from RowDataContext for parent row data
 * - Reads from StateContext for state container values
 * - Returns resolved values with proper typing
 */

import { useMemo } from 'react';
import { usePageContext } from '@/components/puck/contexts/PageContext';
import { useRowData } from '@/components/puck/contexts/RowDataContext';
import { useStateContext } from '@/components/puck/contexts/StateContext';
import {
  type ValueSource,
  type ValueResolutionContext,
  resolveValueSource,
} from '@/components/puck/types/value-source';

/**
 * Hook to resolve a single ValueSource
 *
 * @param source - The ValueSource to resolve
 * @returns The resolved value, or undefined if resolution fails
 *
 * @example
 * ```tsx
 * function FilteredDataBlock({ filter }) {
 *   // Resolve the filter value from whatever source it references
 *   const resolvedValue = useResolveValue(filter.valueSource);
 *
 *   // Use resolved value in filter...
 * }
 * ```
 */
export function useResolveValue(source: ValueSource | null | undefined): unknown {
  const pageContext = usePageContext();
  const rowContext = useRowData();
  const stateContext = useStateContext();

  return useMemo(() => {
    if (!source) return undefined;

    const context: ValueResolutionContext = {
      params: pageContext.params as Record<string, string | string[] | undefined>,
      resolveRowData: rowContext?.resolveRowDataVariable,
      getStateValue: stateContext?.getValue,
      // FormData is only available during action execution, not in hooks
      formData: undefined,
    };

    return resolveValueSource(source, context);
  }, [source, pageContext.params, rowContext?.resolveRowDataVariable, stateContext?.getValue]);
}

/**
 * Hook to get a value resolution context for imperative use
 *
 * @returns A context object that can be used with resolveValueSource
 *
 * @example
 * ```tsx
 * function FilterComponent({ conditions }) {
 *   const resolutionContext = useValueResolutionContext();
 *
 *   // Resolve multiple values imperatively
 *   const resolvedConditions = conditions.map(c => ({
 *     ...c,
 *     value: resolveValueSource(c.valueSource, resolutionContext),
 *   }));
 * }
 * ```
 */
export function useValueResolutionContext(): ValueResolutionContext {
  const pageContext = usePageContext();
  const rowContext = useRowData();
  const stateContext = useStateContext();

  return useMemo<ValueResolutionContext>(() => ({
    params: pageContext.params as Record<string, string | string[] | undefined>,
    resolveRowData: rowContext?.resolveRowDataVariable,
    getStateValue: stateContext?.getValue,
    // FormData not available in hook context
    formData: undefined,
  }), [pageContext.params, rowContext?.resolveRowDataVariable, stateContext?.getValue]);
}

/**
 * Hook to resolve multiple ValueSources at once
 *
 * @param sources - Record of source name to ValueSource
 * @returns Record of source name to resolved value
 *
 * @example
 * ```tsx
 * function FilterComponent({ filterConfig }) {
 *   const resolved = useResolveValues({
 *     category: filterConfig.categorySource,
 *     status: filterConfig.statusSource,
 *   });
 *
 *   // resolved.category, resolved.status contain actual values
 * }
 * ```
 */
export function useResolveValues<T extends Record<string, ValueSource | null | undefined>>(
  sources: T
): { [K in keyof T]: unknown } {
  const context = useValueResolutionContext();

  return useMemo(() => {
    const result = {} as { [K in keyof T]: unknown };

    for (const key of Object.keys(sources) as (keyof T)[]) {
      const source = sources[key];
      result[key] = source ? resolveValueSource(source, context) : undefined;
    }

    return result;
  }, [sources, context]);
}

/**
 * Check if a ValueSource requires client-side resolution
 *
 * Some sources (rowData, state) are only available client-side
 * because the values come from runtime context.
 *
 * @param source - The ValueSource to check
 * @returns true if the source requires client-side resolution
 */
export function requiresClientSideResolution(source: ValueSource): boolean {
  return source.type === 'rowData' || source.type === 'state';
}

/**
 * Check if any ValueSource in a list requires client-side resolution
 *
 * @param sources - Array of ValueSources to check
 * @returns true if any source requires client-side resolution
 */
export function anyRequiresClientSideResolution(sources: (ValueSource | null | undefined)[]): boolean {
  return sources.some(s => s && requiresClientSideResolution(s));
}
