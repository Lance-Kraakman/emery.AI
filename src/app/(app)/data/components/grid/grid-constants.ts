/**
 * Grid Column Configuration Constants
 *
 * AIDEV-NOTE: Centralized configuration for data grid column dimensions.
 * These values control the default and field-type-specific column widths.
 */

/**
 * Special column widths
 */
export const ID_COLUMN_WIDTH = 300;  // Fits full UUID (36 chars)
export const ADD_COLUMN_BUTTON_WIDTH = 50;  // Minimal width for add button

/**
 * Column dimension groups by field complexity
 */

// Small columns (boolean checkboxes)
export const SMALL_COLUMN_BASIS = 100;
export const SMALL_COLUMN_MIN_WIDTH = 80;

// Default columns (text, date)
export const DEFAULT_COLUMN_BASIS = 150;
export const DEFAULT_COLUMN_MIN_WIDTH = 120;

// Medium columns (number, autonumber, timestamps)
export const MEDIUM_COLUMN_BASIS = 180;
export const MEDIUM_COLUMN_MIN_WIDTH = 150;

// Select columns (single-select, embedding)
export const SELECT_COLUMN_BASIS = 200;
export const SELECT_COLUMN_MIN_WIDTH = 150;

// Wide columns (relation, file, document, multi-select)
export const WIDE_COLUMN_BASIS = 250;
export const WIDE_COLUMN_MIN_WIDTH = 150;

// Multi-select exception (wider minimum for displaying multiple badges)
export const MULTI_SELECT_MIN_WIDTH = 180;

/**
 * Column flex properties (consistent across all field types)
 */
export const COLUMN_GROW = 0;
export const COLUMN_SHRINK = 1;
export const FIXED_COLUMN_SHRINK = 0;  // For ID and add button columns
