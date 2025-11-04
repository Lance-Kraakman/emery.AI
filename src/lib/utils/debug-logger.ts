/**
 * Debug Logger Utility
 *
 * Provides conditional debug logging based on environment variables.
 * Always logs errors, conditionally logs debug information.
 *
 * Usage:
 *   const logger = createDebugLogger('DataLake');
 *   logger.debug('Query started', { limit: 100 }); // Only in debug mode
 *   logger.summary('Retrieved', { rows: 101, total: 2248 }); // Concise format
 *   logger.error('Failed to query', error); // Always logged
 */

const DEBUG_ENABLED = process.env.DEBUG_TABLES === 'true' ||
                      process.env.NODE_ENV === 'development';

export interface DebugLogger {
  debug: (message: string, data?: any) => void;
  summary: (message: string, data?: Record<string, any>) => void;
  error: (message: string, error?: any) => void;
}

/**
 * Create a namespaced debug logger
 * @param namespace - Prefix for log messages (e.g., 'DataLake', 'Fields')
 */
export function createDebugLogger(namespace: string): DebugLogger {
  const prefix = `[${namespace}]`;

  return {
    /**
     * Debug logging - only enabled when DEBUG_TABLES=true or NODE_ENV=development
     * For verbose logging of internal state
     * Objects are JSON.stringify'd to keep output on a single line
     */
    debug: (message: string, data?: any) => {
      if (!DEBUG_ENABLED) return;

      if (data !== undefined) {
        // Stringify objects/arrays to keep them on one line
        if (typeof data === 'object' && data !== null) {
          console.log(`${prefix} ${message}`, JSON.stringify(data));
        } else {
          console.log(`${prefix} ${message}`, data);
        }
      } else {
        console.log(`${prefix} ${message}`);
      }
    },

    /**
     * Summary logging - always enabled, provides concise one-line summaries
     * @example logger.summary('Retrieved', { rows: 101, total: 2248 })
     *          // Output: [DataLake] Retrieved: rows=101, total=2248
     */
    summary: (message: string, data?: Record<string, any>) => {
      if (data) {
        const pairs = Object.entries(data)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ');
        console.log(`${prefix} ${message}: ${pairs}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    },

    /**
     * Error logging - always enabled regardless of debug mode
     */
    error: (message: string, error?: any) => {
      if (error) {
        console.error(`${prefix} ${message}:`, error);
      } else {
        console.error(`${prefix} ${message}`);
      }
    },
  };
}

/**
 * Helper to format object summaries without dumping entire contents
 */
export function formatSummary(obj: any, maxKeys = 5): string {
  if (!obj || typeof obj !== 'object') return String(obj);

  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';

  if (keys.length <= maxKeys) {
    return JSON.stringify(obj);
  }

  const shown = keys.slice(0, maxKeys);
  const hidden = keys.length - maxKeys;
  return `{${shown.join(', ')}, ... +${hidden} more}`;
}
