/**
 * Filter type definitions with strict type safety
 *
 * Provides type-safe filter operators and configurations for table filtering.
 * Each field type has its own set of valid operators.
 */

import type { FIELD_TYPES } from '@/lib/constants/grid'

/**
 * All possible filter operators
 */
export type FilterOperator =
  | 'eq'           // Equals
  | 'ne'           // Not equals
  | 'gt'           // Greater than
  | 'gte'          // Greater than or equal
  | 'lt'           // Less than
  | 'lte'          // Less than or equal
  | 'ilike'        // Case-insensitive like (contains)
  | 'like'         // Case-sensitive like
  | 'in'           // In array
  | 'not_in'       // Not in array
  | 'is_null'      // Is null/empty
  | 'is_not_null'  // Is not null/empty

/**
 * Filter operator definitions with labels
 */
export interface FilterOperatorDef {
  value: FilterOperator
  label: string
}

/**
 * Operators available for text fields
 */
export const TEXT_OPERATORS: readonly FilterOperatorDef[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
  { value: 'ilike', label: 'Contains' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
] as const

/**
 * Operators available for number fields
 */
export const NUMBER_OPERATORS: readonly FilterOperatorDef[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less or equal' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
] as const

/**
 * Operators available for boolean fields
 */
export const BOOLEAN_OPERATORS: readonly FilterOperatorDef[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
] as const

/**
 * Operators available for date fields
 */
export const DATE_OPERATORS: readonly FilterOperatorDef[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
  { value: 'gt', label: 'After' },
  { value: 'gte', label: 'On or after' },
  { value: 'lt', label: 'Before' },
  { value: 'lte', label: 'On or before' },
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
] as const

/**
 * Operators available for select fields (single and multi)
 */
export const SELECT_OPERATORS: readonly FilterOperatorDef[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equals' },
  { value: 'ilike', label: 'Contains' },  // Multi-select: contains this option
  { value: 'is_null', label: 'Is empty' },
  { value: 'is_not_null', label: 'Is not empty' },
] as const

/**
 * Operators available for relation fields
 * Relations store arrays of {id, value}, so we include array operators
 */
export const RELATION_OPERATORS: readonly FilterOperatorDef[] = [
  { value: 'eq', label: 'Links to' },
  { value: 'ne', label: 'Does not link to' },
  { value: 'in', label: 'Links to any of' },
  { value: 'not_in', label: 'Links to none of' },
  { value: 'is_null', label: 'Has no links' },
  { value: 'is_not_null', label: 'Has links' },
] as const

/**
 * Map of field types to their available operators
 */
export const OPERATORS_BY_FIELD_TYPE = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  relation: RELATION_OPERATORS,  // Relations are arrays, support in/not_in
  file: TEXT_OPERATORS,
  document: TEXT_OPERATORS,
  'single-select': SELECT_OPERATORS,
  'multi-select': SELECT_OPERATORS,
  autonumber: NUMBER_OPERATORS,  // Autonumbers are numeric
  'last-updated': DATE_OPERATORS,  // Timestamps are dates
  'created-at': DATE_OPERATORS,    // Timestamps are dates
  json: TEXT_OPERATORS,  // JSON fields use text-like filtering (contains, etc.)
} as const

/**
 * Type-safe field type union from constants
 */
export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES]

/**
 * Generic filter configuration
 */
export interface FilterConfig<T = unknown> {
  field: string
  operator: FilterOperator
  value: T | null
}

/**
 * Operator label lookup map for display
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  ne: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  ilike: 'contains',
  like: 'contains',
  in: 'in',
  not_in: 'not in',
  is_null: 'is empty',
  is_not_null: 'is not empty',
} as const

/**
 * Check if an operator requires a value input
 */
export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== 'is_null' && operator !== 'is_not_null'
}

/**
 * Get available operators for a field type
 */
export function getOperatorsForFieldType(fieldType: FieldType): readonly FilterOperatorDef[] {
  return OPERATORS_BY_FIELD_TYPE[fieldType] || TEXT_OPERATORS
}

/**
 * Get display label for an operator
 */
export function getOperatorLabel(operator: FilterOperator): string {
  return OPERATOR_LABELS[operator] || operator
}
