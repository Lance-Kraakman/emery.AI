/**
 * Field Processor Domain Service
 * 
 * Pure domain service for field value processing, validation, and conversion.
 * Handles field-specific business logic without infrastructure knowledge.
 * 
 * AIDEV-NOTE: Domain service that extracts field processing logic from row-application-service.
 * Contains pure business logic for field validation and value processing.
 */

import type { Field } from '../entities/field';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { validateRelationFieldStructure, validateFileFieldStructure } from './jsonb-validation-helpers';

export interface FieldValidationError {
  field: string;
  error: string;
}

export interface FieldValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
}

export interface ProcessedFieldValue {
  [fieldSlug: string]: unknown;
}

export class FieldProcessor {
  /**
   * Validate row data against field definitions
   */
  validateRowData(fields: Field[], data: Record<string, any>): FieldValidationResult {
    const errors: FieldValidationError[] = [];

    for (const field of fields) {
      const value = data[field.slug];
      const validation = this.validateFieldValue(field, value);
      
      if (!validation.valid && validation.error) {
        errors.push({
          field: field.name,
          error: validation.error
        });
      }
    }

    // Check for required fields that are missing
    for (const field of fields) {
      if (field.required && !(field.slug in data)) {
        errors.push({
          field: field.name,
          error: 'Field is required'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single field value based on field type and configuration
   */
  validateFieldValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    // Handle null/undefined
    if (value === undefined || value === null || value === '') {
      if (field.required) {
        return { valid: false, error: 'Field is required' };
      }
      return { valid: true };
    }

    // Type-specific validation
    switch (field.type) {
      case 'text':
        return this.validateTextValue(field, value);

      case 'number':
        return this.validateNumberValue(field, value);

      case 'boolean':
        return this.validateBooleanValue(field, value);

      case 'email':
        return this.validateEmailValue(field, value);

      case 'url':
        return this.validateUrlValue(field, value);

      case 'date':
        return this.validateDateValue(field, value);

      case 'relation':
        return this.validateRelationValue(field, value);

      case 'file':
        return this.validateFileValue(field, value);

      default:
        return { valid: false, error: `Unknown field type: ${field.type}` };
    }
  }

  /**
   * Process row data for storage - convert field values to appropriate storage format
   */
  processRowForStorage(fields: Field[], data: Record<string, any>): ProcessedFieldValue {
    const processedData: ProcessedFieldValue = {};

    for (const field of fields) {
      const value = data[field.slug];
      
      // Only process defined values - allow null, empty strings, 0, false, etc.
      if (value !== undefined) {
        processedData[field.slug] = this.processFieldValueForStorage(field, value);
      }
    }

    return processedData;
  }

  /**
   * Process row data from storage - convert stored values to display format
   */
  processRowFromStorage(fields: Field[], storedData: Record<string, any>): Record<string, any> {
    const processedData: Record<string, any> = {
      // Preserve system fields
      id: storedData.id,
      created_at: storedData.created_at,
      updated_at: storedData.updated_at
    };

    for (const field of fields) {
      // Map from field_{id} column format to field slug
      const storedValue = storedData[`field_${field.id.value}`];
      
      if (storedValue !== undefined) {
        processedData[field.slug] = this.processFieldValueFromStorage(field, storedValue);
      }
    }

    return processedData;
  }

  // Private validation methods

  private validateTextValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Must be a string' };
    }
    return { valid: true };
  }

  private validateNumberValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    if (typeof value === 'string') {
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Must be a valid number' };
      }
    } else if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: 'Must be a valid number' };
    }
    return { valid: true };
  }

  private validateBooleanValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      return { valid: false, error: 'Must be a valid boolean' };
    }
    return { valid: true };
  }

  private validateEmailValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Must be a string' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Must be a valid email address' };
    }

    return { valid: true };
  }

  private validateUrlValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Must be a string' };
    }

    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Must be a valid URL' };
    }
  }

  private validateDateValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    if (value instanceof Date) {
      return { valid: true };
    }

    if (typeof value === 'string') {
      if (isNaN(Date.parse(value))) {
        return { valid: false, error: 'Must be a valid date' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Must be a valid date' };
  }

  private validateRelationValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    return validateRelationFieldStructure(value);
  }

  private validateFileValue(field: Field, value: unknown): { valid: boolean; error?: string } {
    return validateFileFieldStructure(value);
  }

  // Private processing methods

  private processFieldValueForStorage(field: Field, value: unknown): unknown {
    switch (field.type) {
      case 'relation':
        // Relation fields should already be arrays of RelationValue/LinkToTableValue objects
        // No string parsing - validation ensures proper structure
        return value;

      case 'file':
        // File fields should already be arrays of FileFieldValue objects
        // No string parsing - validation ensures proper structure
        return value;

      case 'date':
        // Ensure date is properly formatted
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;

      case 'number':
        // Convert string numbers to actual numbers
        if (typeof value === 'string' && !isNaN(Number(value))) {
          return Number(value);
        }
        return value;

      case 'boolean':
        // Convert string booleans to actual booleans
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;

      default:
        return value;
    }
  }

  private processFieldValueFromStorage(field: Field, storedValue: unknown): unknown {
    switch (field.type) {
      case 'relation':
      case 'file':
        // JSONB fields might need parsing if stored as strings
        if (typeof storedValue === 'string') {
          try {
            return JSON.parse(storedValue);
          } catch {
            return storedValue;
          }
        }
        return storedValue;

      default:
        return storedValue;
    }
  }
}