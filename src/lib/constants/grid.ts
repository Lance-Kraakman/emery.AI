/**
 * Grid configuration constants for data table management
 */

export const GRID_CONFIG = {
  /** Number of rows to fetch per page in infinite scroll */
  PAGE_SIZE: 100,
  /** How long to consider field data fresh (5 minutes) */
  FIELD_STALE_TIME: 5 * 60 * 1000,
  /** How long to consider row data fresh (2 minutes) */
  ROW_STALE_TIME: 2 * 60 * 1000,
  /** How long to consider search results fresh (30 seconds) */
  SEARCH_STALE_TIME: 30 * 1000,
  /** Debounce delay for search input (milliseconds) */
  DEBOUNCE_MS: 500,
  /** Distance from bottom to trigger infinite scroll (pixels) */
  SCROLL_THRESHOLD: 300,
} as const

/**
 * Supported field types in the dynamic table system
 */
export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'date',
  RELATION: 'relation',
  FILE: 'file',
  DOCUMENT: 'document',
  SINGLE_SELECT: 'single-select',
  MULTI_SELECT: 'multi-select',
  AUTONUMBER: 'autonumber',
  LAST_UPDATED: 'last-updated',
  CREATED_AT: 'created-at',
} as const

/**
 * Type-safe field type union
 */
export type FieldType = typeof FIELD_TYPES[keyof typeof FIELD_TYPES]
