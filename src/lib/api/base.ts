/**
 * Standardized API Base Utilities
 *
 * Provides common patterns for API routes including:
 * - Consistent response types
 * - Authentication wrappers
 * - Error handling
 * - Validation helpers
 *
 * AIDEV-NOTE: All API routes should use these utilities for consistency
 */

import { NextRequest } from 'next/server';
import { authenticateRequest, type AuthResult } from '@/lib/auth/test-auth';
import { contextManager } from '@/ddd/application/di/container';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// ============================================================================
// Response Types
// ============================================================================

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  status?: number;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Standard error handler for API routes
 * Logs error and returns consistent error response
 */
export function handleApiError(error: unknown, context?: string): Response {
  const contextStr = context ? `[${context}] ` : '';
  console.error(`${contextStr}API Error:`, error);

  return Response.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Create error response with specific status code
 */
export function errorResponse(error: string, status: number = 400): Response {
  return Response.json({ success: false, error }, { status });
}

/**
 * Create success response
 */
export function successResponse<T>(data: T, message?: string): Response {
  return Response.json({ success: true, data, message }, { status: 200 });
}

// ============================================================================
// Authentication Wrappers
// ============================================================================

/**
 * Authenticated route wrapper with standardized patterns
 *
 * Handles:
 * - Authentication via authenticateRequest()
 * - Error handling with proper status codes
 * - Consistent response format
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withAuthenticatedRoute(request, async (user) => {
 *     const data = await fetchData(user.organizationId);
 *     return { success: true, data };
 *   });
 * }
 */
export async function withAuthenticatedRoute<T>(
  request: NextRequest,
  handler: (user: NonNullable<AuthResult['user']>) => Promise<ApiResponse<T>>
): Promise<Response> {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Set RLS context for all DI service calls
    // AIDEV-NOTE: This enables contextAwareDb proxy to apply RLS to all queries
    if (authResult.user.organizationId) {
      contextManager.setContext(
        OrganizationId.fromNumber(authResult.user.organizationId),
        UserId.fromString(authResult.user.id)
      );
    }

    try {
      // Execute handler with authenticated user
      const result = await handler(authResult.user);

      // Return error response if handler failed
      if (!result.success) {
        return Response.json(result, { status: result.status || 400 });
      }

      // Return success response
      return Response.json(result, { status: 200 });
    } finally {
      // Clear context after request to prevent leakage
      contextManager.clearContext();
    }

  } catch (error) {
    return handleApiError(error);
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Require a parameter to be present
 * Throws error with clear message if missing
 */
export function requireParam(value: any, name: string): asserts value {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required parameter: ${name}`);
  }
}

/**
 * Parse integer parameter with validation
 * Throws error if invalid or missing
 */
export function parseIntParam(value: string | null | undefined, name: string): number {
  if (!value) {
    throw new Error(`Missing required parameter: ${name}`);
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`Invalid ${name}: must be a number`);
  }

  return parsed;
}

/**
 * Parse optional integer parameter
 * Returns default value if not provided
 */
export function parseOptionalIntParam(
  value: string | null | undefined,
  defaultValue: number
): number {
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validate request body has required fields
 */
export function validateRequestBody<T extends Record<string, any>>(
  body: any,
  requiredFields: (keyof T)[]
): asserts body is T {
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === undefined || body[field] === null) {
      throw new Error(`Missing required field: ${String(field)}`);
    }
  }
}

// ============================================================================
// Request Body Parsing
// ============================================================================

/**
 * Safely parse JSON request body
 * Returns error response if parsing fails
 */
export async function parseJsonBody<T = any>(request: NextRequest): Promise<T | null> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}
