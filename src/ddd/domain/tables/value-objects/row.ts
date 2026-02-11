/**
 * Row Value Objects
 * 
 * Domain value objects for table row data that encapsulate business rules
 * and provide type safety for row operations in dynamic tables.
 * 
 * AIDEV-NOTE: Updated to use type-safe FieldValue system instead of generic `any` types.
 * Works with new field-values.ts type definitions for better type safety.
 */

import crypto from 'crypto';
import type { FieldValue as TypedFieldValue } from './field-values';
import type { TableField } from './table-field';

export class RowId {
  constructor(private readonly _value: string) {
    if (!_value || _value.trim().length === 0) {
      throw new Error('RowId cannot be empty');
    }
    if (_value.length > 255) {
      throw new Error('RowId cannot exceed 255 characters');
    }
  }

  static fromString(value: string): RowId {
    return new RowId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: RowId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

export class FieldValue {
  constructor(
    public readonly fieldId: string,  // AIDEV-NOTE: Stores numeric field ID (e.g., "1", "10"), not field name
    public readonly value: TypedFieldValue | null | undefined,
    public readonly fieldType: string
  ) {
    if (!fieldId || fieldId.trim().length === 0) {
      throw new Error('Field ID cannot be empty');
    }
  }

  isNull(): boolean {
    return this.value === null || this.value === undefined;
  }

  equals(other: FieldValue): boolean {
    return this.fieldId === other.fieldId &&
           this.value === other.value &&
           this.fieldType === other.fieldType;
  }
}

export class Row {
  public readonly id: RowId;
  public readonly tableId: number;
  public readonly fieldValues: ReadonlyArray<FieldValue>;

  constructor(
    id: string | RowId,
    tableId: number,
    fieldValues: FieldValue[]
  ) {
    this.id = id instanceof RowId ? id : new RowId(id);
    this.tableId = tableId;
    this.fieldValues = Object.freeze([...fieldValues]);

    if (tableId <= 0) {
      throw new Error('Table ID must be positive');
    }
  }

  /**
   * Get field value by numeric field ID
   * @param fieldId - Numeric field ID as string (e.g., "1", "10", "42")
   */
  getFieldValue(fieldId: string): FieldValue | undefined {
    return this.fieldValues.find(fv => fv.fieldId === fieldId);
  }

  /**
   * Check if row has a field by numeric field ID
   * @param fieldId - Numeric field ID as string (e.g., "1", "10", "42")
   */
  hasField(fieldId: string): boolean {
    return this.fieldValues.some(fv => fv.fieldId === fieldId);
  }

  /**
   * Helper: Get field value by field name (for convenience)
   * @param fieldName - Field name to look up
   * @param fields - Table fields to resolve name → ID
   */
  getFieldValueByName(fieldName: string, fields: readonly TableField[]): FieldValue | undefined {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return undefined;
    return this.getFieldValue(field.id.value.toString());
  }


  /**
   * Convert row to plain object with both numeric field IDs and field names as keys
   * AIDEV-NOTE: Outputs both formats to support:
   * - Field ID keys (e.g., {42: "value"}) for internal code
   * - Field name keys (e.g., {document_id: "value"}) for action variable substitution
   * @param fields - Table fields for ID-to-name mapping
   * @returns Object with both keys: {id: "123", 42: "value", document_id: "value"}
   */
  toPlainObject(fields: readonly TableField[]): Record<string, any> {
    const obj: Record<string, any> = {
      id: this.id.value  // Include row ID in the returned data
    };

    // Build fieldId -> fieldName map for reverse lookup
    const fieldIdToName = new Map<string, string>();
    for (const field of fields) {
      fieldIdToName.set(field.id.value.toString(), field.name);
    }

    for (const fieldValue of this.fieldValues) {
      const value = fieldValue.value;

      // Add value with field ID as key (existing behavior)
      obj[fieldValue.fieldId] = value;

      // Also add value with field NAME as key (for action variables like {document_id})
      const fieldName = fieldIdToName.get(fieldValue.fieldId);
      if (fieldName) {
        obj[fieldName] = value;
      }
    }

    return obj;
  }

  /**
   * Convert row to plain object with field NAMES as keys
   * AIDEV-NOTE: Used by AutoFieldProcessor which works with field names, not IDs
   * @param fields - Table fields to map IDs to names
   * @returns Object with field name keys: {id: "123", name: "value", status: "active"}
   */
  toNamedObject(fields: readonly TableField[]): Record<string, any> {
    const obj: Record<string, any> = {
      id: this.id.value  // Include row ID in the returned data
    };

    // Create lookup map from field ID to field name
    const fieldMap = new Map<string, TableField>();
    for (const field of fields) {
      fieldMap.set(field.id.value.toString(), field);
    }

    for (const fieldValue of this.fieldValues) {
      const field = fieldMap.get(fieldValue.fieldId);
      if (!field) {
        continue; // Skip fields that don't exist in schema (shouldn't happen)
      }

      const value = fieldValue.value;

      // Keep Date objects for protobuf serialization (gRPC handles timestamps natively)
      // All types returned as-is (arrays, objects, strings, primitives, Dates)
      obj[field.name] = value;
    }

    return obj;
  }

  /**
   * Create Row from plain object with field NAMES as keys
   * AIDEV-NOTE: Used by AutoFieldProcessor which works with field names, not IDs
   * @param data - Plain object with field names: {id: "123", name: "value", status: "active"}
   * @param tableId - Table ID
   * @param tableFields - Table fields to map names to IDs
   * @returns Row entity
   */
  static fromNamedObject(
    data: Record<string, any> & { id?: string },
    tableId: number,
    tableFields: TableField[]
  ): Row {
    // Create lookup map from field name to field
    const fieldMap = new Map<string, TableField>();
    for (const field of tableFields) {
      fieldMap.set(field.name, field);
    }

    // Validate required fields
    for (const field of tableFields) {
      // Skip 'id' field - it's auto-generated if not provided
      if (field.name === 'id') {
        continue;
      }

      if (field.required && data[field.name] === undefined) {
        throw new Error(`${field.name} is required`);
      }
    }

    const fieldValues: FieldValue[] = [];

    for (const field of tableFields) {
      // Skip 'id' field - Row.id is the authoritative source
      if (field.name === 'id') {
        continue;
      }

      // Read value using field name as key
      const value = data[field.name];

      // Validate data type for non-null values
      if (value !== undefined && value !== null) {
        Row.validateFieldValue(field, value);
      }

      // Always push FieldValue for every field in schema
      // Store numeric field ID (e.g., "1", "10"), not field name
      fieldValues.push(new FieldValue(field.id.value.toString(), value, field.type));
    }

    return new Row(
      data.id || crypto.randomUUID(),
      tableId,
      fieldValues
    );
  }

  /**
   * Create Row from plain object with numeric field IDs as keys
   * AIDEV-NOTE: Reads from numeric field IDs (10, 11, 12) not field names.
   * Accepts both TableField entities and plain DTOs for flexibility.
   * @param data - Plain object with numeric field IDs: {id: "123", 10: "value", 11: "value"}
   * @param tableId - Table ID
   * @param tableFields - Table fields (entities or DTOs) to map IDs to field definitions
   * @returns Row entity
   */
  static fromPlainObject(
    data: Record<string, any> & { id?: string },
    tableId: number,
    tableFields: TableField[] | Array<{ id: number; name: string; type: string; required: boolean; [key: string]: any }>
  ): Row {
    // Helper to get field ID from either TableField entity or DTO
    const getFieldId = (field: any): number => {
      if (typeof field.id === 'number') {
        return field.id; // DTO
      }
      return field.id.value; // TableField entity
    };

    // Validate required fields
    // AIDEV-NOTE: Data uses numeric field IDs as keys, not field names
    for (const field of tableFields) {
      // Skip 'id' field - it's auto-generated if not provided
      if (field.name === 'id') {
        continue;
      }

      const fieldKey = getFieldId(field).toString();
      if (field.required && data[fieldKey] === undefined) {
        throw new Error(`${field.name} (field ${fieldKey}) is required`);
      }
    }

    const fieldValues: FieldValue[] = [];

    for (const field of tableFields) {
      // Skip 'id' field - Row.id is the authoritative source, not fieldValues
      if (field.name === 'id') {
        continue;
      }

      // Read value using numeric field ID as key
      const fieldKey = getFieldId(field).toString();
      const value = data[fieldKey];

      // AIDEV-NOTE: CRITICAL FIX - Always include ALL fields, even if null/undefined
      // This prevents data loss during partial updates where only changed fields are sent.
      // Previously, null/undefined optional fields were skipped, causing them to be lost
      // when Row.toPlainObject() was called (it only returns fields with FieldValue objects).

      // Validate data type for non-null values
      if (value !== undefined && value !== null) {
        Row.validateFieldValue(field, value);
      }

      // Always push FieldValue for every field in schema, preserving complete row state
      // AIDEV-NOTE: Store numeric field ID (e.g., "1", "10"), not field name
      fieldValues.push(new FieldValue(getFieldId(field).toString(), value, field.type));
    }

    return new Row(
      data.id || crypto.randomUUID(),
      tableId,
      fieldValues
    );
  }

  private static validateFieldValue(field: TableField | { name: string; type: string; [key: string]: any }, value: any): void {
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(Number(value)))) {
          throw new Error(`${field.name} must be a number`);
        }
        break;

      case 'file':
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const file = value[i];
            if (!file || typeof file !== 'object') {
              throw new Error(`${field.name}[${i}] must be an object`);
            }

            // Validate required file properties
            const requiredFileProps = ['id', 'name', 'size', 'mimeType', 's3Key', 'uploadedAt'];
            for (const prop of requiredFileProps) {
              if (!file[prop]) {
                throw new Error(`${field.name}[${i}] missing required field: ${prop}`);
              }
            }
          }
        }
        break;

      case 'email':
        // If field is a TableField instance, use its validation method
        if ('validateEmail' in field && typeof field.validateEmail === 'function') {
          field.validateEmail(value);
        } else {
          // Fallback for FieldDTO - inline validation
          if (value !== null && value !== undefined) {
            if (typeof value !== 'string') {
              throw new Error(`${field.name} must be a string`);
            }
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            if (!emailRegex.test(value) || value.length > 320) {
              throw new Error(`${field.name} must be a valid email address`);
            }
          }
        }
        break;

      case 'phone':
        // If field is a TableField instance, use its validation method
        if ('validatePhone' in field && typeof field.validatePhone === 'function') {
          field.validatePhone(value);
        } else {
          // Fallback for FieldDTO - inline validation
          if (value !== null && value !== undefined) {
            if (typeof value !== 'string') {
              throw new Error(`${field.name} must be a string`);
            }
            const normalized = value.replace(/[\s\-\(\)]/g, '');
            const e164Regex = /^\+?[1-9]\d{1,14}$/;
            if (!e164Regex.test(normalized)) {
              throw new Error(`${field.name} must be a valid phone number (E.164 format)`);
            }
          }
        }
        break;

      case 'single-select':
        // If field is a TableField instance, use its validation method
        if ('validateSingleSelect' in field && typeof field.validateSingleSelect === 'function') {
          field.validateSingleSelect(value);
        }
        // Note: No fallback validation for FieldDTO - requires field config
        break;

      case 'multi-select':
        // If field is a TableField instance, use its validation method
        if ('validateMultiSelect' in field && typeof field.validateMultiSelect === 'function') {
          field.validateMultiSelect(value);
        }
        // Note: No fallback validation for FieldDTO - requires field config
        break;
    }
  }
}

export class RowCollection {
  public readonly rows: ReadonlyArray<Row>;
  public readonly totalCount: number;

  constructor(rows: Row[], totalCount?: number) {
    this.rows = Object.freeze([...rows]);
    this.totalCount = totalCount ?? rows.length;
  }

  isEmpty(): boolean {
    return this.rows.length === 0;
  }

  first(): Row | undefined {
    return this.rows[0];
  }

  findById(id: string | RowId): Row | undefined {
    const searchId = id instanceof RowId ? id.value : id;
    return this.rows.find(row => row.id.value === searchId);
  }

  filterByField(fieldSlug: string, value: any): RowCollection {
    const filteredRows = this.rows.filter(row => {
      const fieldValue = row.getFieldValue(fieldSlug);
      return fieldValue?.value === value;
    });
    return new RowCollection(filteredRows);
  }

  toPlainObjects(fields: TableField[]): Record<string, any>[] {
    return this.rows.map(row => row.toPlainObject(fields));
  }

}