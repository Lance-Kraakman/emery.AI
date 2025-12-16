/**
 * Input Mapper
 *
 * Maps database field types to appropriate form input components
 * Centralizes the logic for determining which input component to use
 */

import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { ComponentType } from 'react';

import { TextInput } from './inputs/TextInput';
import { NumberInput } from './inputs/NumberInput';
import { BooleanInput } from './inputs/BooleanInput';
import { DateInput } from './inputs/DateInput';
import { SingleSelectInput } from './inputs/SingleSelectInput';
import { MultiSelectInput } from './inputs/MultiSelectInput';
import { PhoneInput } from './inputs/PhoneInput';
import { FileUploadInput } from './inputs/FileUploadInput';
import { RelationInput } from './inputs/RelationInput';
import { ReadOnlyInput } from './inputs/ReadOnlyInput';

/**
 * Common props for all input components
 */
export interface BaseInputProps {
  field: FieldDTO;
  value: any;
  onChange: (value: any) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Get the appropriate input component for a field type
 *
 * @param field - The field DTO containing type and metadata
 * @returns The React component to use for this field type
 */
export function getInputComponentForField(
  field: FieldDTO
): ComponentType<BaseInputProps> {
  switch (field.type) {
    // Text-based fields
    case 'text':
    case 'email':
      return TextInput as any;

    // Numeric fields
    case 'number':
      return NumberInput as any;

    // Boolean fields
    case 'boolean':
      return BooleanInput as any;

    // Date fields
    case 'date':
      return DateInput as any;

    // Select fields
    case 'single-select':
      return SingleSelectInput as any;

    case 'multi-select':
      return MultiSelectInput as any;

    // Phone fields
    case 'phone':
      return PhoneInput as any;

    // File fields
    case 'file':
    case 'document':
      return FileUploadInput as any;

    // Relation fields
    case 'relation':
      return RelationInput as any;

    // Read-only fields
    case 'autonumber':
    case 'created-at':
    case 'last-updated':
      return ReadOnlyInput as any;

    // Special fields (not typically shown in forms)
    case 'embedding':
      // Embeddings are typically system-managed, treat as read-only
      return ReadOnlyInput as any;

    // Default fallback
    default:
      console.warn(`[input-mapper] Unknown field type: ${field.type}, using TextInput as fallback`);
      return TextInput as any;
  }
}

/**
 * Check if a field type is editable in forms
 */
export function isFieldEditable(fieldType: string): boolean {
  const readOnlyTypes = ['autonumber', 'created-at', 'last-updated', 'embedding'];
  return !readOnlyTypes.includes(fieldType);
}

/**
 * Get default value for a field type
 */
export function getDefaultValueForField(field: FieldDTO): any {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
      return '';

    case 'number':
      return null;

    case 'boolean':
      return false;

    case 'date':
      return null;

    case 'single-select':
    case 'relation':
      return null;

    case 'multi-select':
      return [];

    case 'file':
    case 'document':
      return null;

    case 'autonumber':
    case 'created-at':
    case 'last-updated':
    case 'embedding':
      return null; // Read-only, value set by system

    default:
      return null;
  }
}
