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
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * Resolve variable templates in a string
 *
 * @param template - String with {variable} templates
 * @param rowData - Row data for field resolution (keyed by field ID)
 * @param fields - Field metadata for name→id conversion
 * @param params - Query parameters for param resolution
 * @returns Resolved string with variables replaced
 */
function resolveTemplate(
  template: string,
  rowData: Record<string, unknown> | undefined,
  fields: FieldDTO[] | undefined,
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
      // Convert field name to ID for lookup
      const field = fields?.find(f => f.name === fieldName);
      if (field && rowData) {
        const value = rowData[String(field.id)];
        if (value !== undefined) return String(value);
      }
      return match;
    }

    // Handle {fieldName} shorthand - convert name to ID first
    if (!path.includes('.') && rowData && fields) {
      const field = fields.find(f => f.name === path);
      if (field) {
        const value = rowData[String(field.id)];
        if (value !== undefined) return String(value);
      }
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
  const dataContext = useDataLayoutContext();
  const searchParams = useSearchParams();

  return useCallback(
    (template: string): string => {
      return resolveTemplate(
        template,
        rowContext?.rowData ?? undefined,
        dataContext?.fields,
        searchParams
      );
    },
    [rowContext?.rowData, dataContext?.fields, searchParams]
  );
}

export default useResolveVariables;
