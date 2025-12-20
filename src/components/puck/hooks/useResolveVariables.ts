'use client';

/**
 * useResolveVariables
 *
 * AIDEV-NOTE: Hook to resolve {variable} templates in strings at render time.
 * Uses flat namespace for state - {state.key} not {state.container.key}
 *
 * Supports:
 * - {fieldName} - Shorthand for current row data field
 * - {rowData.fieldName} - Explicit row data access
 * - {params.name} - URL query parameter
 * - {state.key} - State value (flat namespace)
 *
 * @example
 * ```tsx
 * const resolveVariables = useResolveVariables();
 * const resolvedLabel = resolveVariables("View {name}"); // "View iPhone 15"
 * const stateLabel = resolveVariables("Count: {state.count}"); // "Count: 3"
 * ```
 */

import { useCallback, useReducer, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRowData } from '../contexts/RowDataContext';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import { useStateContext } from '../contexts/StateContext';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * Check if template has state references
 */
function hasStateReferences(template: string): boolean {
  return /\{state\.[^}]+\}/.test(template);
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
 * @param getStateValue - Function to get state values (flat namespace)
 * @returns Resolved string with variables replaced
 */
function resolveTemplate(
  template: string,
  rowData: Record<string, unknown> | undefined,
  fields: FieldDTO[] | undefined,
  params: URLSearchParams,
  getStateValue?: (key: string) => unknown
): string {
  if (!template) return template;

  return template.replace(/\{([^}]+)\}/g, (match, path) => {
    // Handle {state.key} syntax (flat namespace)
    if (path.startsWith('state.') && getStateValue) {
      const key = path.substring(6); // Remove 'state.' prefix
      const value = getStateValue(key);
      if (value !== undefined) return formatValue(value);
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

  // Create the resolver function
  const resolveVariables = useCallback(
    (template: string) => {
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

  return resolveVariables;
}

/**
 * Hook that resolves a specific template and subscribes to state changes
 */
export function useResolvedTemplate(template: string) {
  const rowContext = useRowData();
  const dataContext = useDataLayoutContext();
  const searchParams = useSearchParams();
  const stateContext = useStateContext();

  // Force re-render counter for state subscriptions
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Subscribe to state changes if template has state references
  useEffect(() => {
    if (!stateContext || !template || !hasStateReferences(template)) return;

    const unsub = stateContext.subscribe(forceUpdate);
    return unsub;
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
