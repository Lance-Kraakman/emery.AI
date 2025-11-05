/**
 * Row Serializer
 *
 * ARCHITECTURE: SINGLE SOURCE OF TRUTH for field-aware data transformations
 *
 * Responsibilities:
 * - Serialization: Domain → Storage (field-type-aware normalization)
 * - Deserialization: Storage → Domain (field-type-aware parsing + Excel-like defaults)
 * - Complex field wrapping for Delta Lake JSON storage
 *
 * AIDEV-NOTE: This is the ONLY place that understands field semantics.
 * TableGrpcMapper is type-agnostic and just converts JS types ↔ Protobuf.
 *
 * Layer Responsibilities:
 * - RowSerializer: Field-aware transformations (THIS FILE)
 * - TableGrpcMapper: Type-agnostic JS ↔ Protobuf conversion
 * - Python Service: Protobuf → Delta Lake via Arrow
 */

import type { Row } from '@/ddd/domain/tables/value-objects/row';
import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import type {
  FileArrayFieldValue,
  DocumentArrayFieldValue,
  RelationArrayFieldValue
} from '@/ddd/domain/tables/value-objects/field-values';
import {
  isDocumentArray,
  isFileArray
} from '@/ddd/domain/tables/value-objects/field-values';

// ============================================================================
// Storage Format Types
// ============================================================================

/**
 * Complex fields are wrapped in Delta Lake JSON storage with either:
 * - Numeric field ID: {5: [...]} (standard storage format)
 * - Field name: {"sdf": [...]} (Arrow deserialization format)
 */
type ComplexFieldWrapper<T> = {
  [key: string]: T;  // Single key with either fieldId or fieldName
};

/**
 * Type for complex field values as stored in Delta Lake
 */
type StoredComplexField =
  | FileArrayFieldValue
  | DocumentArrayFieldValue
  | RelationArrayFieldValue
  | ComplexFieldWrapper<FileArrayFieldValue>
  | ComplexFieldWrapper<DocumentArrayFieldValue>
  | ComplexFieldWrapper<RelationArrayFieldValue>;

export class RowSerializer {
  // ============================================================================
  // SERIALIZATION: Domain → Storage (Outbound)
  // ============================================================================

  /**
   * Serialize Row for Delta Lake storage with numeric field IDs
   * AIDEV-NOTE: Uses numeric field IDs as column names (10, 11, 12) not field names.
   * Applies field-aware normalization and complex type wrapping.
   *
   * @param row - Domain Row entity
   * @param fields - Table field definitions
   * @returns Plain object with numeric IDs: {id: "123", 10: "value", 11: "value"}
   */
  static serializeForStorage(row: Row, fields: readonly TableField[]): Record<string, any> {
    const plain = row.toPlainObject(fields);

    // AIDEV-NOTE: Build result from scratch to avoid corrupted keys
    // DO NOT use { ...plain } as it preserves numeric keys from corruption
    const result: Record<string, any> = { id: plain.id };

    console.log(`[RowSerializer.serializeForStorage] Row ${row.id.value}:`, {
      fieldCount: fields.length,
      plainKeys: Object.keys(plain)
    });

    for (const field of fields) {
      const fieldKey = field.id.value;
      const value = plain[fieldKey];
      result[fieldKey] = this.serializeFieldValue(value, field);
    }

    return result;
  }

  /**
   * Serialize a single field value for storage
   * SINGLE SOURCE OF TRUTH for field-aware type normalization
   *
   * @param value - Raw value from domain
   * @param field - Field definition with type information
   * @returns Normalized value ready for storage
   */
  private static serializeFieldValue(value: any, field: TableField): any {
    // Complex types need special wrapping for Delta Lake JSON storage
    if (this.isComplexFieldType(field.type)) {
      return this.wrapComplexFieldForStorage(value, field);
    }

    // Simple types: field-aware normalization
    return this.normalizeSimpleFieldForStorage(value, field);
  }

  private static isComplexFieldType(type: string): boolean {
    return ['relation', 'document', 'file'].includes(type);
  }

  /**
   * Wrap complex field values for Delta Lake JSON storage
   *
   * AIDEV-NOTE: Delta Lake stores complex types as JSON strings.
   * We wrap arrays/objects with field ID for proper deserialization:
   *
   * Example:
   *   Input:  docs = [{id: 1}, {id: 2}]
   *   Output: {10: [{id: 1}, {id: 2}]} (where 10 is field ID)
   *
   * This wrapper helps identify the field when parsing JSON from Delta Lake,
   * ensuring we unwrap to the correct structure during deserialization.
   */
  private static wrapComplexFieldForStorage(value: any, field: TableField): any {
    const fieldKey = field.id.value.toString();
    console.log(`[RowSerializer.serializeForStorage] Field "${field.name}" (ID ${fieldKey}):`, {
      type: field.type,
      valueType: typeof value,
      isArray: Array.isArray(value),
      value: Array.isArray(value) ? `array[${value.length}]` : value
    });

    if (value && (Array.isArray(value) || typeof value === 'object')) {
      // Wrap: [...] → {fieldId: [...]}
      return { [fieldKey]: value };
    }

    // null, undefined, or primitive → store as-is
    return value;
  }

  /**
   * Normalize simple field values for Delta Lake storage
   *
   * AIDEV-NOTE: Delta Lake uses Arrow schema for type validation.
   * Empty strings cannot be cast to numeric types (Float64, Int64, Boolean).
   * We convert empty → null to enable proper Arrow type casting.
   */
  private static normalizeSimpleFieldForStorage(value: any, field: TableField): any {
    const isEmpty = value === '' || value === null || value === undefined;

    switch (field.type) {
      case 'number':
        // AIDEV-NOTE: Arrow cannot cast '' to Float64
        // Convert empty → null for proper storage
        return isEmpty ? null : value;

      case 'boolean':
        // AIDEV-NOTE: Arrow cannot cast '' to Boolean
        // Convert empty → null for proper storage
        if (isEmpty) return null;

        // Convert string booleans from checkbox inputs
        if (typeof value === 'string') {
          return value === 'true' || value === '1';
        }

        return value;

      case 'text':
        // Empty strings are valid for text fields
        return value;

      case 'date':
        // Empty → null for dates
        return isEmpty ? null : value;

      default:
        // Unknown types: pass through
        return value;
    }
  }

  // ============================================================================
  // DESERIALIZATION: Storage → Domain (Inbound)
  // ============================================================================

  /**
   * Deserialize data from Delta Lake storage to Row-compatible format
   * AIDEV-NOTE: Reads from numeric field IDs (10, 11, 12) not field names.
   * Parses JSON for complex types and applies Excel-like defaults.
   *
   * @param data - Raw data from Delta Lake with numeric field IDs: {id: "123", 10: "value", 11: "value"}
   * @param fields - Table field definitions
   * @returns Plain object ready for Row.fromPlainObject() with numeric IDs
   */
  static deserializeFromStorage(
    data: Record<string, any>,
    fields: readonly TableField[]
  ): Record<string, any> {
    // AIDEV-NOTE: Build result from scratch to avoid corrupted keys
    console.log(`[RowSerializer.deserializeFromStorage] Input data keys:`, Object.keys(data));
    const result: Record<string, any> = { id: data.id };

    for (const field of fields) {
      const fieldKey = field.id.value.toString();
      const value = data[fieldKey];
      console.log(`[RowSerializer.deserializeFromStorage] Field "${field.name}" (ID ${fieldKey}): value=`, value === undefined ? 'UNDEFINED' : typeof value);
      result[fieldKey] = this.deserializeFieldValue(value, field);
    }

    return result;
  }

  /**
   * Deserialize a single field value from storage
   * SINGLE SOURCE OF TRUTH for field-aware parsing and Excel-like defaults
   *
   * @param value - Raw value from storage
   * @param field - Field definition with type information
   * @returns Parsed value with Excel-like defaults for domain layer, properly typed
   */
  private static deserializeFieldValue(
    value: any,
    field: TableField
  ): string | number | boolean | Date | FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue | null {
    // Complex types: unwrap JSON and validate
    if (this.isComplexFieldType(field.type)) {
      return this.unwrapComplexFieldFromStorage(value, field);
    }

    // Simple types: apply Excel-like defaults
    return this.applyExcelLikeDefaults(value, field);
  }

  /**
   * Unwrap complex field values from Delta Lake JSON storage
   *
   * AIDEV-NOTE: Reverses the wrapping from serializeFieldValue.
   * Handles both numeric field IDs and field names as wrapper keys.
   *
   * Example:
   *   Storage: '{"10": [{id: 1}]}'
   *   Parsed:  {10: [{id: 1}]}
   *   Returned: [{id: 1}]  ← unwrapped
   *
   * @param value - Raw value from storage (JSON string or pre-parsed object)
   * @param field - Field definition with type information
   * @returns Unwrapped array matching field type (FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue)
   */
  private static unwrapComplexFieldFromStorage(
    value: StoredComplexField | string | null | undefined,
    field: TableField
  ): FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue | null {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Handle JSON string values from Delta Lake storage
    if (typeof value === 'string' && value.length > 0) {
      try {
        const parsed = JSON.parse(value);
        return this.unwrapParsedComplexField(parsed, field);
      } catch (e) {
        console.warn(`[RowSerializer.unwrapComplexFieldFromStorage] Failed to parse JSON for field "${field.name}" (ID ${field.id.value}):`, e);
        return null;
      }
    }

    // Handle already-parsed values (from Arrow or direct objects)
    if (value && typeof value === 'object') {
      return this.unwrapParsedComplexField(value, field);
    }

    // Unexpected primitive value
    console.warn(`[RowSerializer.unwrapComplexFieldFromStorage] Unexpected primitive value for complex field "${field.name}":`, value);
    return null;
  }

  /**
   * Unwrap a parsed complex field value (removes wrapper object if present)
   *
   * @param parsed - Parsed object that may be wrapped
   * @param field - Field definition
   * @returns Unwrapped array
   */
  private static unwrapParsedComplexField(
    parsed: any,
    field: TableField
  ): FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue | null {
    console.log(`[RowSerializer.unwrapParsedComplexField] Field "${field.name}" (ID ${field.id.value}):`, {
      parsedType: typeof parsed,
      isArray: Array.isArray(parsed),
      keys: typeof parsed === 'object' && parsed ? Object.keys(parsed) : 'N/A',
      sample: JSON.stringify(parsed).substring(0, 100)
    });

    if (!parsed) return null;

    // If already an array, validate and return
    if (Array.isArray(parsed)) {
      console.log(`[RowSerializer.unwrapParsedComplexField] Already an array, validating...`);
      return this.validateComplexFieldArray(parsed, field);
    }

    // If object, try to unwrap using field ID or field name
    if (typeof parsed === 'object') {
      const fieldKey = field.id.value.toString();
      const fieldName = field.name;

      console.log(`[RowSerializer.unwrapParsedComplexField] Trying to unwrap object. FieldKey="${fieldKey}", FieldName="${fieldName}"`);

      // Try unwrapping by field ID first: {5: [...]} → [...]
      if (fieldKey in parsed) {
        console.log(`[RowSerializer.unwrapParsedComplexField] Found wrapper with fieldKey "${fieldKey}"`);
        const unwrapped = parsed[fieldKey];
        return Array.isArray(unwrapped) ? this.validateComplexFieldArray(unwrapped, field) : null;
      }

      // Try unwrapping by field name: {"sdf": [...]} → [...]
      if (fieldName in parsed) {
        console.log(`[RowSerializer.unwrapParsedComplexField] Found wrapper with fieldName "${fieldName}"`);
        const unwrapped = parsed[fieldName];
        return Array.isArray(unwrapped) ? this.validateComplexFieldArray(unwrapped, field) : null;
      }

      // No valid wrapper found
      console.warn(`[RowSerializer.unwrapParsedComplexField] No valid wrapper found for field "${field.name}" (ID ${fieldKey})`, {
        keys: Object.keys(parsed),
        expected: [fieldKey, fieldName]
      });
      return null;
    }

    return null;
  }

  /**
   * Validate and type-check complex field arrays
   *
   * @param arr - Array to validate
   * @param field - Field definition
   * @returns Typed array if valid, empty array otherwise
   */
  private static validateComplexFieldArray(
    arr: any[],
    field: TableField
  ): FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue {
    if (arr.length === 0) return [];

    // Use type guards from domain layer
    switch (field.type) {
      case 'document':
        return isDocumentArray(arr) ? arr : [];
      case 'file':
        return isFileArray(arr) ? arr : [];
      case 'relation':
        // Relation arrays are less strictly typed
        return arr;
      default:
        console.warn(`[RowSerializer.validateComplexFieldArray] Unknown complex field type: ${field.type}`);
        return [];
    }
  }

  /**
   * Apply Excel-like defaults for domain layer
   *
   * AIDEV-NOTE: Excel-like behavior for empty cells
   * Excel treats empty cells consistently across field types:
   * - Text fields: Display as empty string ''
   * - Number fields: Display as empty string '' (NOT zero)
   * - Boolean fields: Display as unchecked (false)
   * - Date fields: Display as empty string ''
   *
   * This ensures consistent, predictable behavior matching spreadsheet UX.
   */
  private static applyExcelLikeDefaults(value: any, field: TableField): any {
    if (value === null || value === undefined) {
      switch (field.type) {
        case 'boolean':
          // Excel: Empty cell = unchecked checkbox
          return false;

        case 'text':
        case 'number':
        case 'date':
          // Excel: Empty cell = empty string (NOT zero for numbers)
          return '';

        default:
          return '';
      }
    }

    // Non-null values: pass through as-is
    return value;
  }
}
