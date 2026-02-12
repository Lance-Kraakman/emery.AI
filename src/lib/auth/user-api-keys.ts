/**
 * User API Key utilities
 *
 * DEPRECATED: Most functions moved to token-service.ts
 * This file now only contains helper functions for header extraction.
 */

/**
 * Extract API key from Authorization header
 * Supports: "Bearer <api_key>" or "Api-Key <api_key>"
 */
export function extractApiKeyFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  if (authHeader.startsWith('Api-Key ')) {
    return authHeader.substring(8);
  }

  return null;
}
