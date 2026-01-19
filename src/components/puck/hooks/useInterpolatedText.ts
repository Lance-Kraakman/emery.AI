'use client';

/**
 * useInterpolatedText - Hook for text interpolation with reactive updates
 *
 * AIDEV-NOTE: Provides reactive text interpolation that re-renders when
 * referenced state values change. Uses flat namespace for state.
 *
 * @example
 * ```tsx
 * function MyComponent({ text }) {
 *   // Text like "Hello {{state.userName}}!" becomes "Hello John!"
 *   // Re-renders when state changes
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
  hasVariableReferences,
  hasStateReferences,
} from '@/components/puck/utils/text-interpolation';

/**
 * Hook to interpolate text with variable references
 *
 * Automatically subscribes to state changes for reactive updates.
 *
 * @param text - Text with optional variable references like {{state.key}}
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

  // Check if text has state references
  const needsStateSubscription = useMemo(() => {
    if (!text) return false;
    return hasStateReferences(text);
  }, [text]);

  // Subscribe to state changes (flat namespace - just one subscription)
  useEffect(() => {
    if (!stateContext || !needsStateSubscription) return;

    const unsubscribe = stateContext.subscribe(forceUpdate);
    return unsubscribe;
  }, [stateContext, needsStateSubscription]);

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
