// AIDEV-NOTE: Client-safe reference pattern matching
// Extracted from reference-resolver.ts to avoid server-side dependency issues

// Reference patterns for parsing
export const REFERENCE_PATTERNS = {
  doc: /@doc:([^@\s]+)/g,
  file: /@file:([^@\s]+)/g,
  table: /@table:([^@\s]+)/g,
  agent: /@agent:([^@\s]+)/g,
  tool: /@tool:([^@\s]+)/g
} as const;

/**
 * Check if a message contains any references
 * Safe for client-side use - no server dependencies
 */
export function hasReferences(message: string): boolean {
  return Object.values(REFERENCE_PATTERNS).some(pattern => {
    // Reset the regex lastIndex to avoid global flag state issues
    pattern.lastIndex = 0;
    return pattern.test(message);
  });
}