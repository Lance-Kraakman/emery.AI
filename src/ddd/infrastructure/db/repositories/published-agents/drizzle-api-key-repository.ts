/**
 * Drizzle Published Agent API Key Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { publishedAgentApiKeys } from '@/ddd/infrastructure/db/schema';
import { eq, and, isNull, or, gte, sql } from 'drizzle-orm';
import type {
  IPublishedAgentApiKeyRepository,
  CreateApiKeyData,
} from '@/ddd/domain/published-agents/interfaces/published-agent-repository';
import type {
  PublishedAgentApiKey,
  ApiKeyScope,
  ApiKeyFilters,
} from '@/ddd/domain/published-agents/types';

export class DrizzlePublishedAgentApiKeyRepository implements IPublishedAgentApiKeyRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateApiKeyData): Promise<PublishedAgentApiKey> {
    const [result] = await this.db.insert(publishedAgentApiKeys).values({
      publishedAgentId: data.publishedAgentId,
      name: data.name,
      keyHash: data.keyHash,
      keyPrefix: data.keyPrefix,
      scopes: data.scopes ?? ['task:execute', 'skill:execute'],
      expiresAt: data.expiresAt ?? null,
    }).returning();

    return this.mapToEntity(result);
  }

  async findById(id: number): Promise<PublishedAgentApiKey | null> {
    const [result] = await this.db.select()
      .from(publishedAgentApiKeys)
      .where(eq(publishedAgentApiKeys.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findByKeyHash(keyHash: string): Promise<PublishedAgentApiKey | null> {
    const [result] = await this.db.select()
      .from(publishedAgentApiKeys)
      .where(eq(publishedAgentApiKeys.keyHash, keyHash));

    return result ? this.mapToEntity(result) : null;
  }

  async findByPublishedAgentId(
    publishedAgentId: number,
    filters?: ApiKeyFilters
  ): Promise<PublishedAgentApiKey[]> {
    const conditions = [eq(publishedAgentApiKeys.publishedAgentId, publishedAgentId)];

    // Filter by revoked status
    if (filters?.isRevoked !== undefined) {
      conditions.push(eq(publishedAgentApiKeys.isRevoked, filters.isRevoked));
    }

    // Filter out expired keys unless explicitly included
    if (!filters?.includeExpired) {
      conditions.push(
        or(
          isNull(publishedAgentApiKeys.expiresAt),
          gte(publishedAgentApiKeys.expiresAt, new Date())
        )!
      );
    }

    const results = await this.db.select()
      .from(publishedAgentApiKeys)
      .where(and(...conditions));

    return results.map((r: typeof publishedAgentApiKeys.$inferSelect) => this.mapToEntity(r));
  }

  async recordUsage(id: number): Promise<void> {
    await this.db.update(publishedAgentApiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: sql`${publishedAgentApiKeys.usageCount} + 1`,
      })
      .where(eq(publishedAgentApiKeys.id, id));
  }

  async revoke(id: number): Promise<PublishedAgentApiKey> {
    const [result] = await this.db.update(publishedAgentApiKeys)
      .set({ isRevoked: true })
      .where(eq(publishedAgentApiKeys.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(publishedAgentApiKeys)
      .where(eq(publishedAgentApiKeys.id, id));
  }

  private mapToEntity(row: typeof publishedAgentApiKeys.$inferSelect): PublishedAgentApiKey {
    return {
      id: row.id,
      publishedAgentId: row.publishedAgentId,
      name: row.name,
      keyHash: row.keyHash,
      keyPrefix: row.keyPrefix,
      scopes: (row.scopes ?? ['task:execute', 'skill:execute']) as ApiKeyScope[],
      lastUsedAt: row.lastUsedAt,
      usageCount: row.usageCount,
      expiresAt: row.expiresAt,
      isRevoked: row.isRevoked,
      createdAt: row.createdAt,
    };
  }
}
