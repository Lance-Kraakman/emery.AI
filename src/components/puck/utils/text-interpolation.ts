/**
 * Text Interpolation Utility
 *
 * Provides string interpolation for displaying dynamic values in text.
 * Supports patterns like:
 * - {state.container.key} - State values
 * - {params.name} - URL parameters
 * - {rowData.field} - Row data fields
 *
 * This is different from ValueSource resolution:
 * - ValueSource: Used for data values (filters, actions) - returns typed values
 * - Text interpolation: Used for display text - returns strings
 *
 * @example
 * ```tsx
 * const text = interpolateText("Hello {state.user.name}!", context);
 * // Returns: "Hello John!"
 * ```
 */

import type { ValueResolutionContext } from '../types/value-source';

/**
 * Pattern to match variable references in text
 * Matches: {state.container.key}, {params.name}, {rowData.field}
 */
const VARIABLE_PATTERN = /\{(state|params|rowData)\.([^}]+)\}/g;

/**
 * Check if a string contains any variable references
 */
export function hasVariableReferences(text: string): boolean {
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
  type: 'state' | 'params' | 'rowData';
  path: string;
}> {
  const references: Array<{
    match: string;
    type: 'state' | 'params' | 'rowData';
    path: string;
  }> = [];

  // Reset regex lastIndex
  VARIABLE_PATTERN.lastIndex = 0;

  let match;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    references.push({
      match: match[0],
      type: match[1] as 'state' | 'params' | 'rowData',
      path: match[2],
    });
  }

  return references;
}

/**
 * Resolve a single variable reference to a string value
 */
function resolveVariable(
  type: 'state' | 'params' | 'rowData',
  path: string,
  context: ValueResolutionContext
): string {
  switch (type) {
    case 'state': {
      // Path is "container.key"
      const [container, ...keyParts] = path.split('.');
      const key = keyParts.join('.'); // Handle nested keys like "user.address.city"

      if (!context.getStateValue) {
        console.warn(`[interpolateText] No state context for: state.${path}`);
        return `{state.${path}}`;
      }

      const value = context.getStateValue(container, key);
      return formatValue(value);
    }

    case 'params': {
      if (!context.params) {
        console.warn(`[interpolateText] No params context for: params.${path}`);
        return `{params.${path}}`;
      }

      const value = context.params[path];
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
 * @param text - The text with variable references like {state.x.y}
 * @param context - The resolution context providing access to state, params, rowData
 * @returns The text with all variables replaced with their values
 *
 * @example
 * ```tsx
 * const result = interpolateText(
 *   "Welcome, {state.user.name}! You have {state.cart.count} items.",
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
    return resolveVariable(type as 'state' | 'params' | 'rowData', path, context);
  });
}

/**
 * Extract state container names referenced in text
 * Useful for setting up subscriptions
 *
 * @param text - The text to scan
 * @returns Set of container names referenced
 */
export function extractStateContainers(text: string): Set<string> {
  const containers = new Set<string>();
  const refs = extractVariableReferences(text);

  for (const ref of refs) {
    if (ref.type === 'state') {
      // Path is "container.key" or "container.nested.key"
      const container = ref.path.split('.')[0];
      containers.add(container);
    }
  }

  return containers;
}
