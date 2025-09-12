/**
 * Field Value Types - Core Domain Types Only
 * 
 * Contains only the essential domain types for field values and row data.
 * Application-layer command DTOs and infrastructure types are defined elsewhere.
 * 
 * AIDEV-NOTE: Cleaned up to contain only true domain concepts. No fake abstraction layers.
 * Complex types (file, relation) use internal storage structures.
 */

// ========================================
// Baserow-Compatible File Structure
// ========================================

export interface FileFieldValue {
  id: string;                    // Unique file identifier
  name: string;                  // Original filename
  size: number;                  // File size in bytes
  mimeType: string;              // MIME type (e.g., "image/jpeg")
  s3Key: string;                 // S3 storage key for retrieval
  uploadedAt: string;            // ISO date string when uploaded
}

// ========================================
// Baserow-Compatible Relation Structure  
// ========================================

export interface RelationFieldValue {
  id: string | number;           // Referenced record ID (flexible type for compatibility)
  value: string;                 // Display value from related record
  // Additional metadata can be added as needed for specific relation types
}

// ========================================
// Primitive Field Value Types
// ========================================

export type TextFieldValue = string;
export type NumberFieldValue = number;
export type BooleanFieldValue = boolean;
export type DateFieldValue = Date | string;  // Can be Date object or ISO string

// ========================================
// Complex Field Value Types (Arrays)
// ========================================

export type FileArrayFieldValue = FileFieldValue[];
export type RelationArrayFieldValue = RelationFieldValue[];

// ========================================
// Document Field Value Types
// ========================================

export interface DocumentMetadata {
  title: string;
  version: number;
  documentType: 'tiptap' | 'file';
  lastEditedBy?: string;
  lastEditedAt?: string;
  tiptapMetadata?: {
    wordCount?: number;
    characterCount?: number;
    estimatedReadTime?: number;
  };
}

export interface DocumentFieldValue extends FileFieldValue {
  documentMetadata?: DocumentMetadata;
}

export type DocumentArrayFieldValue = DocumentFieldValue[];

// ========================================
// Union Type for All Field Values
// ========================================

export type FieldValue = 
  | TextFieldValue
  | NumberFieldValue
  | BooleanFieldValue
  | DateFieldValue
  | FileArrayFieldValue
  | RelationArrayFieldValue
  | DocumentArrayFieldValue;

// ========================================
// Type Guard Functions
// ========================================

export function isFileArray(value: unknown): value is FileArrayFieldValue {
  return Array.isArray(value) && 
    (value.length === 0 || (
      typeof value[0] === 'object' && 
      value[0] !== null &&
      'id' in value[0] && 
      'name' in value[0] && 
      'size' in value[0] &&
      'mimeType' in value[0] &&
      's3Key' in value[0] &&
      'uploadedAt' in value[0]
    ));
}

// ========================================
// Validation Result Types  
// ========================================

export interface FieldValidationError {
  field: string;
  error: string;
}

export interface FieldValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
}

// ========================================
// Type Mapping Utilities
// ========================================

/**
 * Maps field types to their corresponding TypeScript types
 * Useful for dynamic type checking and validation
 */
export const FIELD_TYPE_MAPPING = {
  'text': 'string',
  'number': 'number',
  'boolean': 'boolean',
  'date': 'Date | string',
  'file': 'FileFieldValue[]',
  'relation': 'RelationFieldValue[]',
  'document': 'DocumentFieldValue[]',
  'tiptap_doc': 'DocumentFieldValue[]'
} as const;

/**
 * Field types that are arrays (for validation purposes)
 */
export const ARRAY_FIELD_TYPES = ['file', 'relation', 'document', 'tiptap_doc'] as const;

/**
 * Field types that store complex data structures (internal detail)
 */
export const COMPLEX_STORAGE_TYPES = ['file', 'relation', 'document', 'tiptap_doc'] as const;

/**
 * Runtime validation for FileFieldValue - ensures required fields exist and are valid
 */
export function validateFileFieldValue(value: any): asserts value is FileFieldValue {
  if (!value || typeof value !== 'object') {
    throw new Error(`FileFieldValue must be an object but got: ${typeof value}`);
  }
  
  if (!value.name || typeof value.name !== 'string') {
    throw new Error(`FileFieldValue.name is required string but got: ${value.name} (type: ${typeof value.name})`);
  }
  
  if (!value.uploadedAt || typeof value.uploadedAt !== 'string') {
    throw new Error(`FileFieldValue.uploadedAt is required string but got: ${value.uploadedAt} (type: ${typeof value.uploadedAt})`);
  }
  
  // Validate uploadedAt is valid ISO string
  if (isNaN(Date.parse(value.uploadedAt))) {
    throw new Error(`FileFieldValue.uploadedAt must be valid ISO string but got: ${value.uploadedAt}`);
  }
  
  if (!value.id || typeof value.id !== 'string') {
    throw new Error(`FileFieldValue.id is required string but got: ${value.id}`);
  }
  
  if (typeof value.size !== 'number' || value.size < 0) {
    throw new Error(`FileFieldValue.size must be non-negative number but got: ${value.size}`);
  }
  
  if (!value.mimeType || typeof value.mimeType !== 'string') {
    throw new Error(`FileFieldValue.mimeType is required string but got: ${value.mimeType}`);
  }
  
  if (!value.s3Key || typeof value.s3Key !== 'string') {
    throw new Error(`FileFieldValue.s3Key is required string but got: ${value.s3Key}`);
  }
}

/**
 * Runtime validation for DocumentFieldValue
 */
export function validateDocumentFieldValue(value: any): asserts value is DocumentFieldValue {
  validateFileFieldValue(value); // First validate as file
  
  // DocumentFieldValue extends FileFieldValue, so additional validation can go here if needed
  // documentMetadata is optional, so no validation required
}

/**
 * Type guard to check if a value is a DocumentFieldValue
 */
export function isDocumentFieldValue(value: any): value is DocumentFieldValue {
  return value && 
         typeof value === 'object' && 
         'mimeType' in value && 
         'size' in value && 
         'uploadedAt' in value;
         // documentMetadata is optional, so no validation required
}

/**
 * Type guard to check if a value is a DocumentArrayFieldValue (array of documents)
 */
export function isDocumentArray(value: any): value is DocumentArrayFieldValue {
  return Array.isArray(value) && 
    (value.length === 0 || isDocumentFieldValue(value[0]));
}

/**
 * Type guard to check if a value can be handled as document field data
 * (either a document array or null/undefined - single documents will be normalized to arrays)
 */
export function isDocumentFieldData(value: any): value is DocumentArrayFieldValue | null | undefined {
  return value === null || 
         value === undefined || 
         isDocumentArray(value) || 
         isDocumentFieldValue(value); // Single documents are handled by normalization
}

/**
 * Safely normalize any document field value to an array
 */
export function normalizeDocumentFieldValue(value: any): DocumentArrayFieldValue {
  if (!value) return [];
  if (isDocumentArray(value)) return value;
  if (isDocumentFieldValue(value)) return [value];
  return []; // Fallback for invalid data
}