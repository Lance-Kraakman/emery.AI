/**
 * DSG (DataSheetGrid) Mapper
 *
 * Type-safe conversion utilities between Domain DTOs and DataSheetGrid format.
 *
 * Format Overview:
 * - RowDTO: { id, tableId, fieldValues: [{fieldSlug, value, fieldType}] }
 * - DSG Format: { id: "123", name: "John", age: 30, files: [...] }
 *
 * DSG format is a flat object where field values are indexed by field name,
 * which is what react-datasheet-grid expects for optimal performance.
 */

import type { FieldDTO } from './field-mapper'
import type { RowDTO } from './row-mapper'
import type { FieldValue } from '@/ddd/domain/tables/value-objects/field-values'

/**
 * DSG (DataSheetGrid) Row Format - Flat object for grid display
 * This is the format react-datasheet-grid expects
 */
export interface DSGRow {
  id: string
  [fieldName: string]: FieldValue | string  // Field values indexed by field name
}

/**
 * Field Default Constants
 *
 * Aligned with DDD FieldValue types from field-values.ts:
 * - TextFieldValue, NumberFieldValue, BooleanFieldValue, DateFieldValue
 * - FileArrayFieldValue, RelationArrayFieldValue, DocumentArrayFieldValue
 */

/**
 * Required field defaults - must be valid non-empty values to pass domain validation
 * AIDEV-NOTE: Required fields need valid defaults to prevent "field is required" errors
 */
const REQUIRED_FIELD_DEFAULTS: Record<string, FieldValue> = {
  text: 'Untitled',           // TextFieldValue - valid non-empty string
  email: 'untitled@example.com', // TextFieldValue - valid email format
  url: 'https://example.com', // TextFieldValue - valid URL format
  number: 0,                  // NumberFieldValue - valid number
  boolean: false,             // BooleanFieldValue
  date: new Date(),           // DateFieldValue
  'last-updated': new Date(), // DateFieldValue - auto-managed timestamp
  'created-at': new Date(),   // DateFieldValue - auto-managed timestamp
  file: [],                   // FileArrayFieldValue - empty array is valid
  relation: [],               // RelationArrayFieldValue - empty array is valid
  document: [],               // DocumentArrayFieldValue - empty array is valid
  tiptap_doc: [],             // DocumentArrayFieldValue - empty array is valid
  'single-select': null,      // SingleSelectFieldValue - null for required (user must select)
  'multi-select': []          // MultiSelectFieldValue - empty array is valid
} as const;

/**
 * Optional field defaults - can be null/empty since field is not required
 */
const OPTIONAL_FIELD_DEFAULTS: Record<string, FieldValue> = {
  text: '',                   // TextFieldValue - empty allowed for optional
  email: null,                // EmailFieldValue - null required (empty string fails validation)
  phone: null,                // PhoneFieldValue - null required (empty string fails validation)
  url: null,                  // URLFieldValue - null required (empty string fails validation)
  number: null,               // NumberFieldValue - null allowed for optional
  boolean: false,             // BooleanFieldValue
  date: null,                 // DateFieldValue - null allowed for optional
  'last-updated': null,       // DateFieldValue - null allowed for optional
  'created-at': null,         // DateFieldValue - null allowed for optional
  file: [],                   // FileArrayFieldValue - empty array
  relation: [],               // RelationArrayFieldValue - empty array
  document: [],               // DocumentArrayFieldValue - empty array
  tiptap_doc: [],             // DocumentArrayFieldValue - empty array
  'single-select': null,      // SingleSelectFieldValue - null allowed for optional
  'multi-select': []          // MultiSelectFieldValue - empty array
} as const;

/**
 * Get default value for a field based on its type and required status
 * Uses FieldDTO to ensure type-safe defaults aligned with DDD domain types
 *
 * @param field - Field definition with type and required flag
 * @returns Valid default value that will pass domain validation
 */
export function getFieldDefaultValue(field: FieldDTO): FieldValue {
  const defaults = field.required ? REQUIRED_FIELD_DEFAULTS : OPTIONAL_FIELD_DEFAULTS;
  return defaults[field.type] ?? null;
}

/**
 * Create empty DSG row with default values from field definitions
 * Generates unique temporary ID for new rows
 */
export function createEmptyDSGRow(fields: FieldDTO[]): DSGRow {
  const row: DSGRow = {
    id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  fields.forEach(field => {
    row[field.name] = getFieldDefaultValue(field)
  })

  return row
}

/**
 * Convert DSG row to plain object for server actions
 * Strips the 'id' field, leaving only field name → value mappings
 */
export function dsgRowToPlainObject(dsgRow: DSGRow): Record<string, any> {
  const { id, ...fieldData } = dsgRow
  return fieldData
}

/**
 * Compare two DSG rows to check if any field values have changed
 */
export function hasRowChanged(newRow: DSGRow, oldRow: DSGRow): boolean {
  const keys = Object.keys(newRow).filter(k => k !== 'id')

  return keys.some(key => {
    const newValue = newRow[key]
    const oldValue = oldRow[key]

    // Handle array comparison (files, relations, documents)
    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
      return JSON.stringify(newValue) !== JSON.stringify(oldValue)
    }

    return newValue !== oldValue
  })
}

/**
 * Get changed fields between two DSG rows
 * Returns array of { fieldId, value } for server updates
 */
export function getChangedFields(
  newRow: DSGRow,
  oldRow: DSGRow,
  fields: FieldDTO[]
): Array<{ fieldId: number; value: FieldValue }> {
  const changes: Array<{ fieldId: number; value: FieldValue }> = []

  fields.forEach(field => {
    const newValue = newRow[field.name]
    const oldValue = oldRow[field.name]

    // Handle array comparison
    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
      if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
        changes.push({ fieldId: field.id, value: newValue })
      }
    } else if (newValue !== oldValue) {
      changes.push({ fieldId: field.id, value: newValue })
    }
  })

  return changes
}
