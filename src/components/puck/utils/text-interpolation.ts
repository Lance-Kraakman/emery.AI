/**
 * Text Interpolation Utility
 *
 * AIDEV-NOTE: Provides string interpolation for displaying dynamic values in text.
 * Supports patterns like:
 * - {state.key} - State values (flat namespace, auto-populated from URL params)
 * - {rowData.field} - Row data fields
 *
 * This is different from ValueSource resolution:
 * - ValueSource: Used for data values (filters, actions) - returns typed values
 * - Text interpolation: Used for display text - returns strings
 *
 * @example
 * ```tsx
 * const text = interpolateText("Hello {state.userName}!", context);
 * // Returns: "Hello John!"
 * ```
 */

import type { ValueResolutionContext } from '../types/value-source';

/**
 * Pattern to match variable references in text
 * Matches: {state.key}, {rowData.field}
 */
const VARIABLE_PATTERN = /\{(state|rowData)\.([^}]+)\}/g;

/**
 * Check if a string contains any variable references
 */
export function hasVariableReferences(text: string): boolean {
  // Reset lastIndex before testing
  VARIABLE_PATTERN.lastIndex = 0;
  return VARIABLE_PATTERN.test(text);
}

/**
 * Extract all variable references from a string
 *
 * @param text - The text to scan
 * @returns Array of variable reference objects
 */
export function extractVariableReferences(text: string): Array<{
  match: string;
  type: 'state' | 'rowData';
  path: string;
}> {
  const references: Array<{
    match: string;
    type: 'state' | 'rowData';
    path: string;
  }> = [];

  // Reset regex lastIndex
  VARIABLE_PATTERN.lastIndex = 0;

  let match;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    references.push({
      match: match[0],
      type: match[1] as 'state' | 'rowData',
      path: match[2],
    });
  }

  return references;
}

/**
 * Resolve a single variable reference to a string value
 */
function resolveVariable(
  type: 'state' | 'rowData',
  path: string,
  context: ValueResolutionContext
): string {
  switch (type) {
    case 'state': {
      // Path is just the key (flat namespace)
      if (!context.getStateValue) {
        console.warn(`[interpolateText] No state context for: state.${path}`);
        return `{state.${path}}`;
      }

      const value = context.getStateValue(path);
      return formatValue(value);
    }

    case 'rowData': {
      if (!context.resolveRowData) {
        console.warn(`[interpolateText] No rowData context for: rowData.${path}`);
        return `{rowData.${path}}`;
      }

      const value = context.resolveRowData(path);
      return formatValue(value);
    }

    default:
      return `{${type}.${path}}`;
  }
}

/**
 * Format a value for display in text
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    // Join arrays with commas
    return value.map(v => formatValue(v)).join(', ');
  }

  if (typeof value === 'object') {
    // For objects, try to stringify nicely
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  return String(value);
}

/**
 * Interpolate variable references in a text string
 *
 * @param text - The text with variable references like {state.key}
 * @param context - The resolution context providing access to state, params, rowData
 * @returns The text with all variables replaced with their values
 *
 * @example
 * ```tsx
 * const result = interpolateText(
 *   "Welcome, {state.userName}! You have {state.cartCount} items.",
 *   context
 * );
 * // Returns: "Welcome, John! You have 3 items."
 * ```
 */
export function interpolateText(
  text: string,
  context: ValueResolutionContext
): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // Reset regex lastIndex
  VARIABLE_PATTERN.lastIndex = 0;

  return text.replace(VARIABLE_PATTERN, (match, type, path) => {
    return resolveVariable(type as 'state' | 'rowData', path, context);
  });
}

/**
 * Check if text has state references (for subscription setup)
 *
 * @param text - The text to scan
 * @returns true if text contains state references
 */
export function hasStateReferences(text: string): boolean {
  const refs = extractVariableReferences(text);
  return refs.some(ref => ref.type === 'state');
}
