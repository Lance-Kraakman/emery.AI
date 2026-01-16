import { encode } from '@toon-format/toon';

export interface ToonConfig {
  includeMeta?: boolean;   // Include metadata fields (default: false)
  maxItems?: number;       // Limit array items (default: 50)
}

/**
 * Extract ID value from either:
 * - Domain ValueObject: { value: number }
 * - Plain number after JSON serialization
 * - Undefined/null
 */
export function extractId(id: unknown): number {
  if (id === null || id === undefined) return 0;
  if (typeof id === 'number') return id;
  if (typeof id === 'object' && 'value' in id) {
    const val = (id as { value: unknown }).value;
    return typeof val === 'number' ? val : 0;
  }
  return 0;
}

/**
 * Escape special characters in TOON values.
 * TOON uses commas as delimiters, so we need to escape them.
 */
export function escapeToonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape commas and newlines
  if (str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert any data to TOON format using the official SDK.
 */
export function toToon(data: unknown, _config: ToonConfig = {}): string {
  return encode(data);
}
