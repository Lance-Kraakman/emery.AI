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
import { TableId } from '../../shared/value-objects';

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
    public readonly fieldSlug: string,
    public readonly value: TypedFieldValue | null | undefined,
    public readonly fieldType: string
  ) {
    if (!fieldSlug || fieldSlug.trim().length === 0) {
      throw new Error('Field slug cannot be empty');
    }
  }

  isNull(): boolean {
    return this.value === null || this.value === undefined;
  }

  equals(other: FieldValue): boolean {
    return this.fieldSlug === other.fieldSlug && 
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

  getFieldValue(fieldSlug: string): FieldValue | undefined {
    return this.fieldValues.find(fv => fv.fieldSlug === fieldSlug);
  }

  hasField(fieldSlug: string): boolean {
    return this.fieldValues.some(fv => fv.fieldSlug === fieldSlug);
  }


  /**
   * Convert row to plain object with numeric field IDs as keys
   * AIDEV-NOTE: Uses field IDs (10, 11, 12) instead of field names for Delta Lake storage.
   * Field IDs are immutable, allowing field name changes without breaking data.
   * @param fields - Table fields to map field names to IDs
   * @returns Object with numeric field ID keys: {id: "123", 10: "value", 11: "value"}
   */
  toPlainObject(fields: readonly TableField[]): Record<string, any> {
    const obj: Record<string, any> = {
      id: this.id.value  // Include row ID in the returned data
    };

    for (const fieldValue of this.fieldValues) {
      // Find the field definition to get its numeric ID
      const field = fields.find(f => f.name === fieldValue.fieldSlug);
      if (!field) {
        console.warn(`[Row.toPlainObject] Field not found for slug: ${fieldValue.fieldSlug}`);
        continue;
      }

      const value = fieldValue.value;

      // Convert Date objects to ISO strings for JSON serialization
      if (fieldValue.fieldType === 'date' && value instanceof Date) {
        obj[field.id.value] = value.toISOString();
      } else {
        // All other types: return value as-is (arrays, objects, strings, primitives)
        obj[field.id.value] = value;
      }
    }

    return obj;
  }

  /**
   * Create Row from plain object with numeric field IDs as keys
   * AIDEV-NOTE: Reads from numeric field IDs (10, 11, 12) not field names.
   * @param data - Plain object with numeric field IDs: {id: "123", 10: "value", 11: "value"}
   * @param tableId - Table ID
   * @param tableFields - Table fields to map IDs to field definitions
   * @returns Row entity
   */
  static fromPlainObject(
    data: Record<string, any> & { id?: string },
    tableId: number,
    tableFields: TableField[]
  ): Row {
    // Validate required fields
    // AIDEV-NOTE: Data uses numeric field IDs as keys, not field names
    for (const field of tableFields) {
      // Skip 'id' field - it's auto-generated if not provided
      if (field.name === 'id') {
        continue;
      }

      const fieldKey = field.id.value.toString();
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
      const fieldKey = field.id.value.toString();
      const value = data[fieldKey];

      // AIDEV-NOTE: Debug logging for document field values
      if (field.type === 'document' || field.type === 'file') {
        console.log(`[Row.fromPlainObject] ${field.type} field "${field.name}" (ID ${fieldKey}) incoming value:`, JSON.stringify(value, null, 2));
      }

      // AIDEV-NOTE: CRITICAL FIX - Always include ALL fields, even if null/undefined
      // This prevents data loss during partial updates where only changed fields are sent.
      // Previously, null/undefined optional fields were skipped, causing them to be lost
      // when Row.toPlainObject() was called (it only returns fields with FieldValue objects).

      // Validate data type for non-null values
      if (value !== undefined && value !== null) {
        Row.validateFieldValue(field, value);
      }

      // Always push FieldValue for every field in schema, preserving complete row state
      fieldValues.push(new FieldValue(field.name, value, field.type));
    }

    return new Row(
      data.id || crypto.randomUUID(),
      tableId,
      fieldValues
    );
  }

  private static validateFieldValue(field: TableField, value: any): void {
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