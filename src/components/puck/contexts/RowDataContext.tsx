'use client';

/**
 * RowDataContext
 *
 * Provides row data from DataBlock to child blocks.
 * When a block is rendered inside a DataBlock, it can access
 * the current row's data via this context.
 */

import React, { createContext, useContext, type ReactNode } from 'react';

interface RowDataContextValue {
  /** Current row data from the DataBlock */
  rowData: Record<string, unknown> | null;

  /** Index of the current row in the iteration */
  rowIndex: number;
}

const RowDataContext = createContext<RowDataContextValue | undefined>(undefined);

interface RowDataProviderProps {
  children: ReactNode;
  rowData: Record<string, unknown>;
  rowIndex: number;
}

/**
 * Provider component that wraps each row in DataBlock
 * Makes row data available to all child blocks
 */
export function RowDataProvider({ children, rowData, rowIndex }: RowDataProviderProps) {
  return (
    <RowDataContext.Provider value={{ rowData, rowIndex }}>
      {children}
    </RowDataContext.Provider>
  );
}

/**
 * Hook to access row data in child blocks
 *
 * @returns Row data and index, or null if not in a Repeat element
 *
 * @example
 * ```tsx
 * function MyBlock() {
 *   const rowContext = useRowData();
 *
 *   if (rowContext?.rowData) {
 *     return <div>{rowContext.rowData.name}</div>;
 *   }
 *
 *   return <div>No row data</div>;
 * }
 * ```
 */
export function useRowData(): RowDataContextValue | null {
  const context = useContext(RowDataContext);

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
  return useRowData() !== null;
}
