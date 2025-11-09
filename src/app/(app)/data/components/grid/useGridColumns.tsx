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
import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { TableDTO } from '@/app/mappers/table-mapper'
import type { FieldValue as DomainFieldValue } from '@/ddd/domain/tables/value-objects/field-values'
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field'

interface UseGridColumnsParams {
  fields: FieldDTO[]
  organizationId: number
  tableId: number
  availableTables: TableDTO[]
  onUpdateRow: (rowId: string, fieldId: number, value: DomainFieldValue) => Promise<any>
  onEditField: (field: FieldDTO) => void
  onDeleteField: (fieldName: string) => void
  onAddColumn: (data: { name: string; type: FieldType; required: boolean; relatedTableId?: number }) => Promise<void>
  onFieldUpdate: (field: FieldDTO, updates: Partial<FieldDTO>) => Promise<void>
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  onClearSort?: () => void
  // Custom cell components for complex field types
  RelationCell?: CellComponent<any, any>
  FileCell?: CellComponent<any, any>
  DocumentCell?: CellComponent<any, any>
  EmbeddingCell?: CellComponent<any, any>
  SingleSelectCell?: CellComponent<any, any>
  MultiSelectCell?: CellComponent<any, any>
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
  organizationId,
  tableId,
  availableTables,
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
  return useMemo(() => {
    // AIDEV-NOTE: Using react-datasheet-grid built-in column types for standard fields
    // Built-in columns handle rendering, editing, formatting, and keyboard navigation automatically

    // ID column - always first, non-editable, sized for full UUIDs (36 chars)
    const idColumn = {
      ...keyColumn('id', textColumn),
      title: <span className="font-semibold text-muted-foreground">ID</span>,
      disabled: true,  // Non-editable
      basis: 300,      // Increased from 100 to fit full UUID (36 chars)
      grow: 0,
      shrink: 0,
      minWidth: 300,   // Increased from 80 to fit full UUID
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
          if (RelationCell) {
            columnConfig = {
              component: RelationCell,
              disableKeys: true,
              columnData: { field, onUpdateRow }
            }
            basis = 250
            minWidth = 150
          } else {
            // Fallback to textColumn if RelationCell not provided
            columnConfig = textColumn
          }
          break

        case 'file':
          // Custom component for file upload/preview
          if (FileCell) {
            columnConfig = {
              component: FileCell,
              disableKeys: true,
              columnData: { field, organizationId, tableId, onUpdateRow }
            }
            basis = 250
            minWidth = 150
          } else {
            // Fallback to textColumn if FileCell not provided
            columnConfig = textColumn
          }
          break

        case 'document':
          // Custom component for document management
          if (DocumentCell) {
            columnConfig = {
              component: DocumentCell,
              disableKeys: true,
              columnData: { field, organizationId, tableId, onUpdateRow }
            }
            basis = 250
            minWidth = 150
          } else {
            // Fallback to textColumn if DocumentCell not provided
            columnConfig = textColumn
          }
          break

        case 'embedding':
          // Custom component for embedding vector display
          if (EmbeddingCell) {
            columnConfig = {
              component: EmbeddingCell,
              disableKeys: true,
              columnData: { field }
            }
            basis = 200
            minWidth = 150
          } else {
            // Fallback to textColumn if EmbeddingCell not provided
            columnConfig = textColumn
          }
          break

        case 'single-select':
          // Custom component for single select dropdown
          if (SingleSelectCell) {
            columnConfig = {
              component: SingleSelectCell,
              disableKeys: true,
              columnData: {
                field,
                onUpdateRow,
                onFieldUpdate: (updates: Partial<FieldDTO>) => onFieldUpdate(field, updates)
              }
            }
            basis = 200
            minWidth = 150
          } else {
            columnConfig = textColumn
          }
          break

        case 'multi-select':
          // Custom component for multi select
          if (MultiSelectCell) {
            columnConfig = {
              component: MultiSelectCell,
              disableKeys: true,
              columnData: {
                field,
                onUpdateRow,
                onFieldUpdate: (updates: Partial<FieldDTO>) => onFieldUpdate(field, updates)
              }
            }
            basis = 250
            minWidth = 180
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
          basis = 180  // Wider to accommodate prefix/suffix
          minWidth = 150
          break

        case 'last-updated':
        case 'created-at':
          // Read-only date column for auto-managed timestamps
          columnConfig = {
            ...dateColumn,
            disabled: true  // Make read-only
          }
          basis = 180
          minWidth = 150
          break

        default:
          // Fallback to textColumn for unknown types
          columnConfig = textColumn
      }

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
        grow: 0,
        shrink: 1,
        minWidth
      }
    })

    // Add column button column - right-most column
    const addColumnCol = {
      ...keyColumn('__add_column', textColumn),
      title: <AddColumnButton onAddColumn={onAddColumn} availableTables={availableTables} />,
      disabled: true,
      basis: 50,
      grow: 0,
      shrink: 0,
      minWidth: 50
    }

    // Return ID column first, then field columns, then add column button
    return [idColumn, ...fieldColumns, addColumnCol]
  }, [fields, organizationId, tableId, onUpdateRow, onEditField, onDeleteField, onAddColumn, onFieldUpdate, availableTables, onSort, onClearSort, RelationCell, FileCell, DocumentCell, EmbeddingCell, SingleSelectCell, MultiSelectCell])
}
