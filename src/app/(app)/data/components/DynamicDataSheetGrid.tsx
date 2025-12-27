/**
 * DynamicDataSheetGrid - Spreadsheet-like data grid using react-datasheet-grid
 *
 * ARCHITECTURE:
 * - Uses react-datasheet-grid built-in column types (textColumn, floatColumn, checkboxColumn, dateColumn)
 * - Custom components only for complex types (relation, file, document)
 * - Built-in columns handle rendering, editing, formatting, keyboard navigation automatically
 * - No custom normalization needed for standard types
 *
 * DATA FLOW:
 *
 * ADD ROW:
 * 1. User clicks "+" in grid → autoAddRow creates new row with createEmptyDSGRow()
 * 2. User enters data → handleChange() called
 * 3. Debounced sync (500ms) → onAddRow() creates row on server
 * 4. TanStack Query optimistic update → grid shows real row
 *
 * EDIT ROW:
 * 1. User edits cell → handleChange() called immediately
 * 2. Local state updated for instant UI feedback
 * 3. Debounced sync (500ms) → onUpdateRow() persists to server
 * 4. Built-in columns handle all parsing/formatting automatically
 *
 * COMPLEX FIELDS:
 * - Relation: Custom selector with search/create
 * - File: Upload interface with preview
 * - Document: TipTap editor integration with artifact viewer
 */

"use client"

import React, { useMemo, useCallback, useState } from 'react'
import {
  DataSheetGrid,
} from 'react-datasheet-grid'
import 'react-datasheet-grid/dist/style.css' // Base DSG styles
import './datasheet-grid.css' // Custom overrides

import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { ViewDTO } from '@/app/mappers/view-mapper'
import type { FieldValue as DomainFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import type { DSGRow } from '@/app/mappers/dsg-mapper'
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field'
import { createEmptyDSGRow, dsgRowToPlainObject } from '@/app/mappers/dsg-mapper'
import { RelationField } from '@/components/tables/fields/RelationField'
import { FileField } from '@/components/tables/fields/FileField'
import { DocumentField } from '@/components/tables/fields/DocumentField'
import { EmbeddingField } from '@/components/tables/fields/EmbeddingField'
import { SingleSelectField } from '@/components/tables/fields/SingleSelectField'
import { MultiSelectField } from '@/components/tables/fields/MultiSelectField'
import { JSONField } from '@/components/tables/fields/JSONField'
import { FileTypeDetector } from '@/ddd/domain/tables/services/file-type-detector'
import { createFileArtifact, createDocumentArtifact } from '@/components/chat/types/chat-artifacts'
import { uiStateActions } from '@/stores/ui-state.store'
import { useGridState } from '../hooks/useGridState'
import { useGridColumns } from './grid/useGridColumns'
import { EditFieldPanel } from './EditFieldPanel'
import type { FilterConfig } from '@/lib/types/filters'
import { createField, updateField, deleteField } from '@/app/actions/fields'
import { useEmery } from '@/contexts/EmeryStoreProvider'
import { GridContext, GridHeaderBar, type GridContextValue } from './grid'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import { TooltipProvider } from '@/components/ui/tooltip'

const logger = createDebugLogger('DynamicDataSheetGrid')
import type {
  RelationCellProps,
  FileCellProps,
  DocumentCellProps,
  EmbeddingCellProps,
  SingleSelectCellProps,
  MultiSelectCellProps,
  JSONCellProps
} from './grid/cell-types'

interface DynamicDataSheetGridProps {
  fields: FieldDTO[];
  rows: DSGRow[];
  totalCount?: number;
  organizationId: number;
  tableId: number;
  tableName: string;
  // View props
  currentView?: ViewDTO;
  availableViews?: ViewDTO[];
  onSelectView?: (viewId: number | undefined) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onManageFields: () => void;
  onRefresh: () => void;
  onUpdateRow: (rowId: string, fieldId: number, value: DomainFieldValue) => Promise<any>;
  onAddRows: (rows: Record<string, any>[]) => Promise<void>;
  onDeleteRow: (rowId: string) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;  // For infinite scroll
  isLoading?: boolean;
  error?: string | null;
  // Filter & Sort props
  activeFilters?: FilterConfig[];
  onAddFilter?: (filter: FilterConfig) => void;
  onRemoveFilter?: (index: number) => void;
  onClearFilters?: () => void;
  sortState?: { field?: string, order?: 'asc' | 'desc' };
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onClearSort?: () => void;
}

// Row number component for gutter column
const RowNumberCell = ({ rowIndex }: { rowIndex: number }) => {
  return (
    <div className="flex items-center justify-center text-xs text-muted-foreground font-mono">
      {rowIndex + 1}
    </div>
  )
}

// Direct field components for DataSheetGrid
const RelationCell = ({ rowData, setRowData, columnData, focus, active, stopEditing }: RelationCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object
  const { field } = columnData

  return (
    <RelationField
      value={rowData || []}  // ✅ rowData IS the field value
      onChange={(newValue) => {
        setRowData(newValue)  // ✅ Set field value directly
      }}
      isEditMode={true}
      compact={true}
      relatedTableId={field.relatedTableId ?? undefined}  // Convert null to undefined
      multiple={field.metadata?.multiple === true}
      required={field.required || false}
      focus={focus}
      onClose={() => stopEditing?.({ nextRow: false })}
    />
  )
}

const FileCell = ({ rowData, setRowData, columnData, focus, active, stopEditing }: FileCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object
  const { field, organizationId, tableId } = columnData

  const handleFileOpen = async (file: any) => {
    try {
      const fileName = file.name || file.filename || 'Unknown File'
      const mimeType = file.mimeType || file.contentType

      // Check for temp:// keys - these are pending uploads that can't be previewed yet
      if (file.s3Key?.startsWith('temp://')) {
        alert('This file is pending upload. Please save the row first to enable preview.')
        return
      }

      // Generate presigned download URL from S3
      let fileUrl = file.url || file.downloadUrl

      // If no URL, generate one from s3Key using the download-url API
      if (!fileUrl && file.s3Key) {
        try {
          const response = await fetch(`/api/files/download-url?s3Key=${encodeURIComponent(file.s3Key)}`)
          const result = await response.json()
          if (result.success && result.data?.downloadUrl) {
            fileUrl = result.data.downloadUrl
          } else {
            console.error('Failed to get download URL - API returned:', result)
          }
        } catch (urlError) {
          console.error('Failed to get download URL:', urlError)
        }
      }

      // If we still don't have a fileUrl, show error
      if (!fileUrl) {
        alert('Unable to preview file - no download URL available. The file may not have been uploaded yet.')
        return
      }

      // Create appropriate artifact using LlamaIndex chat-ui system
      if (FileTypeDetector.isTiptapDocument(mimeType)) {
        const documentFieldValue = {
          ...file,
          documentMetadata: {
            title: fileName.replace('.tiptap.json', ''),
            version: 1,
            documentType: 'tiptap' as const
          }
        }

        const documentArtifact = createDocumentArtifact(
          documentFieldValue,
          organizationId,
          tableId,
          field.id || 0,
          'edit',
          fileUrl
        )

        uiStateActions.openArtifact(documentArtifact)
      } else {
        const viewerType = FileTypeDetector.detectViewerType(fileName, mimeType)

        const fileArtifact = createFileArtifact(
          file,
          tableId,
          field.id || 0,
          viewerType,
          fileUrl
        )

        uiStateActions.openArtifact(fileArtifact)
      }

    } catch (error) {
      console.error('Error opening file:', error, file)

      // Fallback: open file externally if we have a URL
      const fileUrl = file.url || file.downloadUrl
      if (fileUrl) {
        window.open(fileUrl, '_blank')
      } else {
        alert('Unable to open file - no URL available')
      }
    }
  }

  return (
    <FileField
      value={rowData || []}  // ✅ rowData IS the field value
      onChange={(newValue) => {
        setRowData(newValue)  // ✅ Set field value directly
      }}
      isEditMode={true}
      compact={true}
      onFileOpen={handleFileOpen}
      maxFiles={10}
      // Upload context for S3 upload
      organizationId={organizationId}
      tableId={tableId}
      fieldId={field.id}
      focus={focus}
      onClose={() => stopEditing?.({ nextRow: false })}
    />
  )
}

const DocumentCell = ({ rowData, setRowData, columnData, rowIndex, focus, active, stopEditing }: DocumentCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object
  const { field, organizationId, tableId, data } = columnData
  const rowId = data[rowIndex]?.id  // Get rowId from data array using rowIndex

  const handleDocumentOpen = (file: any) => {
    try {
      const fileName = file.name || file.filename || 'Unknown File'
      const fileUrl = file.url || file.downloadUrl
      const mimeType = file.mimeType || file.contentType

      // Create appropriate artifact using LlamaIndex chat-ui system
      if (FileTypeDetector.isTiptapDocument(mimeType)) {
        const documentFieldValue = {
          ...file,
          documentMetadata: {
            title: fileName.replace('.tiptap.json', ''),
            version: 1,
            documentType: 'tiptap' as const
          }
        }

        const documentArtifact = createDocumentArtifact(
          documentFieldValue,
          organizationId,
          tableId,
          field.id || 0,
          'edit',
          fileUrl
        )

        uiStateActions.openArtifact(documentArtifact)
      } else {
        const viewerType = FileTypeDetector.detectViewerType(fileName, mimeType)

        const fileArtifact = createFileArtifact(
          file,
          tableId,
          field.id || 0,
          viewerType,
          fileUrl
        )

        uiStateActions.openArtifact(fileArtifact)
      }

    } catch (error) {
      console.error('Error opening document:', error, file)

      // Fallback: open file externally if we have a URL
      const fileUrl = file.url || file.downloadUrl
      if (fileUrl) {
        window.open(fileUrl, '_blank')
      } else {
        alert('Unable to open document - no URL available')
      }
    }
  }

  return (
    <DocumentField
      value={rowData || []}  // ✅ rowData IS the field value
      onChange={(newValue) => {
        setRowData(newValue)  // ✅ Set field value directly
      }}
      isEditMode={true}
      compact={true}
      field={field}
      organizationId={organizationId}
      tableId={tableId}
      rowId={rowId}
      onDocumentOpen={handleDocumentOpen}
      focus={focus}
      onClose={() => stopEditing?.({ nextRow: false })}
    />
  )
}

const EmbeddingCell = ({ rowData, columnData }: EmbeddingCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object

  return (
    <EmbeddingField
      value={rowData}  // ✅ rowData IS the field value
      isEditMode={false}  // Read-only for now
      compact={true}
    />
  )
}

const SingleSelectCell = ({ rowData, setRowData, columnData }: SingleSelectCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object
  // rowData = field value (e.g., 1, null, "")
  // setRowData(newValue) = updates the field value
  const { field, onFieldUpdate } = columnData
  const options = (field.metadata?.options as SelectOption[] | undefined) || []

  return (
    <SingleSelectField
      value={rowData}  // ✅ rowData IS the field value
      onChange={(newValue) => {
        console.log('[SingleSelectCell] onChange', {
          fieldName: field.name,
          fieldId: field.id,
          oldValue: rowData,
          newValue
        });
        setRowData(newValue)  // ✅ Set field value directly
      }}
      options={options}
      isEditMode={true}
      compact={true}
      field={field}
      onFieldUpdate={onFieldUpdate}
    />
  )
}

const MultiSelectCell = ({ rowData, setRowData, columnData }: MultiSelectCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object
  // rowData = field value (e.g., [1, 2], [], null)
  // setRowData(newValue) = updates the field value
  const { field, onFieldUpdate } = columnData
  const options = (field.metadata?.options as SelectOption[] | undefined) || []
  const maxSelections = field.metadata?.maxSelections as number | undefined

  return (
    <MultiSelectField
      value={rowData || []}  // ✅ rowData IS the field value (array)
      onChange={(newValue) => {
        console.log('[MultiSelectCell] onChange', {
          fieldName: field.name,
          fieldId: field.id,
          oldValue: rowData,
          newValue
        })
        setRowData(newValue)  // ✅ Set field value directly
      }}
      options={options}
      maxSelections={maxSelections}
      isEditMode={true}  // ✅ Enable interactive mode for editing
      compact={true}
      field={field}
      onFieldUpdate={onFieldUpdate}
    />
  )
}

const JSONCell = ({ rowData, setRowData, columnData, focus }: JSONCellProps) => {
  // AIDEV-NOTE: keyColumn passes the FIELD VALUE as rowData, not the full row object
  // rowData = field value (JSON object/array or null)
  // setRowData(newValue) = updates the field value

  return (
    <JSONField
      value={rowData}  // ✅ rowData IS the field value
      onChange={(newValue) => {
        setRowData(newValue)  // ✅ Set field value directly
      }}
      isEditMode={true}
      compact={true}
      focus={focus}  // ✅ Pass focus for keyboard shortcut support
    />
  )
}

// Loading state component
const LoadingState = () => (
  <div className="flex items-center justify-center h-32 text-muted-foreground">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current mr-2"></div>
    Loading data...
  </div>
)

// Error state component
const ErrorState = ({ error, onRetry }: { error: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center h-32 text-red-600 dark:text-red-400">
    <div className="text-sm mb-2">⚠️ {error}</div>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/20 rounded hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
      >
        Retry
      </button>
    )}
  </div>
)

export function DynamicDataSheetGrid({
  fields,
  rows,
  totalCount,
  organizationId,
  tableId,
  tableName,
  currentView,
  availableViews = [],
  onSelectView,
  searchTerm,
  onSearchChange,
  onManageFields,
  onRefresh,
  onUpdateRow,
  onAddRows,
  onDeleteRow,
  onScroll,
  isLoading = false,
  error = null,
  activeFilters,
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  sortState,
  onSort,
  onClearSort
}: DynamicDataSheetGridProps) {
  // Use custom hook for grid state management
  const { state, dispatch } = useGridState(rows)

  // State for field editing
  const [editingField, setEditingField] = useState<FieldDTO | null>(null)
  const [isEditFieldOpen, setIsEditFieldOpen] = useState(false)

  // Get available tables for relation fields
  const { data: emeryData } = useEmery()
  const availableTables = emeryData?.databases?.flatMap(db => db.tables) || []

  // Handlers for field management
  const handleEditField = useCallback((field: FieldDTO) => {
    console.log('[DynamicDataSheetGrid] handleEditField CALLED', { fieldName: field.name, fieldId: field.id })
    logger.debug('handleEditField called', { fieldName: field.name, fieldId: field.id })
    setEditingField(field)
    setIsEditFieldOpen(true)
    logger.debug('Edit field dialog opened', { isOpen: true })
  }, [])

  const handleSaveField = useCallback(async (field: FieldDTO, updates: Partial<FieldDTO>) => {
    console.log('[DynamicDataSheetGrid] handleSaveField CALLED', { fieldName: field.name, updates })
    logger.debug('handleSaveField called', { fieldName: field.name, updates })
    const result = await updateField({
      tableId,
      fieldName: field.name,
      updates: {
        name: updates.name,
        type: updates.type,
        required: updates.required ?? undefined,
        relatedTableId: updates.relatedTableId ?? undefined,
        metadata: updates.metadata ?? undefined
      }
    })

    console.log('[DynamicDataSheetGrid] updateField RESULT', { success: result.success, error: result.error })
    logger.debug('updateField result', { success: result.success, error: result.error })
    if (result.success) {
      logger.debug('Field updated successfully, refreshing data')
      onRefresh()
    } else {
      logger.error('Failed to update field', result.error)
      alert(result.error || "Failed to update field")
    }
  }, [tableId, onRefresh])

  const handleDeleteField = useCallback(async (fieldName: string) => {
    console.log('[DynamicDataSheetGrid] handleDeleteField CALLED', { tableId, fieldName })
    logger.debug('handleDeleteField called', { tableId, fieldName })
    const result = await deleteField(tableId, fieldName)
    console.log('[DynamicDataSheetGrid] deleteField RESULT', { success: result.success, error: result.error })
    logger.debug('deleteField result', { success: result.success, error: result.error })
    if (result.success) {
      console.log('[DynamicDataSheetGrid] Delete successful, calling onRefresh')
      logger.debug('Field deleted successfully, refreshing data')
      onRefresh()
    } else {
      console.log('[DynamicDataSheetGrid] Delete FAILED', result.error)
      logger.error('Failed to delete field', result.error)
      alert(result.error || "Failed to delete field")
    }
  }, [tableId, onRefresh])

  const handleAddColumn = useCallback(async (data: { name: string; type: any; required: boolean; relatedTableId?: number; metadata?: Record<string, any> }) => {
    const result = await createField({
      tableId,
      name: data.name,
      type: data.type,
      required: data.required,
      relatedTableId: data.relatedTableId,
      metadata: data.metadata
    })

    if (result.success) {
      onRefresh()
    } else {
      throw new Error(result.error || "Failed to create field")
    }
  }, [tableId, onRefresh])

  const handleFieldUpdate = useCallback(async (field: FieldDTO, updates: Partial<FieldDTO>) => {
    console.log('[DynamicDataSheetGrid] handleFieldUpdate called', {
      fieldName: field.name,
      fieldType: field.type,
      hasMetadata: !!updates.metadata,
      optionCount: Array.isArray(updates.metadata?.options) ? updates.metadata.options.length : 0
    });

    const result = await updateField({
      tableId,
      fieldName: field.name,
      updates: {
        name: updates.name,
        type: updates.type,
        required: updates.required ?? undefined,
        relatedTableId: updates.relatedTableId ?? undefined,
        metadata: updates.metadata ?? undefined
      }
    })

    if (result.success) {
      console.log('[DynamicDataSheetGrid] Field updated successfully', {
        fieldName: field.name
      });
      onRefresh()
    } else {
      console.error('[DynamicDataSheetGrid] Field update failed', {
        fieldName: field.name,
        error: result.error
      });
      throw new Error(result.error || "Failed to update field")
    }
  }, [tableId, onRefresh])

  // Use custom hook for column building
  console.log('[DynamicDataSheetGrid] Calling useGridColumns with handlers', {
    hasHandleEditField: typeof handleEditField === 'function',
    hasHandleDeleteField: typeof handleDeleteField === 'function',
    fieldCount: fields?.length
  })

  const columns = useGridColumns({
    fields,
    fieldMappings: currentView?.fieldMappings,
    currentView,
    organizationId,
    tableId,
    availableTables,
    data: state.data,
    onUpdateRow,
    onEditField: handleEditField,
    onDeleteField: handleDeleteField,
    onAddColumn: handleAddColumn,
    onFieldUpdate: handleFieldUpdate,
    onSort,
    onClearSort,
    RelationCell,
    FileCell,
    DocumentCell,
    EmbeddingCell,
    SingleSelectCell,
    MultiSelectCell,
    JSONCell,
  })

  // Create a stable fingerprint of field structure - only changes when fields are added/removed
  // This is more stable than columns.length which caused jitter during edits
  const fieldsFingerprint = useMemo(() => {
    return fields.map(f => f.id).sort().join(',')
  }, [fields])

  /**
   * Event-driven onChange - uses operations parameter for precise change detection
   * No debouncing - mutations fire immediately, TanStack Query handles optimistic updates
   */
  const handleChange = useCallback((
    newData: Record<string, any>[],
    operations: Array<{type: 'UPDATE' | 'DELETE' | 'CREATE', fromRowIndex: number, toRowIndex: number}>
  ) => {
    const dsgRows = newData as DSGRow[]
    const oldData = state.data

    // AIDEV-NOTE: Use operations parameter instead of manual diffing
    // react-datasheet-grid provides operation details: CREATE, UPDATE, DELETE

    operations.forEach(operation => {
      switch (operation.type) {
        case 'CREATE': {
          // New rows added
          const newRows = dsgRows.slice(operation.fromRowIndex, operation.toRowIndex)

          // Ensure all new rows have IDs
          newRows.forEach(row => {
            if (!row.id) {
              console.warn('[DynamicDataSheetGrid] Row missing ID, generating:', row)
              row.id = crypto.randomUUID()
            }
          })

          // Dispatch all row additions to local state
          newRows.forEach(row => dispatch({ type: 'ROW_ADDED', payload: row }))

          // Single batch call for all new rows
          onAddRows(newRows.map(row => dsgRowToPlainObject(row))).catch(err => {
            console.error('Failed to add rows:', err)
            // TanStack Query will rollback optimistic update on error
          })
          break
        }

        case 'DELETE': {
          // Rows deleted - indices refer to OLD data
          const deletedRows = oldData.slice(operation.fromRowIndex, operation.toRowIndex)

          deletedRows.forEach(row => {
            dispatch({ type: 'ROW_DELETED', payload: row.id })
            onDeleteRow(row.id)
          })
          break
        }

        case 'UPDATE': {
          // Cells updated - compare old and new data for changed cells
          const changes: Array<{ rowId: string; fieldId: number; value: any }> = []

          for (let i = operation.fromRowIndex; i < operation.toRowIndex; i++) {
            const newRow = dsgRows[i]
            const oldRow = oldData[i]

            if (!newRow?.id || !oldRow?.id) continue

            // Compare each field
            fields.forEach(field => {
              const hasChanged = newRow[field.name] !== oldRow[field.name];

              // Log for single-select fields to diagnose update issues
              if (field.type === 'single-select' && (hasChanged || newRow[field.name] !== undefined)) {
                console.log('[handleChange] Single-select field check', {
                  fieldName: field.name,
                  fieldId: field.id,
                  oldValue: oldRow[field.name],
                  newValue: newRow[field.name],
                  hasChanged,
                  strictEqual: newRow[field.name] === oldRow[field.name]
                });
              }

              if (hasChanged) {
                console.log('[handleChange] ✅ Change detected, adding to changes array', {
                  fieldName: field.name,
                  fieldId: field.id,
                  value: newRow[field.name]
                });
                changes.push({
                  rowId: newRow.id,
                  fieldId: field.id,
                  value: newRow[field.name]
                })
              }
            })
          }

          changes.forEach(change => {
            dispatch({ type: 'CELL_CHANGED', payload: change })
            onUpdateRow(change.rowId, change.fieldId, change.value)
          })
          break
        }
      }
    })

  }, [state.data, fields, onAddRows, onUpdateRow, onDeleteRow, dispatch])

  const handleDeleteRow = useCallback((rowId: string) => {
    if (!state.isSyncing) {
      dispatch({ type: 'START_SYNC' })
      onDeleteRow(rowId)
    }
  }, [onDeleteRow, state.isSyncing])

  // Show error state (but keep table visible during loading/search)
  if (error) {
    return <ErrorState error={error} />
  }

  // REMOVED: Empty state check - always show grid with header and footer
  // This allows users to access Manage Fields button even when no fields exist

  // Create grid context value from props
  const gridValue: GridContextValue = {
    tableName,
    tableId,
    organizationId,
    fields,
    rows,
    totalCount: totalCount ?? 0,
    isLoading,
    error,
    currentView,
    availableViews,
    onSelectView: onSelectView ?? (() => {}),
    fieldMappings: currentView?.fieldMappings,
    // onFieldMappingsChange will be added when we create the update hook
    searchTerm,
    onSearchChange,
    activeFilters: activeFilters ?? [],
    onAddFilter: onAddFilter ?? (() => {}),
    onRemoveFilter: onRemoveFilter ?? (() => {}),
    onClearFilters: onClearFilters ?? (() => {}),
    sortState: sortState ?? {},
    onSort: onSort ?? (() => {}),
    onClearSort: onClearSort ?? (() => {}),
    onManageFields,
    onRefresh,
    onUpdateRow,
    onAddRows,
    onDeleteRow,
    onScroll
  }

  return (
    <TooltipProvider delayDuration={300}>
      <GridContext.Provider value={gridValue}>
        <div className="h-full flex flex-col overflow-hidden">
          {/* Custom Header Bar - integrated with grid */}
          <div className="flex-shrink-0">
            <GridHeaderBar />
          </div>

          {/* DataSheetGrid - fills remaining space, includes built-in "+ Add" button */}
          <div className="flex-1 min-h-0 border border-t-0 border-border rounded-b-md overflow-hidden dsg-grid-wrapper">
            {fields.length === 0 ? (
              // Empty state with access to header controls
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-background">
                <div className="text-sm mb-2">No fields defined</div>
                <div className="text-xs">Use the settings menu above to add fields</div>
              </div>
            ) : (
              <DataSheetGrid
                key={`grid-${tableId}-${currentView?.id || 'default'}-${fieldsFingerprint}`}  // Include field IDs to remount on field add/remove (but not on cell edits)
                value={state.data}
                onChange={handleChange}
                columns={columns}
                createRow={() => createEmptyDSGRow(fields)}  // ✅ CRITICAL: Preserves IDs
                duplicateRow={({ rowData }) => ({ ...rowData, id: crypto.randomUUID() })}  // Enable context menu with row duplication
                lockRows={false}
                rowKey="id"
                rowHeight={30}  // Increased to 30 for better readability
                headerRowHeight={32}  // Reduced from 50 (proportionally smaller)
                autoAddRow={false}
                gutterColumn={{   // Enable gutter for row numbers
                  basis: 60,
                  component: RowNumberCell
                }}
                onScroll={onScroll}  // Enable infinite scroll
                style={{ height: '100%' }}  // CRITICAL: Create scrollable container for mouse wheel events
                className="datasheet-grid"
              />
            )}
          </div>

          {/* Edit Field Dialog */}
          <EditFieldPanel
            field={editingField}
            isOpen={isEditFieldOpen}
            onClose={() => setIsEditFieldOpen(false)}
            onSave={handleSaveField}
            availableTables={availableTables}
            tableId={tableId}
          />
        </div>
      </GridContext.Provider>
    </TooltipProvider>
  )
}

export default DynamicDataSheetGrid