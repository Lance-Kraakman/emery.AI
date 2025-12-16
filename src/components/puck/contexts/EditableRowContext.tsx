'use client';

/**
 * EditableRowContext
 *
 * Provides edit mode capabilities for row data in DataBlock.
 * Simplified: Uses form-based collection instead of tracking pendingEdits.
 */

import React, { createContext, useContext, type ReactNode } from 'react';

/** Full editable row context value */
export interface EditableRowContextValue {
  // Edit state
  isEditMode: boolean;
  isSaving: boolean;

  // Table/field context
  tableId: number | null;
  rowId: string | null;

  // Handlers
  cancel: () => void;
  setEditMode: (enabled: boolean) => void;
}

const EditableRowContext = createContext<EditableRowContextValue | undefined>(undefined);

export interface EditableRowProviderProps {
  children: ReactNode;

  // Edit state
  isEditMode: boolean;
  isSaving: boolean;

  // Table/field context
  tableId: number | null;
  rowId: string | null;

  // Handlers
  cancel: () => void;
  setEditMode: (enabled: boolean) => void;
}

/**
 * Provider component that wraps row content when edit mode is enabled.
 * Should be nested inside RowDataProvider.
 */
export function EditableRowProvider({
  children,
  isEditMode,
  isSaving,
  tableId,
  rowId,
  cancel,
  setEditMode,
}: EditableRowProviderProps) {
  return (
    <EditableRowContext.Provider
      value={{
        isEditMode,
        isSaving,
        tableId,
        rowId,
        cancel,
        setEditMode,
      }}
    >
      {children}
    </EditableRowContext.Provider>
  );
}

/**
 * Hook to access editable row context.
 * Returns null if not inside an EditableRowProvider (e.g., DataBlock without edit mode).
 *
 * @example
 * ```tsx
 * function TextField({ fieldId }) {
 *   const rowData = useRowData();           // Always works
 *   const editable = useEditableRow();      // null if not editable
 *
 *   if (editable?.isEditMode) {
 *     // Render input
 *     return <TextInput onChange={(v) => editable.setFieldValue(fieldId, v)} />;
 *   }
 *
 *   // Render display
 *   return <span>{value}</span>;
 * }
 * ```
 */
export function useEditableRow(): EditableRowContextValue | null {
  const context = useContext(EditableRowContext);
  return context ?? null;
}

/**
 * Hook to check if currently in edit mode
 */
export function useIsInEditMode(): boolean {
  const context = useEditableRow();
  return context?.isEditMode ?? false;
}
