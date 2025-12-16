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
 * 3. User configures document ID source (page variable or static)
 */

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, AlertCircle, Settings } from 'lucide-react';
import { TipTapDocumentEditor } from '@/components/shared/TipTapDocumentEditor';
import type { EditorBlockProps } from './types';

/** Regex to extract variable name from {params.varName} format */
const PARAMS_VAR_REGEX = /\{params\.(\w+)\}/;

/** Extract variable name from {params.varName} format and get value from URL */
function resolveDocumentId(
  documentIdSource: EditorBlockProps['documentIdSource'],
  searchParams: URLSearchParams
): string | undefined {
  if (!documentIdSource?.value) {
    return undefined;
  }

  if (documentIdSource.valueType === 'static') {
    return documentIdSource.value;
  }

  // Extract variable name from {params.varName}
  const match = documentIdSource.value.match(PARAMS_VAR_REGEX);
  if (match?.[1]) {
    return searchParams.get(match[1]) || undefined;
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
  const searchParams = useSearchParams();

  // Resolve document ID from source configuration
  const documentId = resolveDocumentId(documentIdSource, searchParams);

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
          Select how to get the document ID (page variable or static value).
        </p>
      </div>
    );
  }

  // No document selected (waiting for URL param)
  if (!documentId) {
    // Extract the variable name for display
    const match = documentIdSource.value.match(PARAMS_VAR_REGEX);
    const varName = match?.[1] || 'documentId';

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
              Waiting for <code className="bg-muted px-1 rounded">{varName}</code> in URL parameters
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
