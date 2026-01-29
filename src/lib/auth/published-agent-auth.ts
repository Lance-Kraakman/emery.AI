/**
 * Published Agent Authentication
 *
 * Validates API keys for external access to published agents.
 * Supports:
 * - X-API-Key header
 * - Authorization: Bearer <api_key>
 */

import { createHash } from 'crypto';
import { db } from '@/ddd/infrastructure/db/client';
import { publishedAgents, publishedAgentApiKeys } from '@/ddd/infrastructure/db/schema';
import { eq, and, isNull, or, gte } from 'drizzle-orm';
import type { PublishedAgentAuthResult, ApiKeyScope } from '@/ddd/domain/published-agents/types';

/**
 * Authenticate a request to a published agent
 *
 * @param request - The incoming request
 * @param slug - The published agent slug from the URL
 * @returns Authentication result with publishedAgentId if successful
 */
export async function authenticatePublishedAgentRequest(
  request: Request,
  slug: string
): Promise<PublishedAgentAuthResult> {
  // 1. Extract API key from headers
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return { success: false, error: 'No API key provided. Use X-API-Key header or Authorization: Bearer <key>' };
  }

  // 2. Validate API key format
  if (!apiKey.startsWith('pk_')) {
    return { success: false, error: 'Invalid API key format' };
  }

  // 3. Hash the key for lookup
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // 4. Find the API key in the database
  const keyRecord = await db.select({
    id: publishedAgentApiKeys.id,
    publishedAgentId: publishedAgentApiKeys.publishedAgentId,
    scopes: publishedAgentApiKeys.scopes,
    isRevoked: publishedAgentApiKeys.isRevoked,
    expiresAt: publishedAgentApiKeys.expiresAt,
  })
    .from(publishedAgentApiKeys)
    .where(eq(publishedAgentApiKeys.keyHash, keyHash))
    .limit(1);

  if (keyRecord.length === 0) {
    return { success: false, error: 'Invalid API key' };
  }

  const key = keyRecord[0];

  // 5. Check if key is revoked
  if (key.isRevoked) {
    return { success: false, error: 'API key has been revoked' };
  }

  // 6. Check if key is expired
  if (key.expiresAt && key.expiresAt < new Date()) {
    return { success: false, error: 'API key has expired' };
  }

  // 7. Verify the key belongs to the requested published agent
  const publishedAgent = await db.select({
    id: publishedAgents.id,
    slug: publishedAgents.slug,
    organizationId: publishedAgents.organizationId,
    status: publishedAgents.status,
  })
    .from(publishedAgents)
    .where(eq(publishedAgents.id, key.publishedAgentId))
    .limit(1);

  if (publishedAgent.length === 0) {
    return { success: false, error: 'Published agent not found' };
  }

  const agent = publishedAgent[0];

  // 8. Verify the slug matches
  if (agent.slug !== slug) {
    return { success: false, error: 'API key does not match the requested agent' };
  }

  // 9. Update last used timestamp (fire and forget)
  db.update(publishedAgentApiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: (key as { usageCount?: number }).usageCount ? (key as { usageCount: number }).usageCount + 1 : 1
    })
    .where(eq(publishedAgentApiKeys.id, key.id))
    .then(() => {})
    .catch(() => {});

  return {
    success: true,
    publishedAgentId: key.publishedAgentId,
    keyId: key.id,
    scopes: (key.scopes ?? ['task:execute', 'skill:execute']) as ApiKeyScope[],
  };
}

/**
 * Validate that the auth result has the required scope
 */
export function hasScope(
  authResult: PublishedAgentAuthResult,
  requiredScope: ApiKeyScope
): boolean {
  if (!authResult.success || !authResult.scopes) {
    return false;
  }
  return authResult.scopes.includes(requiredScope);
}

/**
 * Get organization ID for a published agent
 * Used after authentication to set up the execution context
 */
export async function getPublishedAgentOrganization(
  publishedAgentId: number
): Promise<number | null> {
  const result = await db.select({
    organizationId: publishedAgents.organizationId,
  })
    .from(publishedAgents)
    .where(eq(publishedAgents.id, publishedAgentId))
    .limit(1);

  return result.length > 0 ? result[0].organizationId : null;
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function extractApiKey(request: Request): string | null {
  // Check X-API-Key header first (preferred for API keys)
  const xApiKey = request.headers.get('X-API-Key');
  if (xApiKey) {
    return xApiKey;
  }

  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}
