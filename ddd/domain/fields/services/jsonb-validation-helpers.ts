/**
 * JSONB Validation Helpers
 * 
 * Helper functions for validating Baserow-style JSONB field structures.
 * Ensures relation and file fields conform to proper structured data formats.
 * 
 * AIDEV-NOTE: Extracted validation logic to align with Baserow's JSONB approach.
 * Provides reusable validation functions for relation and file field structures.
 */

import type { LinkToTableValue, FileFieldValue, RelationValue } from '../entities/field';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a value is a proper relation field array structure
 * Follows Baserow's LinkToTableValue format
 */
export function validateRelationFieldStructure(value: unknown): ValidationResult {
  if (!Array.isArray(value)) {
    return { valid: false, error: 'Relation field must be an array of relationship objects' };
  }
  
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `Relation item at index ${i} must be an object` };
    }
    
    // Check for required LinkToTableValue/RelationValue fields
    if (!('id' in item) || typeof item.id !== 'string') {
      return { valid: false, error: `Relation item at index ${i} must have a string id field` };
    }
    
    // Optional validation for displayValue (common in Baserow)
    if ('displayValue' in item && typeof item.displayValue !== 'string') {
      return { valid: false, error: `Relation item at index ${i} displayValue must be a string if provided` };
    }
    
    // Optional validation for tableId (used in LinkToTableValue)
    if ('tableId' in item && typeof item.tableId !== 'number') {
      return { valid: false, error: `Relation item at index ${i} tableId must be a number if provided` };
    }
  }
  
  return { valid: true };
}

/**
 * Validate that a value is a proper file field array structure
 * Follows FileFieldValue format with S3 integration
 */
export function validateFileFieldStructure(value: unknown): ValidationResult {
  if (!Array.isArray(value)) {
    return { valid: false, error: 'File field must be an array of file objects' };
  }
  
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `File item at index ${i} must be an object` };
    }
    
    // Check for required FileFieldValue fields
    const requiredFields = [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'size', type: 'number' },
      { name: 'mimeType', type: 'string' },
      { name: 's3Key', type: 'string' },
      { name: 'uploadedAt', type: 'string' }
    ];
    
    for (const field of requiredFields) {
      if (!(field.name in item)) {
        return { valid: false, error: `File item at index ${i} missing required field: ${field.name}` };
      }
      
      if (typeof item[field.name] !== field.type) {
        return { valid: false, error: `File item at index ${i} field ${field.name} must be ${field.type}` };
      }
    }
    
    // Validate size is non-negative
    if (item.size < 0) {
      return { valid: false, error: `File item at index ${i} size must be non-negative` };
    }
    
    // Validate uploadedAt is valid ISO string
    if (isNaN(Date.parse(item.uploadedAt))) {
      return { valid: false, error: `File item at index ${i} uploadedAt must be valid ISO date string` };
    }
    
    // Optional metadata validation
    if ('metadata' in item && item.metadata !== null && typeof item.metadata !== 'object') {
      return { valid: false, error: `File item at index ${i} metadata must be an object or null` };
    }
  }
  
  return { valid: true };
}

/**
 * Type guard for LinkToTableValue array
 */
export function isLinkToTableValueArray(value: unknown): value is LinkToTableValue[] {
  const result = validateRelationFieldStructure(value);
  return result.valid;
}

/**
 * Type guard for FileFieldValue array
 */
export function isFileFieldValueArray(value: unknown): value is FileFieldValue[] {
  const result = validateFileFieldStructure(value);
  return result.valid;
}

/**
 * Create example relation field data for testing
 */
export function createExampleRelationData(): LinkToTableValue[] {
  return [
    { 
      id: '123', 
      value: 'John Doe',
      tableId: 2 
    },
    { 
      id: '456', 
      value: 'Jane Smith',
      tableId: 2 
    }
  ];
}

/**
 * Create example file field data for testing
 */
export function createExampleFileData(): FileFieldValue[] {
  return [
    {
      id: 'file-uuid-example',
      name: 'example.pdf',
      size: 2048,
      mimeType: 'application/pdf',
      s3Key: 'org_1/files/example.pdf',
      uploadedAt: '2024-01-15T10:30:00.000Z',
      metadata: {
        organizationId: 1,
        tableId: 1,
        fieldId: 1
      }
    }
  ];
}