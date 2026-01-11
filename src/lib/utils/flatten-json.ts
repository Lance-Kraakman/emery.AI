/**
 * JSON Flattening Utility
 *
 * Uses the `flat` package to convert nested JSON objects into flat key-value pairs.
 * Used for discovering table columns from tool responses.
 */

import { flatten } from 'flat';

/**
 * Flatten a nested JSON object into a flat key-value structure.
 * Uses underscore as delimiter (e.g., user_name instead of user.name).
 */
export function flattenJson(obj: unknown): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return {};
  }

  if (typeof obj !== 'object') {
    return { value: obj };
  }

  return flatten(obj, { delimiter: '_' }) as Record<string, unknown>;
}

/**
 * Infer column type from a value.
 * Used when creating table columns from discovered outputs.
 */
export function inferColumnType(value: unknown): 'text' | 'number' | 'boolean' | 'json' {
  if (value === null || value === undefined) {
    return 'text';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return 'json';
  }

  return 'text';
}

/**
 * Flatten JSON and return with inferred types.
 * Returns an array of { name, value, type } for each field.
 */
export function flattenJsonWithTypes(obj: unknown): Array<{
  name: string;
  value: unknown;
  type: 'text' | 'number' | 'boolean' | 'json';
}> {
  const flattened = flattenJson(obj);

  return Object.entries(flattened).map(([name, value]) => ({
    name,
    value,
    type: inferColumnType(value),
  }));
}
