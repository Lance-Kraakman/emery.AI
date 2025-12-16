/**
 * Field Validation Utility
 *
 * Shared validation logic for edit mode and forms.
 * Extracted from MultiPageForm to be reusable.
 */

import type { FieldDTO } from '@/app/mappers/field-mapper';

export interface ValidationOptions {
  /** Override field's required setting */
  required?: boolean;
  /** Custom label for error messages */
  label?: string;
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Validate a single field value
 *
 * @param field - The field DTO with type and metadata
 * @param value - The value to validate
 * @param options - Validation options (required override, custom label)
 * @returns Error message string or null if valid
 *
 * @example
 * ```tsx
 * const error = validateField(field, value, { required: true });
 * if (error) {
 *   setValidationErrors(prev => ({ ...prev, [field.id]: error }));
 * }
 * ```
 */
export function validateField(
  field: FieldDTO,
  value: unknown,
  options?: ValidationOptions
): string | null {
  const label = options?.label || field.name;
  const isRequired = options?.required ?? field.required ?? false;

  // Required check
  if (isRequired && isEmpty(value)) {
    return `${label} is required`;
  }

  // Type-specific validation
  switch (field.type) {
    case 'email':
      if (value && typeof value === 'string' && value.trim() !== '') {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return `${label} must be a valid email address`;
        }
      }
      break;

    case 'phone':
      if (value && typeof value === 'string' && value.trim() !== '') {
        // Basic phone validation (allows digits, spaces, dashes, parens, plus)
        const phoneRegex = /^[+\d\s\-()]+$/;
        if (!phoneRegex.test(value)) {
          return `${label} must be a valid phone number`;
        }
      }
      break;

    case 'number':
      if (value !== null && value !== undefined && value !== '') {
        const num = Number(value);
        if (isNaN(num)) {
          return `${label} must be a valid number`;
        }
        // Check min/max from metadata if present
        const metadata = field.metadata as Record<string, unknown> | undefined;
        if (metadata?.min !== undefined && num < Number(metadata.min)) {
          return `${label} must be at least ${metadata.min}`;
        }
        if (metadata?.max !== undefined && num > Number(metadata.max)) {
          return `${label} must be at most ${metadata.max}`;
        }
      }
      break;

    case 'text':
      if (value && typeof value === 'string') {
        const metadata = field.metadata as Record<string, unknown> | undefined;
        if (metadata?.minLength !== undefined && value.length < Number(metadata.minLength)) {
          return `${label} must be at least ${metadata.minLength} characters`;
        }
        if (metadata?.maxLength !== undefined && value.length > Number(metadata.maxLength)) {
          return `${label} must be at most ${metadata.maxLength} characters`;
        }
      }
      break;

    case 'single-select':
      if (value && field.metadata) {
        const options = (field.metadata as Record<string, unknown>).options as Array<{ value: string }> | undefined;
        if (options && !options.some(opt => opt.value === value)) {
          return `${label} must be a valid option`;
        }
      }
      break;

    case 'multi-select':
      if (value && Array.isArray(value) && field.metadata) {
        const options = (field.metadata as Record<string, unknown>).options as Array<{ value: string }> | undefined;
        if (options) {
          const validValues = options.map(opt => opt.value);
          const invalidValues = value.filter(v => !validValues.includes(v as string));
          if (invalidValues.length > 0) {
            return `${label} contains invalid options`;
          }
        }
      }
      break;

    // Auto-fields are always read-only, no validation needed
    case 'autonumber':
    case 'created-at':
    case 'last-updated':
    case 'embedding':
      // These are system-managed, no user validation
      break;

    // Date, boolean, file, document, relation - basic checks only
    case 'date':
      if (value && typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return `${label} must be a valid date`;
        }
      }
      break;

    default:
      // No additional validation for other types
      break;
  }

  return null; // Valid
}

/**
 * Validate multiple fields at once
 *
 * @param fields - Array of field DTOs
 * @param values - Object mapping field IDs to values
 * @param requiredFieldIds - Optional set of field IDs that are required
 * @returns Object mapping field IDs to error messages (empty if all valid)
 */
export function validateFields(
  fields: FieldDTO[],
  values: Record<string | number, unknown>,
  requiredFieldIds?: Set<number>
): Record<number, string> {
  const errors: Record<number, string> = {};

  for (const field of fields) {
    const value = values[field.id] ?? values[field.name];
    const isRequired = requiredFieldIds?.has(field.id) ?? field.required ?? false;

    const error = validateField(field, value, { required: isRequired });
    if (error) {
      errors[field.id] = error;
    }
  }

  return errors;
}

/**
 * Check if a field type is editable (not auto-generated)
 * Re-exported from input-mapper for convenience
 */
export function isFieldEditable(fieldType: string): boolean {
  const readOnlyTypes = ['autonumber', 'created-at', 'last-updated', 'embedding'];
  return !readOnlyTypes.includes(fieldType);
}
