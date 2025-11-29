'use client';

/**
 * PageVariablesContext
 *
 * Provides page variable definitions to the Puck editor.
 * Used by VariableAutocompleteInput to show defined page variables
 * in the autocomplete dropdown.
 *
 * Also provides pageId and addPageVariable for auto-creating
 * page variables when used in DataBlock filters or navigation actions.
 */

import React, { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import type { PageVariable } from '@/components/puck/types';

interface PageVariablesContextValue {
  /** Page variables defined for this page */
  pageVariables: PageVariable[];
  /** Page ID for server actions */
  pageId?: number;
  /** Add a new page variable (auto-saves to server) */
  addPageVariable?: (variable: PageVariable) => Promise<void>;
}

const PageVariablesContext = createContext<PageVariablesContextValue | undefined>(undefined);

interface PageVariablesProviderProps {
  children: ReactNode;
  pageVariables: PageVariable[];
  pageId?: number;
  onAddPageVariable?: (variable: PageVariable) => Promise<void>;
}

/**
 * Provider component that wraps the Puck editor
 * Makes page variables available for autocomplete and auto-creation
 */
export function PageVariablesProvider({
  children,
  pageVariables: initialPageVariables,
  pageId,
  onAddPageVariable,
}: PageVariablesProviderProps) {
  // Local state to reflect immediate changes
  const [pageVariables, setPageVariables] = useState<PageVariable[]>(initialPageVariables);

  // Sync with props when they change
  React.useEffect(() => {
    setPageVariables(initialPageVariables);
  }, [initialPageVariables]);

  const addPageVariable = useCallback(async (variable: PageVariable) => {
    // Check if already exists
    if (pageVariables.some(v => v.name === variable.name)) {
      return;
    }

    // Update local state immediately for UI responsiveness
    setPageVariables(prev => [...prev, variable]);

    // Persist to server via callback
    if (onAddPageVariable) {
      await onAddPageVariable(variable);
    }
  }, [pageVariables, onAddPageVariable]);

  return (
    <PageVariablesContext.Provider value={{ pageVariables, pageId, addPageVariable }}>
      {children}
    </PageVariablesContext.Provider>
  );
}

/**
 * Hook to access page variables in editor components
 *
 * @returns Page variables, or empty array if not in context
 */
export function usePageVariables(): PageVariable[] {
  const context = useContext(PageVariablesContext);
  return context?.pageVariables ?? [];
}

/**
 * Hook to access full page variables context including add functionality
 *
 * @returns Full context with pageId and addPageVariable
 */
export function usePageVariablesContext(): PageVariablesContextValue {
  const context = useContext(PageVariablesContext);
  return context ?? { pageVariables: [] };
}

export default PageVariablesProvider;
