'use client';

/**
 * useInterpolatedText - Hook for text interpolation with reactive updates
 *
 * Provides reactive text interpolation that re-renders when referenced
 * state values change.
 *
 * @example
 * ```tsx
 * function MyComponent({ text }) {
 *   // Text like "Hello {state.user.name}!" becomes "Hello John!"
 *   // Re-renders when user.name changes
 *   const interpolated = useInterpolatedText(text);
 *   return <span>{interpolated}</span>;
 * }
 * ```
 */

import { useMemo, useEffect, useReducer } from 'react';
import { usePageContext } from '@/components/puck/contexts/PageContext';
import { useRowData } from '@/components/puck/contexts/RowDataContext';
import { useStateContext } from '@/components/puck/contexts/StateContext';
import type { ValueResolutionContext } from '@/components/puck/types/value-source';
import {
  interpolateText,
  extractStateContainers,
  hasVariableReferences,
} from '@/components/puck/utils/text-interpolation';

/**
 * Hook to interpolate text with variable references
 *
 * Automatically subscribes to state changes for reactive updates.
 *
 * @param text - Text with optional variable references like {state.x.y}
 * @returns Interpolated text with all variables resolved
 */
export function useInterpolatedText(text: string | undefined | null): string {
  const pageContext = usePageContext();
  const rowContext = useRowData();
  const stateContext = useStateContext();

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Build resolution context
  const context = useMemo<ValueResolutionContext>(() => ({
    params: pageContext.params as Record<string, string | string[] | undefined>,
    resolveRowData: rowContext?.resolveRowDataVariable,
    getStateValue: stateContext?.getValue,
    formData: undefined,
  }), [pageContext.params, rowContext?.resolveRowDataVariable, stateContext?.getValue]);

  // Extract state containers for subscription
  const stateContainers = useMemo(() => {
    if (!text) return new Set<string>();
    return extractStateContainers(text);
  }, [text]);

  // Subscribe to state changes
  useEffect(() => {
    if (!stateContext || stateContainers.size === 0) return;

    const unsubscribers: Array<() => void> = [];

    stateContainers.forEach(container => {
      const unsub = stateContext.subscribe(container, forceUpdate);
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [stateContext, stateContainers]);

  // Perform interpolation
  return useMemo(() => {
    if (!text) return '';
    if (!hasVariableReferences(text)) return text;
    return interpolateText(text, context);
  }, [text, context]);
}

/**
 * Hook to check if text contains variable references
 *
 * Useful for conditional rendering or optimization.
 *
 * @param text - Text to check
 * @returns true if text contains variable references
 */
export function useHasVariables(text: string | undefined | null): boolean {
  return useMemo(() => {
    if (!text) return false;
    return hasVariableReferences(text);
  }, [text]);
}

/**
 * Hook to get interpolation context for imperative use
 *
 * @returns Resolution context for use with interpolateText directly
 */
export function useInterpolationContext(): ValueResolutionContext {
  const pageContext = usePageContext();
  const rowContext = useRowData();
  const stateContext = useStateContext();

  return useMemo<ValueResolutionContext>(() => ({
    params: pageContext.params as Record<string, string | string[] | undefined>,
    resolveRowData: rowContext?.resolveRowDataVariable,
    getStateValue: stateContext?.getValue,
    formData: undefined,
  }), [pageContext.params, rowContext?.resolveRowDataVariable, stateContext?.getValue]);
}
