/**
 * Row Value Objects
 * 
 * Domain value objects for table row data that encapsulate business rules
 * and provide type safety for row operations in dynamic tables.
 * 
 * AIDEV-NOTE: Updated to use type-safe FieldValue system instead of generic `any` types.
 * Works with new field-values.ts type definitions for better type safety.
 */

import type { FieldValue as TypedFieldValue, RowData } from './field-values';

export class RowId {
  constructor(private readonly _value: string) {
    if (!_value || _value.trim().length === 0) {
      throw new Error('RowId cannot be empty');
    }
    if (_value.length > 255) {
      throw new Error('RowId cannot exceed 255 characters');
    }
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


  toPlainObject(): RowData {
    const obj: RowData = {};

    for (const fieldValue of this.fieldValues) {
      obj[fieldValue.fieldSlug] = fieldValue.value;
    }

    return obj;
  }

  static fromPlainObject(
    data: RowData & { id?: string }, 
    tableId: number,
    fieldSlugs: string[],
    fieldTypes: Record<string, string> = {}
  ): Row {
    const fieldValues: FieldValue[] = [];
    
    for (const slug of fieldSlugs) {
      if (slug in data && slug !== 'id') {
        const fieldType = fieldTypes[slug] || 'text';
        fieldValues.push(new FieldValue(slug, data[slug], fieldType));
      }
    }

    return new Row(
      data.id || crypto.randomUUID(),
      tableId,
      fieldValues
    );
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

  toPlainObjects(): Record<string, any>[] {
    return this.rows.map(row => row.toPlainObject());
  }

  static fromPlainObjects(
    data: Record<string, any>[],
    tableId: number,
    fieldSlugs: string[],
    fieldTypes: Record<string, string> = {},
    totalCount?: number
  ): RowCollection {
    const rows = data.map(item => 
      Row.fromPlainObject(item, tableId, fieldSlugs, fieldTypes)
    );
    return new RowCollection(rows, totalCount);
  }
}