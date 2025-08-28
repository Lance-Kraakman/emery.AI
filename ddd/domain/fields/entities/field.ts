// AIDEV-NOTE: Field domain entities - manages dynamic table field definitions in Baserow-style system
// Fields create field_{id} columns in dynamic tables with proper type mapping and indexes

import { FieldId, TableId } from '@/ddd/domain/shared/value-objects';

export class Field {
  private constructor(
    private readonly _id: FieldId,
    private readonly _tableId: TableId,
    private _name: string,
    private _slug: string,                        // URL-safe field identifier
    private _type: FieldType,
    private _orderIndex: number | null,
    private readonly _relatedTableId: TableId | null,     // For relation field types
    private _required: boolean | null,           // Align with actions interface (not optional)
    private _metadata: Record<string, any> | undefined,     // Additional field metadata
    private readonly _createdAt: Date | null
  ) {}

  // Getters
  get id(): FieldId { return this._id; }
  get tableId(): TableId { return this._tableId; }
  get name(): string { return this._name; }
  get slug(): string { return this._slug; }
  get type(): FieldType { return this._type; }
  get orderIndex(): number | null { return this._orderIndex; }
  get relatedTableId(): TableId | null { return this._relatedTableId; }
  get required(): boolean | null { return this._required; }
  get metadata(): Record<string, any> | undefined { return this._metadata ? { ...this._metadata } : undefined; }
  get createdAt(): Date | null { return this._createdAt ? new Date(this._createdAt) : null; }

  // Business methods
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Field name cannot be empty');
    }
    if (newName.length > 100) {
      throw new Error('Field name cannot exceed 100 characters');
    }
    this._name = newName.trim();
  }

  updateSlug(newSlug: string): void {
    if (!newSlug || newSlug.trim().length === 0) {
      throw new Error('Field slug cannot be empty');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newSlug)) {
      throw new Error('Field slug must contain only letters, numbers, underscores, and hyphens');
    }
    this._slug = newSlug.trim();
  }

  updateRequired(required: boolean): void {
    this._required = required;
  }

  updateOrderIndex(orderIndex: number | null): void {
    if (orderIndex !== null && orderIndex < 0) {
      throw new Error('Order index must be non-negative');
    }
    this._orderIndex = orderIndex;
  }

  updateMetadata(metadata: Record<string, any> | undefined): void {
    this._metadata = metadata ? { ...metadata } : undefined;
  }

  canBeDeleted(): boolean {
    // Add business logic for when fields can be deleted
    // For example, required fields with data might not be deletable
    return true; // Placeholder - implement actual business rules
  }

  isRelationField(): boolean {
    return this._type === 'relation';
  }

  isFileField(): boolean {
    return this._type === 'file';
  }

  requiresIndex(): boolean {
    return JSONB_FIELD_TYPES.includes(this._type);
  }

  getColumnName(): string {
    return `field_${this._id.value}`;
  }

  getPostgresType(): string {
    return FIELD_TYPE_MAPPING[this._type];
  }

  // Factory methods - entity only created from persistence with real ID

  static fromPersistence(data: {
    id: number;
    tableId: number;
    name: string;
    slug: string;
    type: FieldType;
    orderIndex: number | null;
    relatedTableId: number | null;
    required: boolean | null;
    metadata?: Record<string, any>;
    createdAt: Date | null;
  }): Field {
    return new Field(
      FieldId.fromNumber(data.id),
      TableId.fromNumber(data.tableId),
      data.name,
      data.slug,
      data.type,
      data.orderIndex,
      data.relatedTableId ? TableId.fromNumber(data.relatedTableId) : null,
      data.required,
      data.metadata,
      data.createdAt
    );
  }

  // Conversion method for persistence
  toPersistence(): {
    id: number;
    tableId: number;
    name: string;
    slug: string;
    type: FieldType;
    orderIndex: number | null;
    relatedTableId: number | null;
    required: boolean | null;
    metadata?: Record<string, any>;
    createdAt: Date | null;
  } {
    return {
      id: this._id.value,
      tableId: this._tableId.value,
      name: this._name,
      slug: this._slug,
      type: this._type,
      orderIndex: this._orderIndex,
      relatedTableId: this._relatedTableId?.value ?? null,
      required: this._required,
      metadata: this._metadata,
      createdAt: this._createdAt
    };
  }
}

export interface CreateFieldData {
  tableId: TableId;
  name: string;
  slug: string;                        // Generated from name via slugify
  type: FieldType;
  orderIndex?: number;
  relatedTableId?: TableId;            // Required for relation fields
  required?: boolean;
  metadata?: Record<string, any>;      // Additional field metadata
}

export interface UpdateFieldData {
  name?: string;
  slug?: string;
  type?: FieldType;
  orderIndex?: number;
  relatedTableId?: TableId;
  required?: boolean;
  metadata?: Record<string, any>;      // Additional field metadata
  // Note: tableId typically not changed after creation
}

// Supported field types with PostgreSQL mapping
export type FieldType = 
  | 'text'           // TEXT
  | 'number'         // INTEGER
  | 'boolean'        // BOOLEAN
  | 'email'          // TEXT with validation
  | 'url'            // TEXT with validation
  | 'date'           // DATE
  | 'relation'       // JSONB with GIN index
  | 'file';          // JSONB with GIN index for file metadata

// Type mapping from field types to PostgreSQL types
export const FIELD_TYPE_MAPPING: Record<FieldType, string> = {
  text: 'TEXT',
  number: 'INTEGER', 
  boolean: 'BOOLEAN',
  email: 'TEXT',
  url: 'TEXT',
  date: 'DATE',
  relation: 'JSONB',
  file: 'JSONB',
} as const;

// Field types that require GIN indexes for performance
export const JSONB_FIELD_TYPES: FieldType[] = ['relation', 'file'];

// Field validation and constraints
export interface FieldValidation {
  field: Field;
  isValid: boolean;
  errors: FieldValidationError[];
}

export interface FieldValidationError {
  type: 'MISSING_RELATED_TABLE' | 'INVALID_TYPE' | 'DUPLICATE_SLUG' | 'INVALID_NAME';
  message: string;
  field?: string;
}

// Baserow-style Link to Table field value structure
export interface LinkToTableValue {
  id: string;                            // Related record UUID
  value: string;                         // Display value from primary field
  tableId?: TableId;                     // Related table ID for validation
}

// S3-integrated file field value structure  
export interface FileFieldValue {
  id: string;                            // File UUID from S3 operations
  name: string;                          // Original filename
  size: number;                          // File size in bytes
  mimeType: string;                      // MIME type
  s3Key: string;                         // S3 object key for access
  url?: string;                          // Pre-signed download URL (temporary)
  uploadedAt: string;                    // ISO timestamp
  metadata?: {                           // Additional S3 metadata
    organizationId?: number;
    tableId?: TableId;
    fieldId?: FieldId;
    [key: string]: any;
  };
  thumbnails?: Array<{                   // Generated thumbnails (for images)
    size: string;                        // e.g., 'small', 'medium', 'large'
    s3Key: string;                       // Thumbnail S3 key
    url?: string;                        // Pre-signed thumbnail URL
  }>;
}


export interface RelationValue {
  id: string;                           // Related record ID
  displayValue?: string;                // Formatted display value
  [key: string]: any;                   // Additional related record data
}

// S3-integrated file field configuration
export interface FileFieldConfig {
  allowedTypes?: string[];              // MIME types: ['image/*', 'application/pdf']
  maxSize?: number;                     // Max file size in bytes (defaults to env MAX_FILE_SIZE)
  maxFiles?: number;                    // Max number of files per field
  multiple?: boolean;                   // Allow multiple file uploads (defaults to false)
  generateThumbnails?: boolean;         // Auto-generate image thumbnails
  thumbnailSizes?: string[];            // Thumbnail sizes: ['small', 'medium', 'large']
  s3BucketName?: string;               // Override default S3 bucket
  compressionEnabled?: boolean;         // Enable file compression
}

