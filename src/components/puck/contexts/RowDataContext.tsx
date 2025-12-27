'use client';

/**
 * RowDataContext - Unified Row Data Context for Puck DataBlocks
 *
 * Consolidates two previous contexts:
 * - RowDataContext: Current row data from DataBlock iteration
 * - ParentRowDataContext: Parent row data stack for nested DataBlocks
 *
 * This enables:
 * - Child blocks to access current row data
 * - Nested DataBlocks to access parent row data for {rowData.x} filters
 * - Field metadata for variable resolution
 */

import React, { createContext, useContext, type ReactNode, useMemo } from 'react';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * A single parent's row data with field metadata
 */
export interface ParentRowData {
  /** The row data (keyed by field ID as string) */
  rowData: Record<string, unknown>;
  /** Field metadata for field name -> value resolution */
  fields: FieldDTO[];
}

/**
 * Unified row data context value
 */
export interface RowDataContextValue {
  // Current row data
  /** Current row data from the DataBlock */
  rowData: Record<string, unknown> | null;
  /** Index of the current row in the iteration */
  rowIndex: number;

  // Field metadata
  /** Field metadata for current row (for name -> id resolution) */
  fields: FieldDTO[];

  // Parent stack (for nested DataBlocks)
  /** Stack of parent row data (closest parent first) */
  parentStack: ParentRowData[];

  // Value resolution
  /**
   * Resolve {rowData.fieldName} to actual value
   * Looks up the field by name, then gets the value by field ID
   */
  resolveRowDataVariable: (fieldName: string) => unknown;

  /**
   * Get list of available parent field names (for UI dropdown)
   */
  getParentFieldNames: () => string[];

  /**
   * Check if we have parent field metadata available
   * Returns true even if rowData is empty but fields are available
   */
  hasParentFields: () => boolean;
}

const RowDataContext = createContext<RowDataContextValue | undefined>(undefined);

export interface RowDataProviderProps {
  children: ReactNode;
  rowData: Record<string, unknown>;
  rowIndex: number;
  /** Field metadata (required for variable resolution in nested DataBlocks) */
  fields: FieldDTO[];
}

/**
 * RowDataProvider - Unified provider for row data and parent stack
 *
 * Wraps each row in DataBlock. When nested, automatically builds
 * the parent stack for {rowData.x} variable resolution.
 *
 * @example
 * ```tsx
 * // In DataBlock, per row:
 * <RowDataProvider rowData={row} rowIndex={index} fields={fields}>
 *   <Children />
 * </RowDataProvider>
 * ```
 */
export function RowDataProvider({
  children,
  rowData,
  rowIndex,
  fields,
}: RowDataProviderProps) {
  // Get existing parent context (for nesting)
  const existingContext = useContext(RowDataContext);

  // Build new parent stack with current row prepended to existing stack
  const parentStack: ParentRowData[] = useMemo(() => {
    const newEntry: ParentRowData = { rowData, fields };
    return [newEntry, ...(existingContext?.parentStack || [])];
  }, [rowData, fields, existingContext?.parentStack]);

  // Resolve {rowData.fieldName} to actual value
  const resolveRowDataVariable = useMemo(() => {
    return (fieldName: string): unknown => {
      // Look at the first parent in the stack (the immediate parent)
      const parent = parentStack[0];
      if (!parent) return undefined;

      // Special case: Row ID is stored as direct property, not as field value
      if (fieldName === 'id') {
        return parent.rowData.id;
      }

      // Find field by name
      const field = parent.fields.find(f => f.name === fieldName);
      if (!field) {
        console.warn(`[RowDataContext] Field "${fieldName}" not found in parent fields`);
        return undefined;
      }

      // Look up value by field ID (row data is keyed by field ID as string)
      const value = parent.rowData[String(field.id)];
      return value;
    };
  }, [parentStack]);

  // Get available parent field names (for UI dropdown)
  const getParentFieldNames = useMemo(() => {
    return (): string[] => {
      const parent = parentStack[0];
      if (!parent) return [];
      // Include 'id' as a special built-in field, plus all user-defined fields
      return ['id', ...parent.fields.map(f => f.name)];
    };
  }, [parentStack]);

  // Check if parent fields are available
  const hasParentFields = useMemo(() => {
    return (): boolean => {
      const parent = parentStack[0];
      if (!parent) return false;
      return parent.fields.length > 0;
    };
  }, [parentStack]);

  const value: RowDataContextValue = useMemo(() => ({
    rowData,
    rowIndex,
    fields,
    parentStack,
    resolveRowDataVariable,
    getParentFieldNames,
    hasParentFields,
  }), [rowData, rowIndex, fields, parentStack, resolveRowDataVariable, getParentFieldNames, hasParentFields]);

  return (
    <RowDataContext.Provider value={value}>
      {children}
    </RowDataContext.Provider>
  );
}

/**
 * useRowData - Hook to access row data context
 *
 * @returns Row data context, or null if not in a DataBlock
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
 * Backward-compatible return type for useParentRowData hook
 */
export interface ParentRowDataContextValue {
  parentStack: ParentRowData[];
  resolveRowDataVariable: (fieldName: string) => unknown;
  getParentFieldNames: () => string[];
  hasParentFields: () => boolean;
  /** Get the immediate parent's row data */
  getParentRowData: () => ParentRowData | null;
}

/**
 * useParentRowData - Backward-compatible hook for parent row data
 * @deprecated Use useRowData() instead and access parentStack, resolveRowDataVariable, etc.
 *
 * @returns Object with parent row data helpers, or undefined if not in a nested DataBlock
 */
export function useParentRowData(): ParentRowDataContextValue | undefined {
  const context = useContext(RowDataContext);

  if (context === undefined || context.parentStack.length === 0) {
    return undefined;
  }

  return {
    parentStack: context.parentStack,
    resolveRowDataVariable: context.resolveRowDataVariable,
    getParentFieldNames: context.getParentFieldNames,
    hasParentFields: context.hasParentFields,
    getParentRowData: () => context.parentStack[0] || null,
  };
}

/**
 * Hook to check if currently inside a DataBlock
 */
export function useIsInDataBlock(): boolean {
  return useRowData() !== null;
}

/**
 * Hook to check if currently nested inside a parent DataBlock
 */
export function useHasParentDataBlock(): boolean {
  const context = useRowData();
  return context !== null && context.parentStack.length > 0;
}
