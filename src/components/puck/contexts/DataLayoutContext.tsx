'use client';

/**
 * DataLayoutContext
 *
 * Provides field metadata from DataBlock to child field blocks.
 * This enables the FieldSelectorField to show available fields
 * based on the parent DataBlock's selected view/table.
 *
 * AIDEV-NOTE: Used by DataBlock to share field metadata with children.
 * Child field blocks use this to populate their field selector dropdown.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface DataLayoutContextValue {
  /** ID of the table associated with the view */
  tableId?: number;

  /** ID of the selected view */
  viewId?: number;

  /** Available fields from the table */
  fields: FieldDTO[];
}

const DataLayoutContext = createContext<DataLayoutContextValue | undefined>(undefined);

interface DataLayoutProviderProps {
  children: ReactNode;
  tableId?: number;
  viewId?: number;
  fields: FieldDTO[];
}

/**
 * Provider component that wraps content in DataBlock
 * Makes field metadata available to all child field blocks
 */
export function DataLayoutProvider({ children, tableId, viewId, fields }: DataLayoutProviderProps) {
  return (
    <DataLayoutContext.Provider value={{ tableId, viewId, fields }}>
      {children}
    </DataLayoutContext.Provider>
  );
}

/**
 * Hook to access field metadata in child blocks
 *
 * @returns Field metadata, or null if not in a DataBlock
 *
 * @example
 * ```tsx
 * function MyFieldBlock() {
 *   const dataContext = useDataLayoutContext();
 *
 *   if (dataContext?.fields) {
 *     return <select>{dataContext.fields.map(f => <option key={f.id}>{f.name}</option>)}</select>;
 *   }
 *
 *   return <div>Not inside a Data block</div>;
 * }
 * ```
 */
export function useDataLayoutContext(): DataLayoutContextValue | null {
  const context = useContext(DataLayoutContext);

  // Return null if not in a DataBlock (rather than throwing error)
  if (context === undefined) {
    return null;
  }

  return context;
}

/**
 * Hook to check if currently inside a DataBlock
 */
export function useIsInDataBlock(): boolean {
  return useDataLayoutContext() !== null;
}
