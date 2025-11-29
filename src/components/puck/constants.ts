/**
 * Puck component constants
 *
 * Shared constants used across puck components.
 * Keep this file free of heavy imports to avoid circular dependencies.
 */

// Field block types that need DataLayoutContext for field selection
// These blocks use FieldSelectorField to pick which database field to display
export const FIELD_BLOCK_TYPES = [
  'TextField',
  'NumberField',
  'BooleanField',
  'DateField',
  'SelectField',
  'ImageField',
  'FileField',
  'DocumentField',
  'RelationField',
  'LinkField',
] as const;

export type FieldBlockType = (typeof FIELD_BLOCK_TYPES)[number];

// Set for O(1) lookup
export const FIELD_BLOCK_TYPES_SET = new Set<string>(FIELD_BLOCK_TYPES);

// Block types that support variable templates ({fieldName}) in their properties
// These need DataLayoutContext for autocomplete in the editor sidebar
export const VARIABLE_AWARE_BLOCK_TYPES = [
  ...FIELD_BLOCK_TYPES,
  'Button',
  'LinkBlock',
] as const;

export type VariableAwareBlockType = (typeof VARIABLE_AWARE_BLOCK_TYPES)[number];

// Set for O(1) lookup
export const VARIABLE_AWARE_BLOCK_TYPES_SET = new Set<string>(VARIABLE_AWARE_BLOCK_TYPES);
