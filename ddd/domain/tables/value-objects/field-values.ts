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
// Union Type for All Field Values
// ========================================

export type FieldValue = 
  | TextFieldValue
  | NumberFieldValue
  | BooleanFieldValue
  | DateFieldValue
  | FileArrayFieldValue
  | RelationArrayFieldValue;

// ========================================
// Row Data Interface (Domain-Focused)
// ========================================

/**
 * Row data using field names as keys (not database column names)
 * This is the user-facing interface that domain services work with
 */
export interface RowData {
  id?: string;  // Row identifier (present in repository results, optional for input)
  [fieldName: string]: FieldValue | null | undefined;
}


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

export function isRelationArray(value: unknown): value is RelationArrayFieldValue {
  return Array.isArray(value) && 
    (value.length === 0 || (
      typeof value[0] === 'object' && 
      value[0] !== null &&
      'id' in value[0] && 
      'value' in value[0]
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
  'relation': 'RelationFieldValue[]'
} as const;

/**
 * Field types that are arrays (for validation purposes)
 */
export const ARRAY_FIELD_TYPES = ['file', 'relation'] as const;

/**
 * Field types that store complex data structures (internal detail)
 */
export const COMPLEX_STORAGE_TYPES = ['file', 'relation'] as const;