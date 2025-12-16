'use client';

/**
 * ParentRowDataContext
 *
 * Tracks the stack of parent row data for nested DataBlocks.
 * Enables child DataBlocks to access {rowData.x} from their parent.
 *
 * This is used when a child DataBlock has a filter like:
 *   parent_id equals {rowData.id}
 *
 * The parent DataBlock wraps its children in ParentRowDataProvider,
 * making the parent's current row data available for variable substitution.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * A single parent's row data with field metadata
 */
interface ParentRowData {
  /** The row data (keyed by field ID as string) */
  rowData: Record<string, unknown>;
  /** Field metadata for field name -> value resolution */
  fields: FieldDTO[];
}

/**
 * Context value for parent row data
 */
interface ParentRowDataContextValue {
  /** Stack of parent row data (closest parent first) */
  parentStack: ParentRowData[];

  /** Get the immediate parent's row data */
  getParentRowData: () => ParentRowData | null;

  /**
   * Resolve {rowData.fieldName} to actual value
   * Looks up the field by name, then gets the value by field ID
   */
  resolveRowDataVariable: (fieldName: string) => unknown;

  /**
   * Get list of available parent field names (for UI dropdown)
   */
  getParentFieldNames: () => string[];
}

const ParentRowDataContext = createContext<ParentRowDataContextValue | undefined>(undefined);

interface ParentRowDataProviderProps {
  children: ReactNode;
  rowData: Record<string, unknown>;
  fields: FieldDTO[];
}

/**
 * Provider that wraps DataBlock children, making parent row data available
 */
export function ParentRowDataProvider({
  children,
  rowData,
  fields,
}: ParentRowDataProviderProps) {
  const parentContext = useContext(ParentRowDataContext);

  // Build new stack with current row data prepended
  const parentStack: ParentRowData[] = [
    { rowData, fields },
    ...(parentContext?.parentStack || []),
  ];

  const getParentRowData = (): ParentRowData | null => {
    return parentStack[0] || null;
  };

  const resolveRowDataVariable = (fieldName: string): unknown => {
    const parent = parentStack[0];
    if (!parent) return undefined;

    // Find field by name
    const field = parent.fields.find(f => f.name === fieldName);
    if (!field) {
      console.warn(`[ParentRowDataContext] Field "${fieldName}" not found in parent fields`);
      return undefined;
    }

    // Look up value by field ID (row data is keyed by field ID as string)
    const value = parent.rowData[String(field.id)];
    return value;
  };

  const getParentFieldNames = (): string[] => {
    const parent = parentStack[0];
    if (!parent) return [];
    return parent.fields.map(f => f.name);
  };

  return (
    <ParentRowDataContext.Provider
      value={{
        parentStack,
        getParentRowData,
        resolveRowDataVariable,
        getParentFieldNames,
      }}
    >
      {children}
    </ParentRowDataContext.Provider>
  );
}

/**
 * Hook to access parent row data context
 *
 * @returns Parent row data context, or undefined if not in a nested DataBlock
 *
 * @example
 * ```tsx
 * function ChildDataBlock() {
 *   const parentContext = useParentRowData();
 *
 *   if (parentContext) {
 *     const parentId = parentContext.resolveRowDataVariable('id');
 *     // Use parentId to filter child data
 *   }
 * }
 * ```
 */
export function useParentRowData(): ParentRowDataContextValue | undefined {
  return useContext(ParentRowDataContext);
}

/**
 * Hook to check if currently nested inside a parent DataBlock
 */
export function useHasParentDataBlock(): boolean {
  const context = useParentRowData();
  return context !== undefined && context.parentStack.length > 0;
}
