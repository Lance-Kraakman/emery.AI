import { useMemo } from 'react'
import {
  keyColumn,
  textColumn,
  floatColumn,
  checkboxColumn,
  dateColumn,
  type CellComponent,
} from 'react-datasheet-grid'
import { ColumnHeader } from '../ColumnHeader'
import { AddColumnButton } from '../AddColumnButton'
import { getVisibleFields } from '@/components/puck/lib/field-visibility-utils'
import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { ViewDTO } from '@/app/mappers/view-mapper'
import type { TableDTO } from '@/app/mappers/table-mapper'
import type { DSGRow } from '@/app/mappers/dsg-mapper'
import type { FieldValue as DomainFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field'
import type {
  RelationValue,
  RelationCellConfiguration,
  FileValue,
  FileCellConfiguration,
  DocumentValue,
  DocumentCellConfiguration,
  EmbeddingValue,
  EmbeddingCellConfiguration,
  SingleSelectValue,
  SingleSelectCellConfiguration,
  MultiSelectValue,
  MultiSelectCellConfiguration,
} from './cell-types'
import { TextCell } from './cells/TextCell'
import { NumberCell } from './cells/NumberCell'
import { DateCell } from './cells/DateCell'
import {
  ID_COLUMN_WIDTH,
  ADD_COLUMN_BUTTON_WIDTH,
  SMALL_COLUMN_BASIS,
  SMALL_COLUMN_MIN_WIDTH,
  DEFAULT_COLUMN_BASIS,
  DEFAULT_COLUMN_MIN_WIDTH,
  MEDIUM_COLUMN_BASIS,
  MEDIUM_COLUMN_MIN_WIDTH,
  SELECT_COLUMN_BASIS,
  SELECT_COLUMN_MIN_WIDTH,
  WIDE_COLUMN_BASIS,
  WIDE_COLUMN_MIN_WIDTH,
  MULTI_SELECT_MIN_WIDTH,
  COLUMN_GROW,
  COLUMN_SHRINK,
  FIXED_COLUMN_SHRINK
} from './grid-constants'

interface UseGridColumnsParams {
  fields: FieldDTO[]
  fieldMappings?: ViewDTO['fieldMappings']
  currentView?: ViewDTO  // For conditional ID column visibility
  organizationId: number
  tableId: number
  availableTables: TableDTO[]
  data: DSGRow[]  // Row data array for document cell to access rowId
  onUpdateRow: (rowId: string, fieldId: number, value: DomainFieldValue) => Promise<any>
  onEditField: (field: FieldDTO) => void
  onDeleteField: (fieldName: string) => void
  onAddColumn: (data: { name: string; type: FieldType; required: boolean; relatedTableId?: number; metadata?: Record<string, any> }) => Promise<void>
  onFieldUpdate: (field: FieldDTO, updates: Partial<FieldDTO>) => Promise<void>
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  onClearSort?: () => void
  // Custom cell components for complex field types (now properly typed)
  RelationCell?: CellComponent<RelationValue, RelationCellConfiguration>
  FileCell?: CellComponent<FileValue, FileCellConfiguration>
  DocumentCell?: CellComponent<DocumentValue, DocumentCellConfiguration>
  EmbeddingCell?: CellComponent<EmbeddingValue, EmbeddingCellConfiguration>
  SingleSelectCell?: CellComponent<SingleSelectValue, SingleSelectCellConfiguration>
  MultiSelectCell?: CellComponent<MultiSelectValue, MultiSelectCellConfiguration>
}

/**
 * Custom hook for building data grid columns
 *
 * Handles column configuration for different field types:
 * - Built-in columns (text, number, boolean, date) use react-datasheet-grid built-ins
 * - Custom columns (relation, file, document) use custom cell components
 *
 * @returns Array of column configurations for react-datasheet-grid
 */
export function useGridColumns({
  fields,
  fieldMappings,
  currentView,
  organizationId,
  tableId,
  availableTables,
  data,
  onUpdateRow,
  onEditField,
  onDeleteField,
  onAddColumn,
  onFieldUpdate,
  onSort,
  onClearSort,
  RelationCell,
  FileCell,
  DocumentCell,
  EmbeddingCell,
  SingleSelectCell,
  MultiSelectCell,
}: UseGridColumnsParams) {
  console.log('[USE GRID COLUMNS] Hook called', {
    fieldsCount: fields.length,
    fieldMappingsCount: fieldMappings?.length || 0,
    fieldMappings
  })

  return useMemo(() => {
    console.log('[USE GRID COLUMNS] useMemo executing')
    // AIDEV-NOTE: Using react-datasheet-grid built-in column types for standard fields
    // Built-in columns handle rendering, editing, formatting, and keyboard navigation automatically

    // ID column - always first, non-editable, sized for full UUIDs (36 chars)
    const idColumn = {
      ...keyColumn('id', textColumn),
      title: <span className="font-semibold text-muted-foreground">ID</span>,
      disabled: true,  // Non-editable
      basis: ID_COLUMN_WIDTH,
      grow: COLUMN_GROW,
      shrink: FIXED_COLUMN_SHRINK,
      minWidth: ID_COLUMN_WIDTH,
      headerClassName: 'id-column-header'
    }

    // AIDEV-NOTE: Calculate visible fields using shared utility
    // Logic: mapped visible fields (sorted by order) + unmapped fields (shown by default)
    console.log('[USE GRID COLUMNS] Processing columns', {
      totalFields: fields.length,
      fieldNames: fields.map(f => f.name),
      hasFieldMappings: !!fieldMappings,
      fieldMappingsCount: fieldMappings?.length || 0,
      fieldMappings: fieldMappings
    })

    const visibleFields = getVisibleFields(fields, fieldMappings)

    console.log('[USE GRID COLUMNS] Visible fields calculated', {
      visibleFieldsCount: visibleFields.length,
      visibleFieldNames: visibleFields.map(f => f.name)
    })

    // AIDEV-NOTE: Filter out 'id' field to prevent duplicate with built-in ID column
    const fieldColumns = visibleFields.filter(field => field.name !== 'id').map(field => {
      let columnConfig
      let basis = DEFAULT_COLUMN_BASIS
      let minWidth = DEFAULT_COLUMN_MIN_WIDTH

      switch (field.type) {
        case 'text':
        case 'email':
        case 'phone':
          // Custom TextCell with tooltip support
          columnConfig = {
            ...textColumn,
            component: TextCell,
            columnData: { placeholder: '' }
          }
          break

        case 'number':
          // Custom NumberCell with tooltip support
          columnConfig = {
            ...floatColumn,
            component: NumberCell,
            columnData: { placeholder: '' }
          }
          basis = MEDIUM_COLUMN_BASIS
          minWidth = MEDIUM_COLUMN_MIN_WIDTH
          break

        case 'boolean':
          // Use built-in checkboxColumn - no overflow possible
          columnConfig = checkboxColumn
          basis = SMALL_COLUMN_BASIS
          minWidth = SMALL_COLUMN_MIN_WIDTH
          break

        case 'date':
          // Custom DateCell with tooltip support
          columnConfig = {
            ...dateColumn,
            component: DateCell,
            columnData: { format: 'date' }
          }
          break

        case 'relation':
          // Custom component for complex relation selection
          if (RelationCell) {
            columnConfig = {
              ...textColumn,  // ✅ CRITICAL: Extend base column type for proper data binding
              component: RelationCell,
              disableKeys: true,
              columnData: { field, onUpdateRow }
            }
            basis = WIDE_COLUMN_BASIS
            minWidth = WIDE_COLUMN_MIN_WIDTH
          } else {
            // Fallback to textColumn if RelationCell not provided
            columnConfig = textColumn
          }
          break

        case 'file':
          // Custom component for file upload/preview
          if (FileCell) {
            columnConfig = {
              ...textColumn,  // ✅ CRITICAL: Extend base column type for proper data binding
              component: FileCell,
              disableKeys: true,
              columnData: { field, organizationId, tableId, onUpdateRow }
            }
            basis = WIDE_COLUMN_BASIS
            minWidth = WIDE_COLUMN_MIN_WIDTH
          } else {
            // Fallback to textColumn if FileCell not provided
            columnConfig = textColumn
          }
          break

        case 'document':
          // Custom component for document management
          if (DocumentCell) {
            columnConfig = {
              ...textColumn,  // ✅ CRITICAL: Extend base column type for proper data binding
              component: DocumentCell,
              disableKeys: true,
              columnData: { field, organizationId, tableId, onUpdateRow, data }
            }
            basis = WIDE_COLUMN_BASIS
            minWidth = WIDE_COLUMN_MIN_WIDTH
          } else {
            // Fallback to textColumn if DocumentCell not provided
            columnConfig = textColumn
          }
          break

        case 'embedding':
          // Custom component for embedding vector display
          if (EmbeddingCell) {
            columnConfig = {
              ...textColumn,  // ✅ CRITICAL: Extend base column type for proper data binding
              component: EmbeddingCell,
              disableKeys: true,
              columnData: { field }
            }
            basis = SELECT_COLUMN_BASIS
            minWidth = SELECT_COLUMN_MIN_WIDTH
          } else {
            // Fallback to textColumn if EmbeddingCell not provided
            columnConfig = textColumn
          }
          break

        case 'single-select':
          // Custom component for single select dropdown
          if (SingleSelectCell) {
            columnConfig = {
              ...textColumn,  // ✅ CRITICAL: Extend base column type for proper data binding
              component: SingleSelectCell,
              disableKeys: true,
              columnData: {
                field,
                onUpdateRow,
                onFieldUpdate: (updates: Partial<FieldDTO>) => onFieldUpdate(field, updates)
              }
            }
            basis = SELECT_COLUMN_BASIS
            minWidth = SELECT_COLUMN_MIN_WIDTH
          } else {
            columnConfig = textColumn
          }
          break

        case 'multi-select':
          // Custom component for multi select
          if (MultiSelectCell) {
            columnConfig = {
              ...textColumn,  // ✅ CRITICAL: Extend base column type for proper data binding
              component: MultiSelectCell,
              disableKeys: true,
              columnData: {
                field,
                onUpdateRow,
                onFieldUpdate: (updates: Partial<FieldDTO>) => onFieldUpdate(field, updates)
              }
            }
            basis = WIDE_COLUMN_BASIS
            minWidth = MULTI_SELECT_MIN_WIDTH
          } else {
            columnConfig = textColumn
          }
          break

        case 'autonumber':
          // Use textColumn to display formatted strings (e.g., "INV-00001")
          columnConfig = {
            ...textColumn,
            disabled: false  // Allow editing to support manual overrides
          }
          basis = MEDIUM_COLUMN_BASIS
          minWidth = MEDIUM_COLUMN_MIN_WIDTH
          break

        case 'last-updated':
        case 'created-at':
          // Read-only date column for auto-managed timestamps
          columnConfig = {
            ...dateColumn,
            disabled: true  // Make read-only
          }
          basis = MEDIUM_COLUMN_BASIS
          minWidth = MEDIUM_COLUMN_MIN_WIDTH
          break

        default:
          // Fallback to textColumn for unknown types
          columnConfig = textColumn
      }

      // DIAGNOSTIC: Log before rendering ColumnHeader
      console.log('[useGridColumns] Rendering ColumnHeader', {
        fieldName: field.name,
        fieldId: field.id,
        hasOnEditField: typeof onEditField === 'function',
        hasOnDeleteField: typeof onDeleteField === 'function'
      })

      return {
        ...keyColumn(field.name, columnConfig),
        title: (
          <ColumnHeader
            field={field}
            onEdit={onEditField}
            onDelete={onDeleteField}
            onSort={onSort}
            onClearSort={onClearSort}
          />
        ),
        disabled: false,
        basis,
        grow: COLUMN_GROW,
        shrink: COLUMN_SHRINK,
        minWidth
      }
    })

    // Add column button column - right-most column
    const addColumnCol = {
      ...keyColumn('__add_column', textColumn),
      title: <AddColumnButton onAddColumn={onAddColumn} availableTables={availableTables} />,
      disabled: true,
      basis: ADD_COLUMN_BUTTON_WIDTH,
      grow: COLUMN_GROW,
      shrink: FIXED_COLUMN_SHRINK,
      minWidth: ADD_COLUMN_BUTTON_WIDTH
    }

    // AIDEV-NOTE: ID column visibility controlled by user preference
    // Stored in localStorage per table, toggle in Settings menu
    const showIdColumn = typeof window !== 'undefined' && tableId
      ? localStorage.getItem(`showIdColumn_${tableId}`) === 'true'
      : false

    const columns = []

    if (showIdColumn) {
      columns.push(idColumn)
    }

    columns.push(...fieldColumns)
    columns.push(addColumnCol)

    return columns
  }, [fields, fieldMappings, currentView, organizationId, tableId, data, onUpdateRow, onEditField, onDeleteField, onAddColumn, onFieldUpdate, availableTables, onSort, onClearSort, RelationCell, FileCell, DocumentCell, EmbeddingCell, SingleSelectCell, MultiSelectCell])
}
