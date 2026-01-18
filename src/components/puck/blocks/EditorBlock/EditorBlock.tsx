'use client';

/**
 * EditorBlock - Puck block component for editing documents
 *
 * Renders different editor types based on configuration.
 * Currently supports: document (TipTap)
 * Future: pdf, image, code, markdown, etc.
 *
 * Configuration flow:
 * 1. User selects a view (resolveData fetches tableId, organizationId)
 * 2. User selects a document field from the view
 * 3. User configures document ID source (page variable, parent row, or static)
 */

import React from 'react';
import { FileText, AlertCircle, Settings } from 'lucide-react';
import { TipTapDocumentEditor } from '@/components/shared/TipTapDocumentEditor';
import { useStateContext, type StateContextValue } from '../../contexts/StateContext';
import { useRowData, type RowDataContextValue } from '../../contexts/RowDataContext';
import type { EditorBlockProps, DocumentIdSourceConfig } from './types';

/** Regex to extract variable name from {{state.varName}} format */
const STATE_VAR_REGEX = /\{\{state\.(\w+)\}\}/;

/** Regex to extract field name from {{rowData.fieldName}} format */
const ROW_DATA_VAR_REGEX = /\{\{rowData\.(\w+)\}\}/;

/** Parse variable name from {{state.varName}} format */
function parseStateVariable(value: string): string {
  const match = value.match(STATE_VAR_REGEX);
  return match?.[1] || '';
}

/** Parse field name from {{rowData.fieldName}} format */
function parseRowDataVariable(value: string): string {
  const match = value.match(ROW_DATA_VAR_REGEX);
  return match?.[1] || '';
}

/**
 * Resolve document ID from source configuration
 * Supports: static value, state variable, or parent row field
 */
function resolveDocumentId(
  documentIdSource: DocumentIdSourceConfig | undefined,
  stateContext: StateContextValue | undefined,
  rowDataContext: RowDataContextValue | null
): string | undefined {
  if (!documentIdSource?.value) {
    return undefined;
  }

  // Static value - return directly
  if (documentIdSource.valueType === 'static') {
    return documentIdSource.value;
  }

  // State variable - resolve from state context
  if (documentIdSource.valueType === 'variable') {
    const varName = parseStateVariable(documentIdSource.value);
    if (varName && stateContext) {
      const value = stateContext.getValue(varName);
      return value !== undefined && value !== null ? String(value) : undefined;
    }
    return undefined;
  }

  // Parent row field - resolve from row data context
  if (documentIdSource.valueType === 'parentRow') {
    const fieldName = parseRowDataVariable(documentIdSource.value);
    if (fieldName && rowDataContext) {
      const value = rowDataContext.resolveRowDataVariable(fieldName);
      return value !== undefined && value !== null ? String(value) : undefined;
    }
    return undefined;
  }

  return undefined;
}

export function EditorBlock({
  editorType,
  viewId,
  fieldId,
  documentIdSource,
  _tableId,
  _organizationId,
  height = '500px',
  allowEdit = true,
  autoSave = true,
  autoSaveInterval = 3000,
}: EditorBlockProps) {
  // Get state context for {state.varName} resolution
  const stateContext = useStateContext();

  // Get row data context for {rowData.fieldName} resolution
  const rowDataContext = useRowData();

  // Resolve document ID from source configuration
  const documentId = resolveDocumentId(documentIdSource, stateContext, rowDataContext);

  // Configuration missing state - no view selected
  if (!viewId) {
    return (
      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 p-8"
        style={{ height }}
      >
        <Settings className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Select a data source</p>
        <p className="text-xs text-muted-foreground/60 mt-2 max-w-xs text-center">
          Choose a view in the block settings to configure the document editor.
        </p>
      </div>
    );
  }

  // Configuration missing state - view selected but no field
  if (!fieldId || !_tableId || !_organizationId) {
    return (
      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 p-8"
        style={{ height }}
      >
        <Settings className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Select a document field</p>
        <p className="text-xs text-muted-foreground/60 mt-2 max-w-xs text-center">
          Choose a document field from the view to edit.
        </p>
      </div>
    );
  }

  // No document ID configured or available
  if (!documentIdSource?.value) {
    return (
      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 p-8"
        style={{ height }}
      >
        <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Configure document ID source</p>
        <p className="text-xs text-muted-foreground/60 mt-2 max-w-xs text-center">
          Select how to get the document ID (page variable, parent row, or static value).
        </p>
      </div>
    );
  }

  // No document selected (waiting for value resolution)
  if (!documentId) {
    // Extract the variable/field name for display
    const varName = parseStateVariable(documentIdSource.value) || 'documentId';
    const fieldName = parseRowDataVariable(documentIdSource.value) || 'field';

    return (
      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 p-8"
        style={{ height }}
      >
        <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">No document selected</p>
        <p className="text-xs text-muted-foreground/60 mt-2 max-w-xs text-center">
          {documentIdSource.valueType === 'variable' ? (
            <>
              Waiting for <code className="bg-muted px-1 rounded">{varName}</code> state variable
            </>
          ) : documentIdSource.valueType === 'parentRow' ? (
            <>
              Waiting for <code className="bg-muted px-1 rounded">{fieldName}</code> from parent row
            </>
          ) : (
            'Please configure a document ID in the block settings.'
          )}
        </p>
      </div>
    );
  }

  // Render appropriate editor based on type
  switch (editorType) {
    case 'document':
      return (
        <div style={{ height }} className="rounded-xl overflow-hidden">
          <TipTapDocumentEditor
            documentId={documentId}
            organizationId={_organizationId}
            tableId={_tableId}
            fieldId={fieldId}
            allowEdit={allowEdit}
            showToolbar={allowEdit}
            autoSave={autoSave}
            autoSaveInterval={autoSaveInterval}
            height="100%"
          />
        </div>
      );

    default:
      return (
        <div
          className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/20 p-8"
          style={{ height }}
        >
          <AlertCircle className="w-12 h-12 text-amber-500/60 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">
            Editor type &quot;{editorType}&quot; not implemented
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Currently only &quot;document&quot; type is supported.
          </p>
        </div>
      );
  }
}

export default EditorBlock;
