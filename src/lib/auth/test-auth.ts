/**
 * Hybrid authentication system
 *
 * Supports NextAuth sessions (production) and unified API tokens:
 * - user_*: User API keys
 * - device_*: Device tokens for Tauri sync
 * - cb_*: Callback tokens for agent execution
 * - agent_*: Agent API keys
 */

import { NextRequest } from 'next/server';
import { auth, getUserIdFromRequest } from '@/lib/auth';
import { extractApiKeyFromHeader } from './user-api-keys';
import { validateToken, getTokenTypeFromPrefix } from './token-service';
import { db } from '@/ddd/infrastructure/db/client';
import { users } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    organizationId: number | null;
    organizationRole?: string;
  };
  error?: string;
}

/**
 * Authenticate with an API token (unified token system)
 * Returns a session-like object for compatibility with both NextRequest and server action contexts
 *
 * Supports:
 * - user_*: User API keys
 * - device_*: Device tokens for Tauri sync
 * - cb_*: Callback tokens for agent execution
 * - agent_*: Agent API keys
 */
export async function authenticateWithApiKey(apiKeyString: string): Promise<AuthResult> {
  const tokenType = getTokenTypeFromPrefix(apiKeyString);

  if (!tokenType) {
    return { success: false, error: 'Invalid token format' };
  }

  // Use unified token validation
  const validatedToken = await validateToken(apiKeyString);
  if (validatedToken?.user) {
    return {
      success: true,
      user: {
        id: validatedToken.user.id,
        email: validatedToken.user.email,
        name: validatedToken.user.name,
        organizationId: validatedToken.user.organizationId,
        organizationRole: 'member',
      },
    };
  }

  return { success: false, error: 'Invalid API token' };
}

/**
 * Authenticate a request using session or API token
 *
 * Priority:
 * 1. NextAuth session (production authentication)
 * 2. API token (Bearer header)
 *
 * AIDEV-NOTE: X-Organization-ID header is used as fallback when auth succeeds
 * but organizationId is missing.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
    // Extract X-Organization-ID header for fallback (sent by Python HTTP client)
    const orgIdHeader = request.headers.get('x-organization-id');
    const headerOrgId = orgIdHeader ? parseInt(orgIdHeader, 10) : null;

    // First, try NextAuth session authentication
    const session = await auth();
    if (session?.user?.id) {
      return {
        success: true,
        user: {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.name || null,
          organizationId: session.user.currentOrganizationId || null,
          organizationRole: session.user.organizationRole || 'member',
        },
      };
    }

    // If no session, check for API token
    const authHeader = request.headers.get('authorization');
    const apiKey = extractApiKeyFromHeader(authHeader);

    if (apiKey) {
      const apiKeyAuth = await authenticateWithApiKey(apiKey);
      if (apiKeyAuth.success && apiKeyAuth.user) {
        // Use X-Organization-ID as fallback if auth succeeded but no organizationId
        if (!apiKeyAuth.user.organizationId && headerOrgId && !isNaN(headerOrgId)) {
          console.log(`[AUTH] Using X-Organization-ID header fallback: ${headerOrgId}`);
          apiKeyAuth.user.organizationId = headerOrgId;
        }
        return apiKeyAuth;
      }
    }

    // Fallback: try to get user from session (last resort)
    const userId = await getUserIdFromRequest(request);
    if (userId) {
      // Get user details from database
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email || '',
            name: user.name,
            organizationId: user.currentOrganizationId || (headerOrgId && !isNaN(headerOrgId) ? headerOrgId : null),
          },
        };
      }
    }

    return {
      success: false,
      error: 'No valid authentication found - requires NextAuth session or API token',
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Simple wrapper for API routes that need authentication
 */
export async function withAuth<T>(
  request: NextRequest,
  handler: (user: NonNullable<AuthResult['user']>) => Promise<T>
): Promise<T | Response> {
  const authResult = await authenticateRequest(request);

  if (!authResult.success || !authResult.user) {
    return Response.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  return handler(authResult.user);
}
