/**
 * Hybrid authentication system
 * 
 * Supports both NextAuth sessions (production) and user API keys (automation/testing).
 * Also maintains separate per-agent API keys for OAuth proxy.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { validateUserApiKey, extractApiKeyFromHeader, UserApiKeyInfo } from './user-api-keys';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    organizationId: number | null;
    roleId?: number | null;
  };
  error?: string;
}

/**
 * Authenticate a request using either NextAuth session or user API key
 * 
 * Priority:
 * 1. NextAuth session (production authentication)
 * 2. User API key (automation/testing authentication)
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
          organizationId: session.user.organizationId || null,
          roleId: session.user.roleId || null,
        },
      };
    }

    // If no session, check for user API key
    const authHeader = request.headers.get('authorization');
    const apiKey = extractApiKeyFromHeader(authHeader);
    
    if (apiKey && apiKey.startsWith('user_')) {
      const apiKeyUser = await validateUserApiKey(apiKey);
      if (apiKeyUser) {
        return {
          success: true,
          user: {
            id: apiKeyUser.id,
            email: apiKeyUser.email,
            name: apiKeyUser.name,
            organizationId: apiKeyUser.organizationId,
            roleId: apiKeyUser.roleId,
          },
        };
      }
    }

    return {
      success: false,
      error: 'No valid authentication found - requires NextAuth session or user API key',
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