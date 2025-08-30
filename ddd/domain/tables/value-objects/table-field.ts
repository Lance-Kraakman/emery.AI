/**
 * TableField Value Object
 * 
 * Simplified field representation as value object within DynamicTable aggregate.
 * Replaces the separate Field entity to properly model "Table owns Fields" relationship.
 * 
 * AIDEV-NOTE: Consolidates field logic into table aggregate - fields cannot exist without table.
 * Combines validation, processing, and mapping concerns into single cohesive value object.
 */

import { TableId } from '@/ddd/domain/shared/value-objects';

export type FieldType = 
  | 'text' 
  | 'email' 
  | 'url' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'relation' 
  | 'file' 
  | 'jsonb';

export interface CreateTableFieldData {
  name: string;
  type: FieldType;
  orderIndex?: number;
  relatedTableId?: TableId;
  required?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateTableFieldData {
  name?: string;
  type?: FieldType;
  orderIndex?: number;
  relatedTableId?: TableId;
  required?: boolean;
  metadata?: Record<string, any>;
}

export interface TableFieldPersistence {
  id: number;
  tableId: number;
  name: string;
  type: FieldType;
  orderIndex: number | null;
  relatedTableId: number | null;
  required: boolean | null;
  metadata?: Record<string, any>;
  createdAt: Date | null;
}

export class TableField {
  private constructor(
    private readonly _id: number,                     // Database ID for persistence
    private readonly _name: string,
    private readonly _type: FieldType,
    private readonly _orderIndex: number | null,
    private readonly _relatedTableId: TableId | null, // For relation field types
    private readonly _required: boolean | null,
    private readonly _metadata: Record<string, any> | undefined,
    private readonly _createdAt: Date | null
  ) {}

  // Getters
  get id(): number { return this._id; }
  get name(): string { return this._name; }
  get type(): FieldType { return this._type; }
  get orderIndex(): number | null { return this._orderIndex; }
  get relatedTableId(): TableId | null { return this._relatedTableId; }
  get required(): boolean | null { return this._required; }
  get metadata(): Record<string, any> | undefined { 
    return this._metadata ? { ...this._metadata } : undefined; 
  }
  get createdAt(): Date | null { 
    return this._createdAt ? new Date(this._createdAt) : null; 
  }

  // Factory methods
  static create(data: CreateTableFieldData): TableField {
    // Validate field data
    TableField.validateFieldData(data);
    
    return new TableField(
      0, // Temporary ID - will be set on persistence
      data.name,
      data.type,
      data.orderIndex || 0,
      data.relatedTableId || null,
      data.required || false,
      data.metadata,
      null // Will be set on persistence
    );
  }

  static fromPersistence(data: TableFieldPersistence): TableField {
    return new TableField(
      data.id,
      data.name,
      data.type,
      data.orderIndex,
      data.relatedTableId ? TableId.fromNumber(data.relatedTableId) : null,
      data.required,
      data.metadata,
      data.createdAt
    );
  }

  // Update methods (return new instance - immutable value object)
  updateName(newName: string): TableField {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Field name cannot be empty');
    }
    if (newName.length > 100) {
      throw new Error('Field name cannot exceed 100 characters');
    }
    
    return new TableField(
      this._id,
      newName.trim(),
      this._type,
      this._orderIndex,
      this._relatedTableId,
      this._required,
      this._metadata,
      this._createdAt
    );
  }


  updateType(newType: FieldType): TableField {
    return new TableField(
      this._id,
      this._name,
      newType,
      this._orderIndex,
      this._relatedTableId,
      this._required,
      this._metadata,
      this._createdAt
    );
  }

  // Database mapping methods (consolidated from FieldMapper)
  getColumnName(): string {
    return `field_${this._id}`;
  }

  getPostgresType(): string {
    const typeMapping: Record<FieldType, string> = {
      'text': 'TEXT',
      'email': 'VARCHAR(255)',
      'url': 'TEXT',
      'number': 'DOUBLE PRECISION',
      'boolean': 'BOOLEAN',
      'date': 'TIMESTAMP WITH TIME ZONE',
      'relation': 'JSONB',
      'file': 'JSONB',
      'jsonb': 'JSONB'
    };
    
    return typeMapping[this._type];
  }

  requiresGinIndex(): boolean {
    const jsonbTypes: FieldType[] = ['relation', 'file', 'jsonb'];
    return jsonbTypes.includes(this._type);
  }

  // Validation methods (consolidated from FieldProcessor)
  validateValue(value: unknown): { valid: boolean; error?: string } {
    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
      if (this._required) {
        return { valid: false, error: `${this._name} is required` };
      }
      return { valid: true };
    }

    // Type-specific validation
    switch (this._type) {
      case 'text':
        if (typeof value !== 'string') {
          return { valid: false, error: `${this._name} must be text` };
        }
        if (value.length > 1000) {
          return { valid: false, error: `${this._name} cannot exceed 1000 characters` };
        }
        break;

      case 'email':
        if (typeof value !== 'string') {
          return { valid: false, error: `${this._name} must be a valid email` };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { valid: false, error: `${this._name} must be a valid email address` };
        }
        break;

      case 'url':
        if (typeof value !== 'string') {
          return { valid: false, error: `${this._name} must be a valid URL` };
        }
        try {
          new URL(value);
        } catch {
          return { valid: false, error: `${this._name} must be a valid URL` };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: `${this._name} must be a number` };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: `${this._name} must be true or false` };
        }
        break;

      case 'date':
        if (!(value instanceof Date) && typeof value !== 'string') {
          return { valid: false, error: `${this._name} must be a valid date` };
        }
        if (typeof value === 'string') {
          const parsed = new Date(value);
          if (isNaN(parsed.getTime())) {
            return { valid: false, error: `${this._name} must be a valid date` };
          }
        }
        break;

      case 'relation':
      case 'file':
      case 'jsonb':
        // For JSONB fields, basic structure validation
        if (typeof value !== 'object' || Array.isArray(value)) {
          return { valid: false, error: `${this._name} must be a valid object` };
        }
        break;

      default:
        return { valid: false, error: `Unknown field type: ${this._type}` };
    }

    return { valid: true };
  }

  // Persistence conversion
  toPersistence(tableId: number): Omit<TableFieldPersistence, 'createdAt'> {
    return {
      id: this._id,
      tableId,
      name: this._name,
      type: this._type,
      orderIndex: this._orderIndex,
      relatedTableId: this._relatedTableId?.value || null,
      required: this._required,
      metadata: this._metadata
    };
  }

  // Private validation helpers
  private static validateFieldData(data: CreateTableFieldData): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Field name is required');
    }
    if (!data.type) {
      throw new Error('Field type is required');
    }
  }
}