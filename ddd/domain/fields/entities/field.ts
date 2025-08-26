// AIDEV-NOTE: Field domain entities - manages dynamic table field definitions in Baserow-style system
// Fields create field_{id} columns in dynamic tables with proper type mapping and indexes

export interface Field {
  id: number;
  tableId: number;
  name: string;
  slug: string;                        // URL-safe field identifier
  type: FieldType;
  orderIndex: number | null | undefined;  // Align with actions interface
  relatedTableId: number | null;      // For relation field types
  required: boolean | null;           // Align with actions interface (not optional)
  metadata?: Record<string, any>;     // Additional field metadata
  createdAt: Date | null;
}

export interface CreateFieldData {
  tableId: number;
  name: string;
  slug: string;                        // Generated from name via slugify
  type: FieldType;
  orderIndex?: number;
  relatedTableId?: number;             // Required for relation fields
  required?: boolean;
  metadata?: Record<string, any>;      // Additional field metadata
}

export interface UpdateFieldData {
  name?: string;
  slug?: string;
  type?: FieldType;
  orderIndex?: number;
  relatedTableId?: number;
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
  tableId?: number;                      // Related table ID for validation
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
    tableId?: number;
    fieldId?: number;
    [key: string]: any;
  };
  thumbnails?: Array<{                   // Generated thumbnails (for images)
    size: string;                        // e.g., 'small', 'medium', 'large'
    s3Key: string;                       // Thumbnail S3 key
    url?: string;                        // Pre-signed thumbnail URL
  }>;
}


// Helper type for JSON field values
export type FieldValue = 
  | string                               // text, email, url
  | number                               // number
  | boolean                              // boolean
  | Date | string                        // date (ISO string or Date)
  | LinkToTableValue[]                   // relation (array of linked records)
  | FileFieldValue[]                     // file (array of file objects)
  | null;

// Field operations and transformations
export interface FieldOperation {
  type: 'ADD_FIELD' | 'REMOVE_FIELD' | 'MODIFY_FIELD' | 'REORDER_FIELDS';
  fieldId?: number;
  oldField?: Field;
  newField?: CreateFieldData | UpdateFieldData;
  parameters?: Record<string, any>;
}

// Bulk field operations
export interface BulkFieldOperation {
  tableId: number;
  operations: FieldOperation[];
  validateOnly?: boolean;               // If true, only validate without executing
}

// Field statistics and metadata
export interface FieldStats {
  field: Field;
  valueCount: number;                   // Non-null values
  uniqueCount?: number;                 // Unique values (for applicable types)
  commonValues?: Array<{
    value: any;
    count: number;
  }>;
  lastUpdated?: Date;
}

// Field processing utilities
export interface FieldProcessingOptions {
  validateRequired?: boolean;
  parseJson?: boolean;                   // Auto-parse JSON strings for JSONB fields
  debug?: boolean;
}

// Utility functions for field value processing
export const isJsonbField = (fieldType: FieldType): boolean => {
  return JSONB_FIELD_TYPES.includes(fieldType);
};

export const getPostgresType = (fieldType: FieldType): string => {
  return FIELD_TYPE_MAPPING[fieldType] || 'TEXT';
};

export const needsGinIndex = (fieldType: FieldType): boolean => {
  return isJsonbField(fieldType);
};

// Baserow-style Link to Table field configuration
export interface LinkToTableConfig {
  relatedTableId: number;
  allowMultiple?: boolean;              // false = one-to-one, true = one/many-to-many
  reverseFieldName?: string;            // Auto-created reverse field name
  displayField?: string;                // Which field from related table to show (defaults to primary)
  cascadeDelete?: boolean;              // Delete related records on parent delete
  createReverseField?: boolean;         // Automatically create bidirectional link
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

// Complex field queries
export interface FieldQuery {
  tableId?: number;
  types?: FieldType[];
  required?: boolean;
  orderBy?: 'name' | 'orderIndex' | 'createdAt';
  orderDirection?: 'ASC' | 'DESC';
}

// Field migration support
export interface FieldMigration {
  id: string;
  fieldId: number;
  fromType: FieldType;
  toType: FieldType;
  transformFunction?: string;           // SQL transformation function
  dataLossRisk: 'none' | 'low' | 'medium' | 'high';
  createdAt: Date;
}

// Enhanced field management
export interface FieldTemplate {
  name: string;
  type: FieldType;
  defaultConfig?: Record<string, any>;
  validation?: Record<string, any>;
  description?: string;
}

export interface FieldGroup {
  id: number;
  tableId: number;
  name: string;
  fieldIds: number[];
  collapsed?: boolean;
  orderIndex?: number;
}