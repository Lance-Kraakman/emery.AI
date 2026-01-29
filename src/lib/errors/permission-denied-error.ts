/**
 * Permission Denied Error - Structured error for RBAC permission failures.
 *
 * AIDEV-NOTE: This error class provides structured permission information
 * that can be serialized to JSON for the Python agent layer to parse.
 *
 * Usage in API routes:
 *   throw new PermissionDeniedError({
 *     permission: 'database:view',
 *     resource: 'database',
 *     resourceId: 42,
 *     action: 'view',
 *     message: 'You do not have permission to view this database'
 *   });
 *
 * In error handler:
 *   if (error instanceof PermissionDeniedError) {
 *     return NextResponse.json(error.toJSON(), { status: 403 });
 *   }
 */

export interface PermissionDeniedErrorParams {
  permission: string;
  resource?: string;
  resourceId?: number;
  action: string;
  message?: string;
}

export interface PermissionDeniedJSON {
  error: string;
  code: 'PERMISSION_DENIED';
  permission: string;
  resource?: string;
  resourceId?: number;
  action: string;
}

export class PermissionDeniedError extends Error {
  public readonly permission: string;
  public readonly resource?: string;
  public readonly resourceId?: number;
  public readonly action: string;

  constructor(params: PermissionDeniedErrorParams) {
    const message = params.message || `Permission denied: ${params.permission}`;
    super(message);

    this.name = 'PermissionDeniedError';
    this.permission = params.permission;
    this.resource = params.resource;
    this.resourceId = params.resourceId;
    this.action = params.action;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionDeniedError);
    }
  }

  /**
   * Serialize error to structured JSON for API responses.
   *
   * The Python agent layer parses this structure to extract
   * permission information for user-friendly error messages.
   */
  toJSON(): PermissionDeniedJSON {
    return {
      error: this.message,
      code: 'PERMISSION_DENIED',
      permission: this.permission,
      resource: this.resource,
      resourceId: this.resourceId,
      action: this.action,
    };
  }

  /**
   * Create a PermissionDeniedError from a permission string.
   *
   * @example
   * PermissionDeniedError.fromPermission('database:view')
   * // Creates error with resource='database', action='view'
   */
  static fromPermission(
    permissionString: string,
    resourceId?: number
  ): PermissionDeniedError {
    const parts = permissionString.split(':');
    const resource = parts[0] || 'unknown';
    const action = parts[1] || 'unknown';

    return new PermissionDeniedError({
      permission: permissionString,
      resource,
      resourceId,
      action,
    });
  }
}

/**
 * Type guard to check if an error is a PermissionDeniedError.
 */
export function isPermissionDeniedError(
  error: unknown
): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}
