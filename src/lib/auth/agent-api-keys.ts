/**
 * Agent API Key utilities for execution credential resolution
 *
 * Per-agent API keys (key_xxx format) are used for:
 * - OAuth proxy calls with delegation checking (api_key_mode: 'agent')
 * - Scheduled task execution (automations, schedules)
 * - Chat @agent mention execution
 * - Chat @skill execution for agent-owned skills
 *
 * Keys are stored as SHA-256 hashes. Plaintext is only available at generation time.
 * Grace period support: old key hash kept in previousApiKeyHash for 24h after rotation.
 */

import { db } from '@/ddd/infrastructure/db/client';
import { agents } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { ApiKey } from '@/ddd/domain/shared/value-objects';

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Ensure a fresh agent API key exists and return the plaintext.
 * Generates a new key each time, moving the old hash to grace period.
 * Used by execution paths that need a valid plaintext agent key for OAuth proxy auth.
 *
 * @param agentId - The agent to generate a key for
 * @param expectedOrgId - Optional org ID for defense-in-depth verification.
 *   When provided, verifies the agent belongs to this org before rotating keys.
 *   Prevents cross-tenant key rotation if caller passes wrong agent ID.
 */
export async function ensureFreshAgentApiKey(agentId: number, expectedOrgId?: number): Promise<string> {
  const { plaintext, hash, prefix } = ApiKey.generateWithHash(); // key_xxx format

  // Get current hash to move to grace period (+ org ID for verification)
  const [currentAgent] = await db
    .select({ apiKeyHash: agents.apiKeyHash, organizationId: agents.organizationId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!currentAgent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // Defense-in-depth: verify agent belongs to expected org
  if (expectedOrgId !== undefined && currentAgent.organizationId !== expectedOrgId) {
    throw new Error(`Agent ${agentId} does not belong to organization ${expectedOrgId}`);
  }

  const previousHash = currentAgent?.apiKeyHash || null;

  await db
    .update(agents)
    .set({
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      previousApiKeyHash: previousHash,
      previousApiKeyExpiresAt: previousHash ? new Date(Date.now() + GRACE_PERIOD_MS) : null,
    })
    .where(eq(agents.id, agentId));

  return plaintext;
}
