/**
 * Puck Server Action Error Handling Utilities
 *
 * Standardized error handling for all Puck server actions.
 * See: /docs/architecture/decisions/001-server-action-patterns.md
 */

export type ErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'PERMISSION'
  | 'DATABASE'
  | 'UNKNOWN';

export interface Result<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
}

/**
 * Helper functions for consistent error messages
 */
export const ActionError = {
  /**
   * Entity not found error
   * @example ActionError.notFound('Page', 123) → "Page not found: 123"
   */
  notFound: (entity: string, id: number | string): string =>
    `${entity} not found: ${id}`,

  /**
   * Validation error
   * @example ActionError.validation(['Name required', 'Invalid slug']) → "Validation failed: Name required, Invalid slug"
   */
  validation: (errors: string[]): string =>
    `Validation failed: ${errors.join(", ")}`,

  /**
   * Permission error
   * @example ActionError.permission('create page') → "Insufficient permissions: create page"
   */
  permission: (action: string): string =>
    `Insufficient permissions: ${action}`,

  /**
   * Database operation error
   * @example ActionError.database('fetch page') → "Database error during fetch page"
   */
  database: (operation: string): string =>
    `Database error during ${operation}`,

  /**
   * Unknown/unexpected error
   * @example ActionError.unknown('Connection timeout') → "Connection timeout"
   */
  unknown: (message?: string): string =>
    message || "An unexpected error occurred",
};

/**
 * Type guard to check if result is success
 */
export function isSuccess<T>(result: Result<T>): result is Result<T> & { data: T } {
  return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if result is error
 */
export function isError<T>(result: Result<T>): result is Result<T> & { error: string; errorCode: ErrorCode } {
  return result.success === false;
}
