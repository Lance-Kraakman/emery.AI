/**
 * TableField Value Object
 * 
 * Simplified field representation as value object within DynamicTable aggregate.
 * Replaces the separate Field entity to properly model "Table owns Fields" relationship.
 * 
 * AIDEV-NOTE: Consolidates field logic into table aggregate - fields cannot exist without table.
 * Combines validation, processing, and mapping concerns into single cohesive value object.
 */

import { FieldId, TableId } from '@/ddd/domain/shared/value-objects';

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'relation'
  | 'file'
  | 'document'
  | 'embedding';

export interface EmbeddingFieldMetadata {
  embeddingSize: 384 | 768 | 1536 | 3072;
  sourceFieldId?: number;
  model?: string;
  normalize?: boolean;
}

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
    private readonly _id: FieldId,                     // Database ID for persistence
    private readonly _name: string,
    private readonly _type: FieldType,
    private readonly _orderIndex: number | null,
    private readonly _relatedTableId: TableId | null, // For relation field types
    private readonly _required: boolean | null,
    private readonly _metadata: Record<string, any> | undefined,
    private readonly _createdAt: Date | null
  ) {}

  // Getters
  get id(): FieldId { return this._id; }
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
      FieldId.newEntity(), // Temporary ID - will be set on persistence
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
      FieldId.fromNumber(data.id),
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
      'number': 'DOUBLE PRECISION',
      'boolean': 'BOOLEAN',
      'date': 'TIMESTAMP WITH TIME ZONE',
      'relation': 'JSONB',
      'file': 'JSONB',
      'document': 'JSONB',
      'embedding': 'JSONB'  // Metadata stored in PostgreSQL, vectors in Delta Lake
    };

    return typeMapping[this._type];
  }

  requiresGinIndex(): boolean {
    const complexTypes: FieldType[] = ['relation', 'file', 'document'];
    return complexTypes.includes(this._type);
  }

  // Validation methods (consolidated from FieldProcessor)
  private validateFileArray(value: unknown): { valid: boolean; error?: string } {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${this._name} must be an array of files` };
    }

    if (value.length === 0) {
      return { valid: true }; // Empty array is valid
    }

    const requiredFields = ['id', 'name', 'size', 'mimeType', 's3Key', 'uploadedAt'];

    for (let i = 0; i < value.length; i++) {
      const file = value[i];

      if (typeof file !== 'object' || file === null) {
        return { valid: false, error: `${this._name}[${i}] must be a file object` };
      }

      // Check required fields
      for (const field of requiredFields) {
        if (!(field in file)) {
          return { valid: false, error: `${this._name}[${i}] missing required field: ${field}` };
        }
      }

      // Validate field types
      if (typeof file.size !== 'number' || file.size < 0) {
        return { valid: false, error: `${this._name}[${i}].size must be a positive number` };
      }

      if (typeof file.name !== 'string' || !file.name) {
        return { valid: false, error: `${this._name}[${i}].name must be a non-empty string` };
      }

      if (typeof file.mimeType !== 'string') {
        return { valid: false, error: `${this._name}[${i}].mimeType must be a string` };
      }

      if (typeof file.id !== 'string' || !file.id) {
        return { valid: false, error: `${this._name}[${i}].id must be a non-empty string` };
      }

      if (typeof file.s3Key !== 'string' || !file.s3Key) {
        return { valid: false, error: `${this._name}[${i}].s3Key must be a non-empty string` };
      }

      if (typeof file.uploadedAt !== 'string' || !file.uploadedAt) {
        return { valid: false, error: `${this._name}[${i}].uploadedAt must be a non-empty string` };
      }
    }

    return { valid: true };
  }

  private validateRelationArray(value: unknown): { valid: boolean; error?: string } {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${this._name} must be an array of relations` };
    }

    if (value.length === 0) {
      return { valid: true }; // Empty array is valid
    }

    for (let i = 0; i < value.length; i++) {
      const relation = value[i];

      if (typeof relation !== 'object' || relation === null) {
        return { valid: false, error: `${this._name}[${i}] must be a relation object` };
      }

      if (!('id' in relation) || !relation.id) {
        return { valid: false, error: `${this._name}[${i}] missing required field: id` };
      }

      if (!('value' in relation)) {
        return { valid: false, error: `${this._name}[${i}] missing required field: value` };
      }

      // Validate field types
      if (typeof relation.id !== 'string' && typeof relation.id !== 'number') {
        return { valid: false, error: `${this._name}[${i}].id must be a string or number` };
      }

      if (typeof relation.value !== 'string') {
        return { valid: false, error: `${this._name}[${i}].value must be a string` };
      }
    }

    return { valid: true };
  }

  private validateEmbeddingArray(value: unknown): { valid: boolean; error?: string } {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${this._name} must be an array of numbers` };
    }

    if (value.length === 0) {
      return { valid: true }; // Empty array is valid (no embedding yet)
    }

    // All elements must be numbers
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number') {
        return { valid: false, error: `${this._name}[${i}] must be a number` };
      }
    }

    // Validate dimension matches field metadata
    const metadata = this._metadata as EmbeddingFieldMetadata | undefined;
    if (metadata && metadata.embeddingSize) {
      if (value.length !== metadata.embeddingSize) {
        return {
          valid: false,
          error: `${this._name} must have ${metadata.embeddingSize} dimensions, got ${value.length}`
        };
      }
    }

    return { valid: true };
  }

  // Persistence conversion
  toPersistence(tableId: number): Omit<TableFieldPersistence, 'createdAt'> {
    return {
      id: this._id.value,
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