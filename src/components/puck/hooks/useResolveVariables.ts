'use client';

/**
 * useResolveVariables
 *
 * Hook to resolve {variable} templates in strings at render time.
 * Uses row data from RowDataContext and query params.
 *
 * @example
 * ```tsx
 * const resolveVariables = useResolveVariables();
 * const resolvedLabel = resolveVariables("View {name}"); // "View iPhone 15"
 * ```
 */

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRowData } from '../contexts/RowDataContext';

/**
 * Resolve variable templates in a string
 *
 * @param template - String with {variable} templates
 * @param rowData - Row data for field resolution
 * @param params - Query parameters for param resolution
 * @returns Resolved string with variables replaced
 */
function resolveTemplate(
  template: string,
  rowData: Record<string, unknown> | undefined,
  params: URLSearchParams
): string {
  if (!template) return template;

  return template.replace(/\{([^}]+)\}/g, (match, path) => {
    // Handle {params.name} syntax
    if (path.startsWith('params.')) {
      const paramName = path.substring(7);
      const paramValue = params.get(paramName);
      return paramValue ?? match;
    }

    // Handle {rowData.fieldName} syntax (explicit)
    if (path.startsWith('rowData.')) {
      const fieldName = path.substring(8);
      if (rowData && fieldName in rowData) {
        return String(rowData[fieldName]);
      }
      return match;
    }

    // Handle {fieldName} shorthand (assumes row data)
    if (!path.includes('.') && rowData && path in rowData) {
      return String(rowData[path]);
    }

    // Return original if not resolved
    return match;
  });
}

/**
 * Hook that returns a function to resolve variable templates
 */
export function useResolveVariables() {
  const rowContext = useRowData();
  const searchParams = useSearchParams();

  return useCallback(
    (template: string): string => {
      return resolveTemplate(template, rowContext?.rowData ?? undefined, searchParams);
    },
    [rowContext?.rowData, searchParams]
  );
}

export default useResolveVariables;
