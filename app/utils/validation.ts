// AIDEV-NOTE: Field validation utilities - centralized validation logic
// AIDEV-TODO: Add custom validation rules and async validation support

import { Field } from '@/app/actions/types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ValidationRule {
  name: string;
  validate: (value: any, field: Field) => ValidationResult;
  applicableTypes?: string[];
}

// Scalable validation registry
class ValidationRegistry {
  private rules: Map<string, ValidationRule[]> = new Map();
  private globalRules: ValidationRule[] = [];

  registerRule(rule: ValidationRule) {
    if (rule.applicableTypes) {
      rule.applicableTypes.forEach(type => {
        if (!this.rules.has(type)) {
          this.rules.set(type, []);
        }
        this.rules.get(type)!.push(rule);
      });
    } else {
      this.globalRules.push(rule);
    }
  }

  validateField(field: Field, value: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Apply global rules
    for (const rule of this.globalRules) {
      const result = rule.validate(value, field);
      if (!result.isValid) {
        results.push(result);
      }
    }
    
    // Apply type-specific rules
    const typeRules = this.rules.get(field.type) || [];
    for (const rule of typeRules) {
      const result = rule.validate(value, field);
      if (!result.isValid) {
        results.push(result);
      }
    }
    
    return results;
  }
}

// Global validation registry instance
export const validationRegistry = new ValidationRegistry();

export function validateFieldValue(field: Field, value: any): ValidationResult {
  const results = validationRegistry.validateField(field, value);
  
  // Return the first error found, or success if no errors
  if (results.length > 0) {
    return results[0];
  }
  
  return { isValid: true };
}

export function validateRowData(fields: Field[], data: Record<string, any>): ValidationResult[] {
  return fields.map(field => {
    const value = data[field.slug];
    return {
      field: field.slug,
      ...validateFieldValue(field, value)
    };
  });
}

export function hasValidationErrors(validationResults: ValidationResult[]): boolean {
  return validationResults.some(result => !result.isValid);
}

export function getValidationErrorMessage(validationResults: ValidationResult[]): string {
  const errors = validationResults
    .filter(result => !result.isValid)
    .map(result => result.error)
    .filter(Boolean);
  
  return errors.join(', ');
}

// Helper functions
function isEmptyValue(value: any): boolean {
  return value === undefined || 
         value === null || 
         value === '' || 
         (Array.isArray(value) && value.length === 0) ||
         (typeof value === 'object' && Object.keys(value).length === 0);
}

function validateEmail(value: any): ValidationResult {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Email must be a string' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

function validateUrl(value: any): ValidationResult {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'URL must be a string' };
  }

  try {
    new URL(value);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }
}

function validateNumber(value: any): ValidationResult {
  const num = Number(value);
  if (isNaN(num)) {
    return { isValid: false, error: 'Please enter a valid number' };
  }

  return { isValid: true };
}

function validateDate(value: any): ValidationResult {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Date must be a string' };
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Please enter a valid date' };
  }

  return { isValid: true };
}

function validateRelation(value: any): ValidationResult {
  // Relations should be arrays of objects with id property
  if (!Array.isArray(value)) {
    return { isValid: false, error: 'Relation must be an array' };
  }

  for (const item of value) {
    if (typeof item !== 'object' || !item.id) {
      return { isValid: false, error: 'Relation items must have an id property' };
    }
  }

  return { isValid: true };
}

function validateFile(value: any): ValidationResult {
  // Files should be objects with files array containing file metadata
  if (typeof value !== 'object' || !value.files) {
    return { isValid: false, error: 'File field must contain files array' };
  }

  if (!Array.isArray(value.files)) {
    return { isValid: false, error: 'Files must be an array' };
  }

  for (const file of value.files) {
    if (!file.id || !file.name || !file.s3Key) {
      return { isValid: false, error: 'File metadata is incomplete' };
    }
  }

  return { isValid: true };
}

// Register all validation rules
validationRegistry.registerRule({
  name: 'required',
  validate: (value: any, field: Field) => {
    if (field.required && isEmptyValue(value)) {
      return {
        isValid: false,
        error: `${field.name} is required`
      };
    }
    return { isValid: true };
  }
});

validationRegistry.registerRule({
  name: 'email-format',
  applicableTypes: ['email'],
  validate: (value: any) => {
    if (isEmptyValue(value)) return { isValid: true };
    return validateEmail(value);
  }
});

validationRegistry.registerRule({
  name: 'url-format',
  applicableTypes: ['url'],
  validate: (value: any) => {
    if (isEmptyValue(value)) return { isValid: true };
    return validateUrl(value);
  }
});

validationRegistry.registerRule({
  name: 'number-format',
  applicableTypes: ['number'],
  validate: (value: any) => {
    if (isEmptyValue(value)) return { isValid: true };
    return validateNumber(value);
  }
});

validationRegistry.registerRule({
  name: 'date-format',
  applicableTypes: ['date'],
  validate: (value: any) => {
    if (isEmptyValue(value)) return { isValid: true };
    return validateDate(value);
  }
});

validationRegistry.registerRule({
  name: 'relation-format',
  applicableTypes: ['relation'],
  validate: (value: any) => {
    if (isEmptyValue(value)) return { isValid: true };
    return validateRelation(value);
  }
});

validationRegistry.registerRule({
  name: 'file-format',
  applicableTypes: ['file'],
  validate: (value: any) => {
    if (isEmptyValue(value)) return { isValid: true };
    return validateFile(value);
  }
});