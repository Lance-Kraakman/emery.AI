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

/**
 * Union type for all possible field values in serialized form (Domain → Storage)
 * AIDEV-NOTE: Represents normalized field values ready for Delta Lake storage
 */
type SerializedFieldValue =
  | string
  | number
  | boolean
  | Date
  | null
  | FileArrayFieldValue
  | DocumentArrayFieldValue
  | RelationArrayFieldValue
  | number[];  // multi-select option IDs

/**
 * Union type for all possible field values in deserialized form (Storage → Domain)
 * AIDEV-NOTE: Represents parsed field values with Excel-like defaults applied
 */
type DeserializedFieldValue =
  | string
  | number
  | boolean
  | Date
  | null
  | FileArrayFieldValue
  | DocumentArrayFieldValue
  | RelationArrayFieldValue;

/**
 * Type for serialized row data with numeric field IDs
 * Example: {id: "123", 10: "value", 11: 42, 12: [{id: 1}]}
 */
type SerializedRow = Record<string, SerializedFieldValue>;

/**
 * Type for deserialized row data with numeric field IDs
 * Example: {id: "123", 10: "value", 11: 42, 12: [{id: 1}]}
 */
type DeserializedRow = Record<string, DeserializedFieldValue>;

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
  static serializeForStorage(row: Row, fields: readonly TableField[]): SerializedRow {
    const plain = row.toPlainObject(fields);

    // AIDEV-NOTE: Build result from scratch to avoid corrupted keys
    // DO NOT use { ...plain } as it preserves numeric keys from corruption
    const result: Record<string, any> = { id: plain.id };

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
  private static serializeFieldValue(value: any, field: TableField): SerializedFieldValue {
    // Log multi-select serialization for debugging
    if (field.type === 'multi-select') {
      console.log('[RowSerializer.serializeFieldValue] Multi-select field', {
        fieldName: field.name,
        fieldId: field.id.value,
        value,
        valueType: typeof value,
        isArray: Array.isArray(value)
      });
    }

    // Complex types need special wrapping for Delta Lake JSON storage
    if (this.isComplexFieldType(field.type)) {
      return this.wrapComplexFieldForStorage(value, field);
    }

    // Simple types: field-aware normalization
    return this.normalizeSimpleFieldForStorage(value, field);
  }

  private static isComplexFieldType(type: string): boolean {
    // AIDEV-NOTE: Complex fields are stored as JSON arrays in Delta Lake
    // multi-select stores array of option IDs, single-select stores primitive value
    return ['relation', 'document', 'file', 'multi-select'].includes(type);
  }

  /**
   * Prepare complex field values for Delta Lake JSON storage
   *
   * AIDEV-NOTE: No wrapping needed - field ID is already the column name in Delta Lake.
   * Just return the value as-is to be stringified by TableGrpcMapper.
   *
   * Example:
   *   Input:  [{id: 1}, {id: 2}]
   *   Output: [{id: 1}, {id: 2}]  (stored as JSON string in column "10")
   */
  private static wrapComplexFieldForStorage(value: any, field: TableField): any {
    // No wrapper needed - field ID is already the Delta Lake column name
    // TableGrpcMapper will stringify: [...] → '[...]'
    return value;
  }

  /**
   * Normalize simple field values for Delta Lake storage
   *
   * AIDEV-NOTE: Delta Lake uses Arrow schema for type validation.
   * Empty strings cannot be cast to numeric types (Float64, Int64, Boolean).
   * We convert empty → null to enable proper Arrow type casting.
   */
  private static normalizeSimpleFieldForStorage(value: any, field: TableField): string | number | boolean | Date | null {
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
      case 'single-select':
      case 'autonumber':
        // AIDEV-NOTE: Text-based fields (empty strings are valid)
        // single-select stores option ID as text/number
        // autonumber stores formatted strings like "INV-00001"

        // Validate single-select values - log only if invalid (should never happen after fix)
        if (field.type === 'single-select') {
          const isValidType = typeof value === 'number' || typeof value === 'string' || value === null || value === undefined;
          if (!isValidType) {
            console.error('[RowSerializer] ❌ INVALID single-select type (BUG!)', {
              fieldName: field.name,
              fieldId: field.id.value,
              value,
              valueType: typeof value
            });
          }
        }

        return value;

      case 'date':
      case 'last-updated':
      case 'created-at':
        // AIDEV-NOTE: Timestamp fields (empty → null)
        // Auto-fields (last-updated, created-at) are managed by AutoFieldProcessor
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
  ): DeserializedRow {
    // AIDEV-NOTE: Build result from scratch to avoid corrupted keys
    const result: Record<string, any> = { id: data.id };

    for (const field of fields) {
      const fieldKey = field.id.value.toString();
      const value = data[fieldKey];
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
    // Log multi-select deserialization for debugging
    if (field.type === 'multi-select') {
      console.log('[RowSerializer.deserializeFieldValue] Multi-select field', {
        fieldName: field.name,
        fieldId: field.id.value,
        value,
        valueType: typeof value,
        isArray: Array.isArray(value),
        isNull: value === null,
        isUndefined: value === undefined
      });
    }

    // Complex types: unwrap JSON and validate
    if (this.isComplexFieldType(field.type)) {
      const result = this.unwrapComplexFieldFromStorage(value, field);

      // Log multi-select deserialization result
      if (field.type === 'multi-select') {
        console.log('[RowSerializer.deserializeFieldValue] Multi-select unwrap result', {
          fieldName: field.name,
          result,
          resultType: typeof result,
          isArray: Array.isArray(result)
        });
      }

      return result;
    }

    // Simple types: apply Excel-like defaults
    return this.applyExcelLikeDefaults(value, field);
  }

  /**
   * Unwrap complex field values from Delta Lake JSON storage
   *
   * AIDEV-NOTE: Since we no longer wrap on write, JSON strings contain direct arrays.
   * Simply parse and validate.
   *
   * Example:
   *   Storage: '[{id: 1}]'
   *   Parsed:  [{id: 1}]
   *   Returned: [{id: 1}]  ← validated array
   *
   * @param value - Raw value from storage (JSON string or pre-parsed array)
   * @param field - Field definition with type information
   * @returns Validated array matching field type (FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue)
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
        // After parse, should be a direct array
        if (Array.isArray(parsed)) {
          return this.validateComplexFieldArray(parsed, field);
        }
        // If not an array, might be legacy wrapped format - try unwrapping
        console.warn(`[RowSerializer.unwrapComplexFieldFromStorage] Expected array but got object for field "${field.name}", attempting to unwrap`);
        return this.unwrapParsedComplexField(parsed, field);
      } catch (e) {
        console.warn(`[RowSerializer.unwrapComplexFieldFromStorage] Failed to parse JSON for field "${field.name}" (ID ${field.id.value}):`, e);
        return null;
      }
    }

    // Handle already-parsed arrays (from Arrow or direct values)
    if (Array.isArray(value)) {
      return this.validateComplexFieldArray(value, field);
    }

    // Handle already-parsed objects (legacy wrapped format)
    if (value && typeof value === 'object') {
      console.warn(`[RowSerializer.unwrapComplexFieldFromStorage] Expected array but got object for field "${field.name}", attempting to unwrap`);
      return this.unwrapParsedComplexField(value, field);
    }

    // Unexpected primitive value
    console.warn(`[RowSerializer.unwrapComplexFieldFromStorage] Unexpected primitive value for complex field "${field.name}":`, value);
    return null;
  }

  /**
   * Unwrap a parsed complex field value (handles legacy wrapped format)
   *
   * AIDEV-NOTE: This is for backwards compatibility with data written before
   * removing the field ID wrapper. New data should be direct arrays.
   *
   * @param parsed - Parsed object that may be wrapped
   * @param field - Field definition
   * @returns Unwrapped array
   */
  private static unwrapParsedComplexField(
    parsed: any,
    field: TableField
  ): FileArrayFieldValue | DocumentArrayFieldValue | RelationArrayFieldValue | null {
    if (!parsed) return null;

    // If already an array, validate and return
    if (Array.isArray(parsed)) {
      return this.validateComplexFieldArray(parsed, field);
    }

    // If object, try to unwrap using field ID or field name (legacy format)
    if (typeof parsed === 'object') {
      const fieldKey = field.id.value.toString();
      const fieldName = field.name;

      // Try unwrapping by field ID first: {5: [...]} → [...]
      if (fieldKey in parsed) {
        const unwrapped = parsed[fieldKey];

        // Check if still wrapped (double wrapper): {5: {sdf: [...]}}
        if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped) && fieldName in unwrapped) {
          const doubleUnwrapped = unwrapped[fieldName];
          return Array.isArray(doubleUnwrapped) ? this.validateComplexFieldArray(doubleUnwrapped, field) : null;
        }

        return Array.isArray(unwrapped) ? this.validateComplexFieldArray(unwrapped, field) : null;
      }

      // Try unwrapping by field name: {"sdf": [...]} → [...]
      if (fieldName in parsed) {
        const unwrapped = parsed[fieldName];
        return Array.isArray(unwrapped) ? this.validateComplexFieldArray(unwrapped, field) : null;
      }

      // No valid wrapper found
      console.warn(`[RowSerializer.unwrapParsedComplexField] Could not unwrap legacy format for field "${field.name}" (ID ${fieldKey})`, {
        keys: Object.keys(parsed)
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
        const isValidDoc = isDocumentArray(arr);
        if (!isValidDoc) {
          console.warn(`[RowSerializer.validateComplexFieldArray] Document array FAILED validation for field "${field.name}"`, {
            sample: JSON.stringify(arr[0])
          });
        }
        return isValidDoc ? arr : [];
      case 'file':
        const isValidFile = isFileArray(arr);
        if (!isValidFile) {
          console.warn(`[RowSerializer.validateComplexFieldArray] File array FAILED validation for field "${field.name}"`, {
            sample: JSON.stringify(arr[0])
          });
        }
        return isValidFile ? arr : [];
      case 'relation':
      case 'multi-select':
        // AIDEV-NOTE: Relation and multi-select arrays are less strictly typed
        // multi-select stores array of option IDs (numbers or strings)
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
   * - Select fields: Display as empty string '' (no selection)
   * - Auto-fields: Display as empty string '' (managed by AutoFieldProcessor)
   *
   * This ensures consistent, predictable behavior matching spreadsheet UX.
   */
  private static applyExcelLikeDefaults(value: any, field: TableField): string | number | boolean | Date | null {
    if (value === null || value === undefined) {
      switch (field.type) {
        case 'boolean':
          // Excel: Empty cell = unchecked checkbox
          return false;

        case 'text':
        case 'number':
        case 'date':
        case 'single-select':
        case 'autonumber':
        case 'last-updated':
        case 'created-at':
          // Excel: Empty cell = empty string (NOT zero for numbers)
          // Select fields: Empty = no selection
          // Auto-fields: Empty until managed by AutoFieldProcessor
          return '';

        case 'email':
        case 'phone':
          // Email/phone: Empty = null (not empty string)
          // Validation rejects empty strings but accepts null
          return null;

        default:
          return '';
      }
    }

    // Non-null values: pass through as-is
    return value;
  }
}
