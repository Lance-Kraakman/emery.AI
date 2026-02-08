/**
 * Hybrid authentication system
 *
 * Supports NextAuth sessions (production), user API keys (automation/testing),
 * and agent API keys (tool execution using agent owner's identity).
 */

import { NextRequest } from 'next/server';
import { auth, getUserIdFromRequest } from '@/lib/auth';
import { validateUserApiKey, extractApiKeyFromHeader } from './user-api-keys';
import { db } from '@/ddd/infrastructure/db/client';
import { users } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { getAgentRepository, getUserRepository } from '@/ddd/application/di/container';
import { ApiKey } from '@/ddd/domain/shared/value-objects';

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
 * Authenticate with an API key (user or agent)
 * Returns a session-like object for compatibility with both NextRequest and server action contexts
 *
 * This is the shared authentication logic used by both:
 * - authenticateRequest() in API routes
 * - requireAuth() in server actions
 */
export async function authenticateWithApiKey(apiKeyString: string): Promise<AuthResult> {
  // Try user API key first (format: user_*)
  if (apiKeyString.startsWith('user_')) {
    const apiKeyUser = await validateUserApiKey(apiKeyString);
    if (apiKeyUser) {
      return {
        success: true,
        user: {
          id: apiKeyUser.id,
          email: apiKeyUser.email,
          name: apiKeyUser.name,
          organizationId: apiKeyUser.organizationId,
          organizationRole: 'member',
        },
      };
    }
  }

  // Try agent API key (uses agent owner's identity)
  try {
    const agentRepository = getAgentRepository();
    const apiKey = ApiKey.fromString(apiKeyString);
    const agent = await agentRepository.findByApiKey(apiKey);

    if (!agent) {
      return { success: false, error: 'Invalid API key' };
    }

    // Use agent owner's identity (same pattern as Pipedream proxy)
    const userRepository = getUserRepository();
    const owner = await userRepository.findById(agent.ownerId);

    if (!owner) {
      return { success: false, error: 'Agent owner not found' };
    }

    return {
      success: true,
      user: {
        id: owner.id.value,
        email: owner.email?.value || '',
        name: owner.name ?? null,
        organizationId: owner.currentOrganizationId?.value ?? null,
        organizationRole: 'member',
      },
    };
  } catch (error) {
    console.error('API key authentication error:', error);
    return { success: false, error: 'API key authentication failed' };
  }
}

/**
 * Authenticate a request using session, user API key, agent API key, or development bypass
 *
 * Priority:
 * 1. NextAuth session (production authentication)
 * 2. User API key (automation/testing authentication - format: user_*)
 * 3. Agent API key (tool execution using agent owner's identity)
 * 4. Development bypass (testing with x-test-user-id header)
 *
 * AIDEV-NOTE: X-Organization-ID header is used as fallback when auth succeeds
 * but organizationId is missing (e.g., agent API keys with owner having no current org).
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

    // If no session, check for API key (user or agent)
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
            // organizationRole removed in RBAC system
          },
        };
      }
    }

    return {
      success: false,
      error: 'No valid authentication found - requires NextAuth session, user API key, or agent API key',
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
