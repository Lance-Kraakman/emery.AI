// AIDEV-NOTE: Field validation utilities - centralized validation logic
// AIDEV-TODO: Add custom validation rules and async validation support

import { Field } from '@/app/actions/types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateFieldValue(field: Field, value: any): ValidationResult {
  // Check required fields
  if (field.required && isEmptyValue(value)) {
    return {
      isValid: false,
      error: `${field.name} is required`
    };
  }

  // Skip validation for empty optional fields
  if (isEmptyValue(value)) {
    return { isValid: true };
  }

  // Type-specific validation
  switch (field.type) {
    case 'email':
      return validateEmail(value);
    case 'url':
      return validateUrl(value);
    case 'number':
      return validateNumber(value);
    case 'date':
      return validateDate(value);
    default:
      return { isValid: true };
  }
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