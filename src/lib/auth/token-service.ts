/**
 * Unified Token Service
 *
 * Provides a consistent interface for all token types:
 * - user_api: User automation, manual use
 * - device: Tauri desktop sync (stable, no expiry)
 * - callback: Agent execution callbacks (1hr TTL)
 * - agent_api: Agent identity
 * - published_agent: External API access
 *
 * All tokens are stored as SHA-256 hashes. Plaintext is only available at generation time.
 */

import { db } from '@/ddd/infrastructure/db/client';
import { apiTokens, users, agents } from '@/ddd/infrastructure/db/schema';
import { eq, or, and, gte, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

// Token type constants
export const TokenType = {
  USER_API: 'user_api',
  DEVICE: 'device',
  CALLBACK: 'callback',
  AGENT_API: 'agent_api',
  PUBLISHED_AGENT: 'published_agent',
} as const;

export type TokenTypeValue = typeof TokenType[keyof typeof TokenType];

// Token prefixes
const TOKEN_PREFIXES: Record<TokenTypeValue, string> = {
  user_api: 'user_',
  device: 'device_',
  callback: 'cb_',
  agent_api: 'agent_',
  published_agent: 'pk_',
};

// Default scopes per token type
const DEFAULT_SCOPES: Record<TokenTypeValue, string[]> = {
  user_api: ['user:read', 'user:write', 'agent:read', 'agent:write'],
  device: ['workspace:sync', 'agent:stream'],
  callback: ['agent:callback'],
  agent_api: ['agent:execute', 'oauth:proxy'],
  published_agent: ['task:execute', 'skill:execute'],
};

// Grace period for rotating tokens (24 hours)
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

// Callback token TTL (1 hour)
const CALLBACK_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface CreateTokenConfig {
  tokenType: TokenTypeValue;
  userId?: string;
  agentId?: number;
  scopes?: string[];
  expiresAt?: Date | null;
}

export interface TokenInfo {
  id: number;
  tokenType: TokenTypeValue;
  userId: string | null;
  agentId: number | null;
  scopes: string[];
  expiresAt: Date | null;
  isRevoked: boolean;
}

export interface ValidatedToken extends TokenInfo {
  // Additional user/agent info when validated
  user?: {
    id: string;
    email: string;
    name: string | null;
    organizationId: number | null;
  };
  agent?: {
    id: number;
    name: string;
    organizationId: number;
  };
}

/**
 * Generate a random token with the appropriate prefix
 */
function generateToken(tokenType: TokenTypeValue): { plaintext: string; hash: string; prefix: string } {
  const randomHex = randomBytes(24).toString('hex'); // 192-bit entropy
  const tokenPrefix = TOKEN_PREFIXES[tokenType];
  const plaintext = `${tokenPrefix}${randomHex}`;
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return {
    plaintext,
    hash,
    prefix: plaintext.substring(0, 12),
  };
}

/**
 * Hash a plaintext token
 */
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Create a new token and store it in the database.
 * Returns the plaintext token (shown once, not stored).
 */
export async function createToken(config: CreateTokenConfig): Promise<string> {
  const { tokenType, userId, agentId, scopes, expiresAt } = config;

  // Validate owner is set
  if (!userId && !agentId) {
    throw new Error('Token must have either userId or agentId');
  }

  const { plaintext, hash, prefix } = generateToken(tokenType);

  // Determine expiry
  let tokenExpiresAt = expiresAt;
  if (tokenExpiresAt === undefined) {
    // Auto-set expiry for callback tokens
    if (tokenType === TokenType.CALLBACK) {
      tokenExpiresAt = new Date(Date.now() + CALLBACK_TOKEN_TTL_MS);
    } else {
      tokenExpiresAt = null; // No expiry by default
    }
  }

  // Use default scopes if not specified
  const tokenScopes = scopes ?? DEFAULT_SCOPES[tokenType];

  await db.insert(apiTokens).values({
    tokenType,
    tokenHash: hash,
    tokenPrefix: prefix,
    userId: userId ?? null,
    agentId: agentId ?? null,
    scopes: tokenScopes,
    expiresAt: tokenExpiresAt,
    isRevoked: false,
    createdAt: new Date(),
    usageCount: 0,
  });

  return plaintext;
}

/**
 * Create or get existing device token for a user.
 * Device tokens are stable (don't rotate) so we return existing if found.
 */
export async function getOrCreateDeviceToken(userId: string): Promise<string> {
  // Check for existing active device token
  const existing = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, userId),
        eq(apiTokens.tokenType, TokenType.DEVICE),
        eq(apiTokens.isRevoked, false)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Return a newly generated token that matches the hash
    // Actually we can't - we don't store plaintext. Need to generate new one.
    // For device tokens, we generate a new one but keep the old hash valid in grace period
    return rotateToken(existing[0].id);
  }

  // No existing token, create new one
  return createToken({
    tokenType: TokenType.DEVICE,
    userId,
  });
}

/**
 * Create a callback token for agent execution.
 * Short-lived (1 hour) and scoped to agent callbacks only.
 */
export async function createCallbackToken(userId: string, agentId?: number): Promise<string> {
  return createToken({
    tokenType: TokenType.CALLBACK,
    userId,
    agentId,
    expiresAt: new Date(Date.now() + CALLBACK_TOKEN_TTL_MS),
  });
}

/**
 * Validate a token and return its info.
 * Checks hash, expiry, and revocation status.
 * Also checks previousTokenHash if within grace period.
 */
export async function validateToken(plaintext: string, requiredScopes?: string[]): Promise<ValidatedToken | null> {
  try {
    const hash = hashToken(plaintext);
    const now = new Date();

    // Find token by hash (current or previous within grace period)
    const tokenRecords = await db
      .select()
      .from(apiTokens)
      .where(
        and(
          or(
            eq(apiTokens.tokenHash, hash),
            and(
              eq(apiTokens.previousTokenHash, hash),
              gte(apiTokens.previousTokenExpiresAt, now)
            )
          ),
          eq(apiTokens.isRevoked, false),
          or(
            isNull(apiTokens.expiresAt),
            gte(apiTokens.expiresAt, now)
          )
        )
      )
      .limit(1);

    if (tokenRecords.length === 0) {
      return null;
    }

    const token = tokenRecords[0];

    // Check required scopes
    if (requiredScopes && requiredScopes.length > 0) {
      const tokenScopes = token.scopes as string[];
      const hasAllScopes = requiredScopes.every(scope => tokenScopes.includes(scope));
      if (!hasAllScopes) {
        return null;
      }
    }

    // Update last used
    await db
      .update(apiTokens)
      .set({
        lastUsedAt: now,
        usageCount: (token.usageCount || 0) + 1,
      })
      .where(eq(apiTokens.id, token.id));

    // Build result
    const result: ValidatedToken = {
      id: token.id,
      tokenType: token.tokenType as TokenTypeValue,
      userId: token.userId,
      agentId: token.agentId,
      scopes: token.scopes as string[],
      expiresAt: token.expiresAt,
      isRevoked: token.isRevoked,
    };

    // Fetch user info if userId present
    if (token.userId) {
      const userRecords = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          organizationId: users.currentOrganizationId,
        })
        .from(users)
        .where(eq(users.id, token.userId))
        .limit(1);

      if (userRecords.length > 0) {
        const user = userRecords[0];
        result.user = {
          id: user.id,
          email: user.email || '',
          name: user.name,
          organizationId: user.organizationId,
        };
      }
    }

    // Fetch agent info if agentId present
    if (token.agentId) {
      const agentRecords = await db
        .select({
          id: agents.id,
          name: agents.name,
          organizationId: agents.organizationId,
        })
        .from(agents)
        .where(eq(agents.id, token.agentId))
        .limit(1);

      if (agentRecords.length > 0) {
        const agent = agentRecords[0];
        result.agent = {
          id: agent.id,
          name: agent.name,
          organizationId: agent.organizationId,
        };
      }
    }

    return result;
  } catch (error) {
    console.error('Error validating token:', error);
    return null;
  }
}

/**
 * Revoke a token by ID
 */
export async function revokeToken(tokenId: number): Promise<void> {
  await db
    .update(apiTokens)
    .set({ isRevoked: true })
    .where(eq(apiTokens.id, tokenId));
}

/**
 * Revoke all tokens of a specific type for a user
 */
export async function revokeUserTokens(userId: string, tokenType?: TokenTypeValue): Promise<void> {
  const conditions = [eq(apiTokens.userId, userId)];
  if (tokenType) {
    conditions.push(eq(apiTokens.tokenType, tokenType));
  }

  await db
    .update(apiTokens)
    .set({ isRevoked: true })
    .where(and(...conditions));
}

/**
 * Rotate a token - generate new one, move old to grace period
 * Returns the new plaintext token
 */
export async function rotateToken(tokenId: number): Promise<string> {
  // Get existing token
  const existing = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.id, tokenId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Token not found');
  }

  const token = existing[0];

  // Generate new token
  const { plaintext, hash, prefix } = generateToken(token.tokenType as TokenTypeValue);

  // Update token with new hash, move old to grace period
  await db
    .update(apiTokens)
    .set({
      tokenHash: hash,
      tokenPrefix: prefix,
      previousTokenHash: token.tokenHash,
      previousTokenExpiresAt: new Date(Date.now() + GRACE_PERIOD_MS),
    })
    .where(eq(apiTokens.id, tokenId));

  return plaintext;
}

/**
 * Get token type from plaintext prefix
 */
export function getTokenTypeFromPrefix(plaintext: string): TokenTypeValue | null {
  for (const [type, prefix] of Object.entries(TOKEN_PREFIXES)) {
    if (plaintext.startsWith(prefix)) {
      return type as TokenTypeValue;
    }
  }
  return null;
}

/**
 * List all active tokens for a user
 */
export async function listUserTokens(userId: string): Promise<TokenInfo[]> {
  const now = new Date();

  const tokens = await db
    .select()
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, userId),
        eq(apiTokens.isRevoked, false),
        or(
          isNull(apiTokens.expiresAt),
          gte(apiTokens.expiresAt, now)
        )
      )
    );

  return tokens.map((t: typeof apiTokens.$inferSelect) => ({
    id: t.id,
    tokenType: t.tokenType as TokenTypeValue,
    userId: t.userId,
    agentId: t.agentId,
    scopes: t.scopes as string[],
    expiresAt: t.expiresAt,
    isRevoked: t.isRevoked,
  }));
}
