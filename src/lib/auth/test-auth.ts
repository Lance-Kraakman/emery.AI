/**
 * Hybrid authentication system
 *
 * Supports NextAuth sessions (production), user API keys (automation/testing),
 * and agent API keys (tool execution using agent owner's identity).
 */

import { NextRequest } from 'next/server';
import { auth, getUserIdFromRequest } from '@/lib/auth';
import { validateUserApiKey, extractApiKeyFromHeader, UserApiKeyInfo } from './user-api-keys';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
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
 * Authenticate an agent API key by looking up the agent and using the owner's identity
 * This allows agents to perform operations on behalf of their owners
 */
async function authenticateAgentApiKey(apiKeyString: string): Promise<AuthResult> {
  try {
    const agentRepository = getAgentRepository();
    const apiKey = ApiKey.fromString(apiKeyString);
    const agent = await agentRepository.findByApiKey(apiKey);

    if (!agent) {
      return { success: false, error: 'Invalid agent API key' };
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
        email: owner.email,
        name: owner.name,
        organizationId: owner.currentOrganizationId,
        organizationRole: 'member',
      },
    };
  } catch (error) {
    console.error('Agent API key authentication error:', error);
    return { success: false, error: 'Agent API key authentication failed' };
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
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  try {
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
      // Try user API key first (format: user_*)
      if (apiKey.startsWith('user_')) {
        const apiKeyUser = await validateUserApiKey(apiKey);
        if (apiKeyUser) {
          return {
            success: true,
            user: {
              id: apiKeyUser.id,
              email: apiKeyUser.email,
              name: apiKeyUser.name,
              organizationId: apiKeyUser.organizationId,
              organizationRole: 'member', // Default role for API key users
            },
          };
        }
      }

      // Try agent API key (any other format - uses agent owner's identity)
      const agentAuth = await authenticateAgentApiKey(apiKey);
      if (agentAuth.success) {
        return agentAuth;
      }
    }

    // Development bypass using x-test-user-id header
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
            organizationId: user.currentOrganizationId,
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
