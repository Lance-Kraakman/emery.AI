'use client';

/**
 * TemplateEditorContext
 *
 * Unified context for DataBlock template editing. Provides:
 * - Field metadata for field selectors in the sidebar
 * - Sample row data for preview in the canvas
 * - Loading/error states for reliable UX
 *
 * Fetches data fresh when entering template edit mode, solving the
 * stale data problem where fields from the editing stack become outdated.
 *
 * Usage:
 * - Wrap the Puck editor with <TemplateEditorProvider> when editing a DataBlock template
 * - Use useTemplateEditor() hook to access field metadata and sample row
 * - The iframe override uses this context to provide RowDataProvider/DataLayoutProvider
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { getFields } from '@/app/actions/fields';
import { executeView } from '@/app/actions/views';
import { DataLayoutProvider } from './DataLayoutContext';

/**
 * Context value for template editor state
 */
export interface TemplateEditorContextValue {
  /** Whether we're currently editing a DataBlock template */
  isActive: boolean;
  /** Field metadata from the DataBlock's view */
  fields: FieldDTO[];
  /** Sample row data for preview */
  sampleRow: Record<string, unknown>;
  /** View ID for the DataBlock */
  viewId: number | undefined;
  /** Table ID for the DataBlock */
  tableId: number | undefined;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if data fetch failed */
  error: string | undefined;
}

/**
 * Default context value when not editing a template
 */
const defaultValue: TemplateEditorContextValue = {
  isActive: false,
  fields: [],
  sampleRow: {},
  viewId: undefined,
  tableId: undefined,
  isLoading: false,
  error: undefined,
};

const TemplateEditorContext = createContext<TemplateEditorContextValue>(defaultValue);

/**
 * Hook to access template editor context
 * Returns default inactive state when not in a TemplateEditorProvider
 */
export function useTemplateEditor(): TemplateEditorContextValue {
  return useContext(TemplateEditorContext);
}

/**
 * Props for TemplateEditorProvider
 */
export interface TemplateEditorProviderProps {
  /** View ID to fetch fields and sample data from */
  viewId: number;
  /** Table ID for field lookup */
  tableId: number;
  /** Children to render */
  children: ReactNode;
}

/**
 * TemplateEditorProvider - Wraps Puck editor when editing a DataBlock template
 *
 * Fetches fields and sample row data fresh from the server, avoiding
 * stale data issues from the editing stack.
 *
 * @example
 * ```tsx
 * <TemplateEditorProvider viewId={123} tableId={456}>
 *   <Puck config={config} data={data} ... />
 * </TemplateEditorProvider>
 * ```
 */
export function TemplateEditorProvider({
  viewId,
  tableId,
  children,
}: TemplateEditorProviderProps) {
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [sampleRow, setSampleRow] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(undefined);

      try {
        // Fetch fields and sample row in parallel
        const [tableFields, viewResult] = await Promise.all([
          getFields(tableId, { viaViewId: viewId }),
          executeView(viewId, undefined, { pageSize: 1, offset: 0 }),
        ]);

        if (cancelled) return;

        setFields(tableFields);

        if (viewResult?.rows?.[0]) {
          setSampleRow(viewResult.rows[0]);
        } else {
          setSampleRow({});
        }
      } catch (e) {
        if (cancelled) return;
        console.error('[TemplateEditorProvider] Error fetching data:', e);
        setError(e instanceof Error ? e.message : 'Failed to load template data');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [viewId, tableId]);

  const contextValue: TemplateEditorContextValue = {
    isActive: true,
    fields,
    sampleRow,
    viewId,
    tableId,
    isLoading,
    error,
  };

  // Wrap children with both TemplateEditorContext AND DataLayoutProvider
  // DataLayoutProvider is needed for sidebar components (FieldSelectorField, VariableAutocompleteInput)
  // which are rendered OUTSIDE the iframe and need field metadata
  return (
    <TemplateEditorContext.Provider value={contextValue}>
      <DataLayoutProvider
        viewId={viewId}
        tableId={tableId}
        fields={fields}
        sampleRow={sampleRow}
      >
        {children}
      </DataLayoutProvider>
    </TemplateEditorContext.Provider>
  );
}

export default TemplateEditorProvider;
