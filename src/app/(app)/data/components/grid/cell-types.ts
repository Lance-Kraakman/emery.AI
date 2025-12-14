/**
 * Type-safe cell component definitions for DataSheetGrid
 *
 * AIDEV-NOTE: These types provide type safety for custom cell components.
 * Each cell type has specific value and configuration types to replace CellProps<any, any>
 */

import type { CellProps } from 'react-datasheet-grid'
import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { DSGRow } from '@/app/mappers/dsg-mapper'
import type {
  FileArrayFieldValue,
  DocumentArrayFieldValue,
  RelationArrayFieldValue,
  FieldValue
} from '@/ddd/domain/tables/value-objects/field-values'
import type { EmbeddingFieldValue } from '@/components/tables/fields/EmbeddingField'

/**
 * Callback type for row updates
 */
export type OnUpdateRowCallback = (
  rowId: string,
  fieldId: number,
  value: FieldValue
) => Promise<any>

/**
 * Callback type for field metadata updates
 */
export type OnFieldUpdateCallback = (
  updates: Partial<FieldDTO>
) => Promise<void>

/**
 * Base configuration shared by all custom cells
 */
export interface BaseCellConfiguration {
  field: FieldDTO
  onUpdateRow: OnUpdateRowCallback
}

/**
 * Relation field cell types
 * AIDEV-NOTE: RelationField expects RelationArrayFieldValue (array of relation IDs)
 */
export type RelationValue = RelationArrayFieldValue | null | undefined
export interface RelationCellConfiguration extends BaseCellConfiguration {
  // Relation-specific config would go here
}
export type RelationCellProps = CellProps<RelationValue, RelationCellConfiguration>

/**
 * File field cell types
 * AIDEV-NOTE: FileField expects FileArrayFieldValue (array of file metadata objects)
 */
export type FileValue = FileArrayFieldValue | null | undefined
export interface FileCellConfiguration extends BaseCellConfiguration {
  organizationId: number
  tableId: number
}
export type FileCellProps = CellProps<FileValue, FileCellConfiguration>

/**
 * Document field cell types
 * AIDEV-NOTE: DocumentField expects DocumentArrayFieldValue (array of document metadata objects)
 */
export type DocumentValue = DocumentArrayFieldValue | null | undefined
export interface DocumentCellConfiguration extends BaseCellConfiguration {
  organizationId: number
  tableId: number
  data: DSGRow[]  // Row data array to look up rowId by index
}
export type DocumentCellProps = CellProps<DocumentValue, DocumentCellConfiguration>

/**
 * Embedding field cell types (read-only)
 * AIDEV-NOTE: EmbeddingField expects EmbeddingFieldValue (vector metadata) or null
 */
export type EmbeddingValue = EmbeddingFieldValue | null | undefined
export interface EmbeddingCellConfiguration {
  field: FieldDTO
}
export type EmbeddingCellProps = CellProps<EmbeddingValue, EmbeddingCellConfiguration>

/**
 * Single-select field cell types
 * AIDEV-NOTE: SingleSelectField expects number (option ID) or null
 */
export type SingleSelectValue = number | null | undefined
export interface SingleSelectCellConfiguration extends BaseCellConfiguration {
  onFieldUpdate: OnFieldUpdateCallback
}
export type SingleSelectCellProps = CellProps<SingleSelectValue, SingleSelectCellConfiguration>

/**
 * Multi-select field cell types
 * AIDEV-NOTE: MultiSelectField expects array of numbers (option IDs) or null
 */
export type MultiSelectValue = number[] | null | undefined
export interface MultiSelectCellConfiguration extends BaseCellConfiguration {
  onFieldUpdate: OnFieldUpdateCallback
}
export type MultiSelectCellProps = CellProps<MultiSelectValue, MultiSelectCellConfiguration>
