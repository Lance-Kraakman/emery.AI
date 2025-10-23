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
  keyColumn,
  textColumn,
  checkboxColumn,
  floatColumn,
  dateColumn
} from 'react-datasheet-grid'
import type { CellProps } from 'react-datasheet-grid'
import 'react-datasheet-grid/dist/style.css' // Base DSG styles
import './datasheet-grid.css' // Custom overrides

import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { FieldValue as DomainFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import type { DSGRow } from '@/app/mappers/dsg-mapper'
import { createEmptyDSGRow, dsgRowToPlainObject } from '@/app/mappers/dsg-mapper'
import { RelationField } from '@/components/tables/fields/RelationField'
import { FileField } from '@/components/tables/fields/FileField'
import { DocumentField } from '@/components/tables/fields/DocumentField'
import { FileTypeDetector } from '@/ddd/domain/tables/services/file-type-detector'
import { createFileArtifact, createDocumentArtifact } from '@/components/chat/types/chat-artifacts'
import { uiStateActions } from '@/stores/ui-state.store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Search, Settings, RefreshCw } from 'lucide-react'
import { useGridState } from '../hooks/useGridState'
import { ColumnHeader } from './ColumnHeader'
import { EditFieldPanel } from './EditFieldPanel'
import { AddColumnButton } from './AddColumnButton'
import { createField, updateField, deleteField } from '@/app/actions/fields'
import { useEmery } from '@/contexts/EmeryStoreProvider'

interface GridHeaderBarProps {
  tableName: string;
  rowCount: number;
  totalRows: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onManageFields: () => void;
  onRefresh: () => void;
}

const GridHeaderBar = ({
  tableName,
  rowCount,
  totalRows,
  searchTerm,
  onSearchChange,
  onManageFields,
  onRefresh
}: GridHeaderBarProps) => (
  <div className="flex items-center justify-between h-[50px] px-4 border border-border border-b-0 bg-background rounded-t-md">
    {/* Left: Table name and row count */}
    <div className="flex items-center gap-3 min-w-0">
      <h2 className="text-base font-semibold truncate">{tableName}</h2>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {rowCount} row{rowCount !== 1 ? 's' : ''}
        {searchTerm && ` (filtered from ${totalRows})`}
      </span>
    </div>

    {/* Center: Search */}
    <div className="flex-1 max-w-md mx-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search in table..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-9 bg-background"
        />
      </div>
    </div>

    {/* Right: Actions */}
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        className="h-9 w-9 p-0"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onManageFields}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Fields
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
)

interface DynamicDataSheetGridProps {
  fields: FieldDTO[];
  rows: DSGRow[];
  organizationId: number;
  tableId: number;
  tableName: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onManageFields: () => void;
  onRefresh: () => void;
  onUpdateRow: (rowId: string, fieldId: number, value: DomainFieldValue) => void;
  onAddRows: (rows: Record<string, any>[]) => Promise<void>;
  onDeleteRow: (rowId: string) => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;  // For infinite scroll
  isLoading?: boolean;
  error?: string | null;
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
const RelationCell = ({ rowData, setRowData, columnData }: CellProps<any, any> & { columnData: { field: FieldDTO; onUpdateRow: Function } }) => {
  const { field, onUpdateRow } = columnData
  const value = rowData?.[field.name]

  return (
    <RelationField
      value={value || []}
      onChange={(newValue) => {
        setRowData({ ...rowData, [field.name]: newValue })
        // Don't call onUpdateRow immediately - let the main handleChange handle it
      }}
      isEditMode={true}
      compact={true}
      relatedTableId={field.relatedTableId}
      multiple={false}
      required={field.required || false}
    />
  )
}

const FileCell = ({ rowData, setRowData, columnData }: CellProps<any, any> & { columnData: { field: FieldDTO; organizationId: number; tableId: number; onUpdateRow: Function } }) => {
  const { field, organizationId, tableId, onUpdateRow } = columnData
  const value = rowData?.[field.name]

  const handleFileOpen = (file: any) => {
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
      value={value || []}
      onChange={(newValue) => {
        setRowData({ ...rowData, [field.name]: newValue })
        // Don't call onUpdateRow immediately - let the main handleChange handle it
      }}
      isEditMode={true}
      compact={true}
      onFileOpen={handleFileOpen}
      maxFiles={10}
    />
  )
}

const DocumentCell = ({ rowData, setRowData, columnData }: CellProps<any, any> & { columnData: { field: FieldDTO; organizationId: number; tableId: number; onUpdateRow: Function } }) => {
  const { field, organizationId, tableId, onUpdateRow } = columnData
  const value = rowData?.[field.name]

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
      value={value || []}
      onChange={(newValue) => {
        setRowData({ ...rowData, [field.name]: newValue })
        // Don't call onUpdateRow immediately - let the main handleChange handle it
      }}
      isEditMode={true}
      compact={true}
      field={field}
      organizationId={organizationId}
      tableId={tableId}
      onDocumentOpen={handleDocumentOpen}
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
  organizationId,
  tableId,
  tableName,
  searchTerm,
  onSearchChange,
  onManageFields,
  onRefresh,
  onUpdateRow,
  onAddRows,
  onDeleteRow,
  onScroll,
  isLoading = false,
  error = null
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
    setEditingField(field)
    setIsEditFieldOpen(true)
  }, [])

  const handleSaveField = useCallback(async (field: FieldDTO, updates: Partial<FieldDTO>) => {
    const result = await updateField({
      tableId,
      fieldName: field.name,
      updates: {
        name: updates.name,
        type: updates.type,
        required: updates.required ?? undefined,
        relatedTableId: updates.relatedTableId ?? undefined
      }
    })

    if (result.success) {
      onRefresh()
    } else {
      alert(result.error || "Failed to update field")
    }
  }, [tableId, onRefresh])

  const handleDeleteField = useCallback(async (fieldName: string) => {
    const result = await deleteField(tableId, fieldName)
    if (result.success) {
      onRefresh()
    } else {
      alert(result.error || "Failed to delete field")
    }
  }, [tableId, onRefresh])

  const handleAddColumn = useCallback(async (data: { name: string; type: any; required: boolean; relatedTableId?: number }) => {
    const result = await createField({
      tableId,
      name: data.name,
      type: data.type,
      required: data.required,
      relatedTableId: data.relatedTableId
    })

    if (result.success) {
      onRefresh()
    } else {
      throw new Error(result.error || "Failed to create field")
    }
  }, [tableId, onRefresh])

  const columns = useMemo(() => {
    // AIDEV-NOTE: Using react-datasheet-grid built-in column types for standard fields
    // Built-in columns handle rendering, editing, formatting, and keyboard navigation automatically

    // ID column - always first, non-editable
    const idColumn = {
      ...keyColumn('id', textColumn),
      title: <span className="font-semibold text-muted-foreground">ID</span>,
      disabled: true,  // Non-editable
      basis: 100,
      grow: 0,
      shrink: 0,
      minWidth: 80,
      headerClassName: 'id-column-header'
    }

    // AIDEV-NOTE: Filter out 'id' field to prevent duplicate with built-in ID column
    const fieldColumns = fields.filter(field => field.name !== 'id').map(field => {
      let columnConfig
      let basis = 150
      let minWidth = 120

      switch (field.type) {
        case 'text':
          // Use built-in textColumn - handles all text editing automatically
          columnConfig = textColumn
          break

        case 'number':
          // Use built-in floatColumn - handles number parsing/formatting
          columnConfig = floatColumn
          basis = 180  // Increased from 150 to show larger numbers
          minWidth = 150  // Increased from 120
          break

        case 'boolean':
          // Use built-in checkboxColumn - handles boolean rendering
          columnConfig = checkboxColumn
          basis = 100
          minWidth = 80
          break

        case 'date':
          // Use built-in dateColumn - handles date formatting
          columnConfig = dateColumn
          break

        case 'relation':
          // Custom component for complex relation selection
          columnConfig = {
            component: RelationCell,
            disableKeys: true,
            columnData: { field, onUpdateRow }
          }
          basis = 250
          minWidth = 150
          break

        case 'file':
          // Custom component for file upload/preview
          columnConfig = {
            component: FileCell,
            disableKeys: true,
            columnData: { field, organizationId, tableId, onUpdateRow }
          }
          basis = 250
          minWidth = 150
          break

        case 'document':
          // Custom component for document management
          columnConfig = {
            component: DocumentCell,
            disableKeys: true,
            columnData: { field, organizationId, tableId, onUpdateRow }
          }
          basis = 250
          minWidth = 150
          break

        default:
          // Fallback to textColumn for unknown types
          columnConfig = textColumn
      }

      return {
        ...keyColumn(field.name, columnConfig),
        title: <ColumnHeader field={field} onEdit={handleEditField} onDelete={handleDeleteField} />,
        disabled: false,
        basis,
        grow: 0,
        shrink: 1,
        minWidth
      }
    })

    // Add column button column - right-most column
    const addColumnCol = {
      ...keyColumn('__add_column', textColumn),
      title: <AddColumnButton onAddColumn={handleAddColumn} availableTables={availableTables} />,
      disabled: true,
      basis: 50,
      grow: 0,
      shrink: 0,
      minWidth: 50
    }

    // Return ID column first, then field columns, then add column button
    return [idColumn, ...fieldColumns, addColumnCol]
  }, [fields, organizationId, tableId, onUpdateRow, handleEditField, handleDeleteField, handleAddColumn, availableTables])

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
              if (newRow[field.name] !== oldRow[field.name]) {
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
            // Call mutation - TanStack Query handles optimistic update
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

  // Show loading state
  if (isLoading) {
    return <LoadingState />
  }

  // Show error state
  if (error) {
    return <ErrorState error={error} />
  }

  // REMOVED: Empty state check - always show grid with header and footer
  // This allows users to access Manage Fields button even when no fields exist

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Custom Header Bar - integrated with grid */}
      <div className="flex-shrink-0">
        <GridHeaderBar
          tableName={tableName}
          rowCount={rows.length}
          totalRows={rows.length}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          onManageFields={onManageFields}
          onRefresh={onRefresh}
        />
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
      />
    </div>
  )
}

export default DynamicDataSheetGrid