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

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react'
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
import { createEmptyDSGRow, dsgRowToPlainObject, hasRowChanged, getChangedFields } from '@/app/mappers/dsg-mapper'
import { RelationField } from '@/components/tables/fields/RelationField'
import { FileField } from '@/components/tables/fields/FileField'
import { DocumentField } from '@/components/tables/fields/DocumentField'
import { FileTypeDetector } from '@/ddd/domain/tables/services/file-type-detector'
import { createFileArtifact, createDocumentArtifact } from '@/components/chat/types/chat-artifacts'
import { uiStateActions } from '@/stores/ui-state.store'

interface DynamicDataSheetGridProps {
  fields: FieldDTO[];
  rows: DSGRow[];
  organizationId: number;
  tableId: number;
  onUpdateRow: (rowId: string, fieldId: number, value: DomainFieldValue) => void;
  onAddRow: (data?: Record<string, any>) => Promise<void>;
  onDeleteRow: (rowId: string) => void;
  isLoading?: boolean;
  error?: string | null;
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
  onUpdateRow, 
  onAddRow, 
  onDeleteRow,
  isLoading = false,
  error = null
}: DynamicDataSheetGridProps) {
  const [localData, setLocalData] = useState<DSGRow[]>(rows)
  const [isUpdating, setIsUpdating] = useState(false)
  const [containerHeight, setContainerHeight] = useState(400)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local data with props
  useEffect(() => {
    setLocalData(rows)
  }, [rows])

  // Update container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerHeight(rect.height)
      }
    }

    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  const columns = useMemo(() => {
    // AIDEV-NOTE: Using react-datasheet-grid built-in column types for standard fields
    // Built-in columns handle rendering, editing, formatting, and keyboard navigation automatically
    return fields.map(field => {
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
        title: field.name,
        disabled: false,
        basis,
        grow: 0,
        shrink: 1,
        minWidth
      }
    })
  }, [fields, organizationId, tableId, onUpdateRow])

  // Simplified onChange following react-datasheet-grid best practices
  const handleChange = useCallback((newData: Record<string, any>[]) => {
    // Cast to DSGRow for type safety
    const dsgRows = newData as DSGRow[]

    // Update local state immediately for responsive UI (optimistic update)
    setLocalData(dsgRows)

    // Debounce server sync to avoid excessive API calls
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      syncChangesToServer(dsgRows)
    }, 500)
  }, [])

  // Sync changes to server - separated for clarity
  const syncChangesToServer = useCallback(async (currentData: DSGRow[]) => {
    if (isUpdating) return
    setIsUpdating(true)

    try {
      // Track existing rows from server (source of truth)
      const existingRowIds = new Set(rows.map(r => r.id))
      const oldDataMap = new Map(rows.map(row => [row.id, row]))

      for (const row of currentData) {
        // Guard against invalid rows
        if (!row?.id) {
          console.warn('[DynamicDataSheetGrid] Skipping row without ID:', row)
          continue
        }

        // Check if row exists on server (robust pattern - no string matching)
        if (!existingRowIds.has(row.id)) {
          // NEW ROW - not in server data, create it
          try {
            await onAddRow(dsgRowToPlainObject(row))
          } catch (error) {
            console.error('Failed to create row:', error)
            // Don't block other operations on failure
          }
        } else {
          // EXISTING ROW - check for changes
          const oldRow = oldDataMap.get(row.id)
          if (oldRow && hasRowChanged(row, oldRow)) {
            const changes = getChangedFields(row, oldRow, fields)

            for (const change of changes) {
              try {
                await onUpdateRow(row.id, change.fieldId, change.value)
              } catch (error) {
                console.error(`Failed to update field ${change.fieldId}:`, error)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error syncing data to server:', error)
      // Revert to server data on fatal error
      setLocalData(rows)
    } finally {
      setIsUpdating(false)
    }
  }, [rows, fields, onUpdateRow, onAddRow, isUpdating])

  const handleAddRow = useCallback(() => {
    if (!isUpdating) {
      // Create new row with defaults and add to grid
      const newRow = createEmptyDSGRow(fields)
      setLocalData([...localData, newRow])
      // onChange will handle server sync automatically
    }
  }, [isUpdating, fields, localData])

  const handleDeleteRow = useCallback((rowId: string) => {
    if (!isUpdating) {
      onDeleteRow(rowId)
    }
  }, [onDeleteRow, isUpdating])

  // Show loading state
  if (isLoading) {
    return <LoadingState />
  }

  // Show error state
  if (error) {
    return <ErrorState error={error} />
  }

  // Show empty state when no fields exist
  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground border border-border rounded-md">
        <div className="text-sm mb-2">No fields defined</div>
        <div className="text-xs">Add fields using the Manage Fields button to start entering data</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* DataSheetGrid - fills remaining space */}
      <div ref={containerRef} className="flex-1 border border-border rounded-md overflow-hidden">
        <DataSheetGrid
          value={localData}
          onChange={handleChange}
          columns={columns}
          lockRows={false}
          rowKey="id"
          height={containerHeight}
          rowHeight={45}
          headerRowHeight={50}
          autoAddRow={false}
          gutterColumn={false}  // Disable gutter column to show only data columns
          className="datasheet-grid h-full"
        />
      </div>

      {/* Status indicator */}
      {isUpdating && (
        <div className="flex justify-start items-center px-4 py-2 border-t border-border flex-shrink-0">
          <div className="text-xs text-muted-foreground">
            Saving changes...
          </div>
        </div>
      )}
    </div>
  )
}

export default DynamicDataSheetGrid