/**
 * User API Key utilities for management APIs
 * 
 * Per-user API keys provide access to management APIs like:
 * - /api/agents (create, list agents)  
 * - /api/tasks (list, create tasks)
 * - /api/scheduler/status (control scheduler)
 * - /api/tables (create, list tables)
 *
 * Per-agent API keys (separate system) are used for:
 * - /api/agents/proxy (OAuth proxy calls)
 */

import crypto from 'crypto';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface UserApiKeyInfo {
  id: string;
  email: string;
  name: string | null;
  organizationId: number | null;
  roleId: number | null;
}

/**
 * Generate a user API key
 * Format: user_<randomBytes>
 */
export function generateUserApiKey(): string {
  const randomBytes = crypto.randomBytes(24).toString('hex'); // 48 chars
  return `user_${randomBytes}`;
}

/**
 * Validate a user API key and return user info
 * Only works with user API keys (prefix 'user_')
 */
export async function validateUserApiKey(apiKey: string): Promise<UserApiKeyInfo | null> {
  try {
    // Only allow user API keys
    if (!apiKey.startsWith('user_')) {
      return null;
    }

    // Find user by API key
    const userRecord = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        organizationId: users.organizationId,
        roleId: users.roleId,
      })
      .from(users)
      .where(eq(users.apiKey, apiKey))
      .limit(1);

    if (userRecord.length === 0) {
      return null;
    }

    const user = userRecord[0];
    return {
      id: user.id,
      email: user.email || '',
      name: user.name,
      organizationId: user.organizationId,
      roleId: user.roleId,
    };
  } catch (error) {
    console.error('Error validating user API key:', error);
    return null;
  }
}

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

/**
 * Generate and assign an API key to a user
 * Used when user first needs an API key
 */
export async function assignApiKeyToUser(userId: string): Promise<string> {
  try {
    const apiKey = generateUserApiKey();
    
    await db
      .update(users)
      .set({ apiKey })
      .where(eq(users.id, userId));
    
    return apiKey;
  } catch (error) {
    console.error('Error assigning API key to user:', error);
    throw error;
  }
}