'use client';

/**
 * useResolveVariables
 *
 * Hook to resolve {variable} templates in strings at render time.
 * Supports:
 * - {fieldName} - Shorthand for current row data field
 * - {rowData.fieldName} - Explicit row data access
 * - {params.name} - URL query parameter
 * - {state.container.key} - State container value
 *
 * @example
 * ```tsx
 * const resolveVariables = useResolveVariables();
 * const resolvedLabel = resolveVariables("View {name}"); // "View iPhone 15"
 * const stateLabel = resolveVariables("Count: {state.cart.count}"); // "Count: 3"
 * ```
 */

import { useCallback, useReducer, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRowData } from '../contexts/RowDataContext';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import { useStateContext } from '../contexts/StateContext';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * Extract state containers referenced in a template
 */
function extractStateContainers(template: string): Set<string> {
  const containers = new Set<string>();
  const pattern = /\{state\.([^.}]+)\.[^}]+\}/g;
  let match;
  while ((match = pattern.exec(template)) !== null) {
    containers.add(match[1]);
  }
  return containers;
}

/**
 * Format a value for display in text
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => formatValue(v)).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

/**
 * Resolve variable templates in a string
 *
 * @param template - String with {variable} templates
 * @param rowData - Row data for field resolution (keyed by field ID)
 * @param fields - Field metadata for name→id conversion
 * @param params - Query parameters for param resolution
 * @param getStateValue - Function to get state values
 * @returns Resolved string with variables replaced
 */
function resolveTemplate(
  template: string,
  rowData: Record<string, unknown> | undefined,
  fields: FieldDTO[] | undefined,
  params: URLSearchParams,
  getStateValue?: (container: string, key: string) => unknown
): string {
  if (!template) return template;

  return template.replace(/\{([^}]+)\}/g, (match, path) => {
    // Handle {state.container.key} syntax
    if (path.startsWith('state.') && getStateValue) {
      const parts = path.substring(6).split('.');
      if (parts.length >= 2) {
        const container = parts[0];
        const key = parts.slice(1).join('.');
        const value = getStateValue(container, key);
        if (value !== undefined) return formatValue(value);
      }
      return match;
    }

    // Handle {params.name} syntax
    if (path.startsWith('params.')) {
      const paramName = path.substring(7);
      const paramValue = params.get(paramName);
      return paramValue ?? match;
    }

    // Handle {rowData.fieldName} syntax (explicit)
    if (path.startsWith('rowData.')) {
      const fieldName = path.substring(8);
      // Convert field name to ID for lookup
      const field = fields?.find(f => f.name === fieldName);
      if (field && rowData) {
        const value = rowData[String(field.id)];
        if (value !== undefined) return formatValue(value);
      }
      return match;
    }

    // Handle {fieldName} shorthand - convert name to ID first
    if (!path.includes('.') && rowData && fields) {
      const field = fields.find(f => f.name === path);
      if (field) {
        const value = rowData[String(field.id)];
        if (value !== undefined) return formatValue(value);
      }
    }

    // Return original if not resolved
    return match;
  });
}

/**
 * Hook that returns a function to resolve variable templates
 * Automatically re-renders when referenced state values change
 */
export function useResolveVariables() {
  const rowContext = useRowData();
  const dataContext = useDataLayoutContext();
  const searchParams = useSearchParams();
  const stateContext = useStateContext();

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // We can't subscribe to specific containers since we don't know what
  // templates will be passed. Instead, we re-render on any state change.
  // This is a trade-off for the flexibility of imperative resolution.
  // For better performance, use useInterpolatedText with a known template.

  const resolve = useCallback(
    (template: string): string => {
      return resolveTemplate(
        template,
        rowContext?.rowData ?? undefined,
        dataContext?.fields,
        searchParams,
        stateContext?.getValue
      );
    },
    [rowContext?.rowData, dataContext?.fields, searchParams, stateContext?.getValue]
  );

  return resolve;
}

/**
 * Hook variant that subscribes to specific state containers
 * More efficient than useResolveVariables when template is known
 *
 * @param template - The template string to watch for state references
 */
export function useResolveVariablesWithSubscription(template: string) {
  const rowContext = useRowData();
  const dataContext = useDataLayoutContext();
  const searchParams = useSearchParams();
  const stateContext = useStateContext();

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Extract and subscribe to state containers
  useEffect(() => {
    if (!stateContext || !template) return;

    const containers = extractStateContainers(template);
    if (containers.size === 0) return;

    const unsubscribers: Array<() => void> = [];
    containers.forEach(container => {
      const unsub = stateContext.subscribe(container, forceUpdate);
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [stateContext, template]);

  return resolveTemplate(
    template,
    rowContext?.rowData ?? undefined,
    dataContext?.fields,
    searchParams,
    stateContext?.getValue
  );
}

export default useResolveVariables;
