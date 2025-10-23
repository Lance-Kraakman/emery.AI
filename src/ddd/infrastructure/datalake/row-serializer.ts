/**
 * Row Serializer
 *
 * Infrastructure component that handles serialization/deserialization of Row entities
 * for Delta Lake storage.
 *
 * ARCHITECTURE NOTE: Serialization logic belongs in the infrastructure layer, NOT domain.
 * - Domain layer (Row): Works with plain JavaScript objects/arrays
 * - Infrastructure layer (RowSerializer): Handles persistence format conversion
 *
 * AIDEV-NOTE: Python Delta Lake handles arrays/objects natively via Arrow.
 * We send arrays/objects directly - NO JSON string serialization needed.
 * Python parses jsonValue fields automatically, so trying to send JSON strings
 * results in double-serialization issues.
 */

import type { Row } from '@/ddd/domain/tables/value-objects/row';
import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';

export class RowSerializer {
  /**
   * Serialize Row for Delta Lake storage
   * Filters out unexpected fields to prevent corruption
   *
   * @param row - Domain Row entity
   * @param fields - Table field definitions
   * @returns Plain object ready for Delta Lake storage
   */
  static serializeForStorage(row: Row, fields: readonly TableField[]): Record<string, any> {
    const plain = row.toPlainObject();

    // AIDEV-NOTE: Build result from scratch to avoid preserving corrupted keys
    // DO NOT use { ...plain } as it would preserve numeric keys from previous corruptions
    const result: Record<string, any> = {};

    console.log(`[RowSerializer.serializeForStorage] Row ${row.id.value}:`, {
      fieldCount: fields.length,
      plainKeys: Object.keys(plain)
    });

    // Only copy expected fields (id + field names)
    result.id = plain.id;

    for (const field of fields) {
      const value = plain[field.name];

      // AIDEV-NOTE: Complex field types need to be wrapped with field name for Delta Lake storage
      // This creates: {fieldName: [...]} which allows proper deserialization
      // The wrapper helps identify the field when parsing JSON from Delta Lake
      if (['relation', 'document', 'file'].includes(field.type)) {
        console.log(`[RowSerializer.serializeForStorage] Field "${field.name}":`, {
          type: field.type,
          valueType: typeof value,
          isArray: Array.isArray(value),
          value: Array.isArray(value) ? `array[${value.length}]` : value
        });

        // Wrap arrays/objects with field name: [...] → {fieldName: [...]}
        if (value && (Array.isArray(value) || typeof value === 'object')) {
          result[field.name] = { [field.name]: value };
        } else {
          // null, undefined, or primitive → keep as-is
          result[field.name] = value;
        }
      } else {
        // Non-complex fields: copy as-is
        result[field.name] = value;
      }
    }

    return result;
  }

  /**
   * Deserialize data from Delta Lake storage to Row-compatible format
   * Parses JSON strings for complex field types and filters out unexpected fields
   *
   * @param data - Raw data from Delta Lake via Arrow IPC
   * @param fields - Table field definitions
   * @returns Plain object ready for Row.fromPlainObject()
   */
  static deserializeFromStorage(data: Record<string, any>, fields: readonly TableField[]): Record<string, any> {
    // AIDEV-NOTE: Build result from scratch to avoid preserving corrupted keys
    // DO NOT use { ...data } as it would preserve numeric keys from corrupted data
    const result: Record<string, any> = {};

    // Always include id field
    result.id = data.id;

    // Copy only expected fields
    // Complex field types (relation, document, file) are stored as JSON strings in Delta Lake
    for (const field of fields) {
      const value = data[field.name];

      // Parse JSON strings for complex field types
      if (['relation', 'document', 'file'].includes(field.type)) {
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value);

            // AIDEV-NOTE: Unwrap the field-named wrapper object
            // Storage format: '{"docs": [...]}' → Return: [...]
            // This ensures the domain layer receives plain arrays, not wrapped objects
            if (parsed && typeof parsed === 'object' && field.name in parsed) {
              result[field.name] = parsed[field.name];
            } else {
              // Fallback: use parsed value directly (for legacy data)
              result[field.name] = parsed;
            }
          } catch (e) {
            console.warn(`[RowSerializer.deserializeFromStorage] Failed to parse JSON for field "${field.name}":`, e);
            result[field.name] = value; // Keep as-is if parse fails
          }
        } else {
          // null, undefined, or empty string
          result[field.name] = value;
        }
      } else {
        // Non-complex fields: copy as-is
        result[field.name] = value;
      }
    }

    return result;
  }
}
