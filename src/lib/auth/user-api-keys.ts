/**
 * User API Key utilities for management APIs
 *
 * Per-user API keys provide access to management APIs like:
 * - /api/agents (create, list agents)
 * - /api/tasks (list, create tasks)
 * - /api/tables (create, list tables)
 *
 * Per-agent API keys (separate system) are used for:
 * - /api/agents/proxy (OAuth proxy calls)
 *
 * Keys are stored as SHA-256 hashes. Plaintext is only available at generation time.
 * Grace period support: old key hash kept in previousApiKeyHash for 24h after rotation.
 */

import { db } from '@/ddd/infrastructure/db/client';
import { users } from '@/ddd/infrastructure/db/schema';
import { eq, or, and, gte } from 'drizzle-orm';
import { ApiKey } from '@/ddd/domain/shared/value-objects';

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UserApiKeyInfo {
  id: string;
  email: string;
  name: string | null;
  organizationId: number | null;
  roleId: number | null;
}

/**
 * Validate a user API key and return user info.
 * Hashes the incoming plaintext key and checks against stored hash.
 * Also checks previousApiKeyHash if within grace period.
 */
export async function validateUserApiKey(apiKey: string): Promise<UserApiKeyInfo | null> {
  try {
    if (!apiKey.startsWith('user_')) {
      return null;
    }

    const hash = ApiKey.hash(apiKey);
    const now = new Date();

    const userRecord = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        organizationId: users.currentOrganizationId,
      })
      .from(users)
      .where(
        or(
          eq(users.apiKeyHash, hash),
          and(
            eq(users.previousApiKeyHash, hash),
            gte(users.previousApiKeyExpiresAt, now)
          )
        )
      )
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
      roleId: null,
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
 * Generate and assign an API key to a user.
 * Stores SHA-256 hash + prefix. Returns plaintext (shown once).
 */
export async function assignApiKeyToUser(userId: string): Promise<string> {
  try {
    const { plaintext, hash, prefix } = ApiKey.generateUserKeyWithHash();

    await db
      .update(users)
      .set({
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
      })
      .where(eq(users.id, userId));

    return plaintext;
  } catch (error) {
    console.error('Error assigning API key to user:', error);
    throw error;
  }
}

/**
 * Ensure a fresh user API key exists and return the plaintext.
 * Generates a new key each time, moving the old hash to grace period.
 * Used by chat/skills to inject a valid plaintext key for Python agent callbacks.
 */
export async function ensureFreshUserApiKey(userId: string): Promise<string> {
  const { plaintext, hash, prefix } = ApiKey.generateUserKeyWithHash();

  // Get current hash to move to grace period
  const [currentUser] = await db
    .select({ apiKeyHash: users.apiKeyHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const previousHash = currentUser?.apiKeyHash || null;

  await db
    .update(users)
    .set({
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      previousApiKeyHash: previousHash,
      previousApiKeyExpiresAt: previousHash ? new Date(Date.now() + GRACE_PERIOD_MS) : null,
    })
    .where(eq(users.id, userId));

  return plaintext;
}
