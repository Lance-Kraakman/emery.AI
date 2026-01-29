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

/**
 * Header UI space constants for dynamic min-width calculation
 */
export const HEADER_BUTTONS_WIDTH = 48; // Sort button (24px) + dropdown (16px) + gaps (8px)
export const HEADER_PADDING = 16; // Left/right padding in header
export const CHAR_WIDTH_ESTIMATE = 7.5; // Average character width in px (for typical font)

/**
 * Calculate minimum column width that ensures header title + buttons fit
 * Returns the minimum width needed to display the column name without truncation
 */
export function calculateHeaderMinWidth(columnName: string): number {
  const titleWidth = columnName.length * CHAR_WIDTH_ESTIMATE;
  return Math.ceil(titleWidth + HEADER_BUTTONS_WIDTH + HEADER_PADDING);
}
