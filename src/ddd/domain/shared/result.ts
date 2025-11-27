/**
 * Unified Result Pattern for DDD Architecture
 * 
 * Provides consistent success/error handling across all application layers
 * with rich error context, warnings, and validation feedback.
 * 
 * AIDEV-NOTE: This replaces the legacy ActionResult and individual 
 * XxxApplicationResult interfaces for consistency and maintainability.
 */

export interface Result<T = any> {
  /** Operation success status */
  success: boolean;
  
  /** Result data when operation succeeds */
  data?: T;
  
  /** Primary error message when operation fails */
  error?: string;
  
  /** Non-blocking warnings that don't prevent success */
  warnings?: string[];
  
  /** Field-specific validation errors for form feedback */
  validationErrors?: Array<{
    field: string;
    error: string;
  }>;
  
  /** Additional metadata for specialized operations */
  metadata?: Record<string, any>;
}

/**
 * Helper functions for creating Result objects
 */
export class ResultHelpers {
  /**
   * Create a successful result
   */
  static success<T>(data?: T, warnings?: string[], metadata?: Record<string, any>): Result<T> {
    return {
      success: true,
      data,
      warnings,
      metadata
    };
  }

  /**
   * Create a failed result
   */
  static failure<T>(
    error: string, 
    validationErrors?: Array<{ field: string; error: string }>,
    metadata?: Record<string, any>
  ): Result<T> {
    return {
      success: false,
      error,
      validationErrors,
      metadata
    };
  }

  /**
   * Create a validation error result
   */
  static validationError<T>(
    validationErrors: Array<{ field: string; error: string }>,
    primaryError?: string
  ): Result<T> {
    return {
      success: false,
      error: primaryError || 'Validation failed',
      validationErrors
    };
  }

  /**
   * Create a successful result with warnings
   */
  static successWithWarnings<T>(
    data?: T, 
    warnings: string[] = [],
    metadata?: Record<string, any>
  ): Result<T> {
    return {
      success: true,
      data,
      warnings,
      metadata
    };
  }
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T>(result: Result<T>): result is Result<T> & { success: true } {
  return result.success;
}

/**
 * Type guard to check if result is a failure
 */
export function isFailure<T>(result: Result<T>): result is Result<T> & { success: false } {
  return !result.success;
}

/**
 * Type guard to check if result has validation errors
 */
export function hasValidationErrors<T>(result: Result<T>): result is Result<T> & { 
  validationErrors: Array<{ field: string; error: string }> 
} {
  return Array.isArray(result.validationErrors) && result.validationErrors.length > 0;
}

/**
 * Type guard to check if result has warnings
 */
export function hasWarnings<T>(result: Result<T>): result is Result<T> & { 
  warnings: string[] 
} {
  return Array.isArray(result.warnings) && result.warnings.length > 0;
}