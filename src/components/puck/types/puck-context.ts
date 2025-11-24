/**
 * Puck Resolve Context Type
 *
 * This defines the structure of the context/metadata parameter passed to
 * Puck component resolveData functions.
 *
 * TERMINOLOGY NOTE:
 * - We call this "context" for clarity about its purpose
 * - Puck's types call it "metadata" (the parameter in ComponentConfig.resolveData)
 * - Both refer to the same thing: the third parameter of resolveAllData()
 *
 * USAGE:
 * ```typescript
 * resolveData: async ({ props }, context) => {
 *   if (!isPuckResolveContext(context)) {
 *     return { props };
 *   }
 *   // context is now typed and safe to use
 *   const userId = context.userId;
 * }
 * ```
 */

/**
 * Context passed to Puck component resolveData functions
 *
 * This represents data available during server-side resolution, typically:
 * - Query parameters from the page URL (?userId=123)
 * - Page-level metadata (userId, pageId, etc.)
 *
 * The flexible index signature allows passing any query parameter while
 * maintaining type safety for the value types.
 */
export interface PuckResolveContext {
  /** Index signature for query parameters and custom metadata */
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Type guard to validate context shape at runtime
 *
 * @param value - Value to check
 * @returns True if value is a valid PuckResolveContext
 *
 * @example
 * ```typescript
 * if (!isPuckResolveContext(context)) {
 *   console.warn('Invalid context');
 *   return { props };
 * }
 * // context is now typed as PuckResolveContext
 * ```
 */
export function isPuckResolveContext(value: unknown): value is PuckResolveContext {
  // Context can be undefined (when resolveAllData called without third param)
  if (value === undefined || value === null) {
    return false;
  }

  // Context must be an object
  if (typeof value !== 'object') {
    return false;
  }

  // Empty object is valid
  return true;
}

/**
 * Helper to safely get a value from context
 *
 * @param context - The context object
 * @param key - The key to access
 * @returns The value if it exists, undefined otherwise
 *
 * @example
 * ```typescript
 * const userId = getContextValue(context, 'userId');
 * if (userId) {
 *   // Use userId safely
 * }
 * ```
 */
export function getContextValue(
  context: PuckResolveContext | undefined,
  key: string
): string | number | boolean | string[] | undefined {
  if (!isPuckResolveContext(context)) {
    return undefined;
  }
  return context[key];
}
