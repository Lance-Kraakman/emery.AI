/**
 * Drizzle Published Agent OAuth Client Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { publishedAgentOauthClients } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import type {
  IPublishedAgentOAuthClientRepository,
  CreateOAuthClientData,
} from '@/ddd/domain/published-agents/interfaces/published-agent-repository';
import type { PublishedAgentOAuthClient } from '@/ddd/domain/published-agents/types';

export class DrizzlePublishedAgentOAuthClientRepository implements IPublishedAgentOAuthClientRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateOAuthClientData): Promise<PublishedAgentOAuthClient> {
    const [result] = await this.db.insert(publishedAgentOauthClients).values({
      publishedAgentId: data.publishedAgentId,
      clientId: data.clientId,
      clientSecretHash: data.clientSecretHash,
      name: data.name,
      redirectUris: data.redirectUris ?? [],
      allowedScopes: data.allowedScopes ?? ['task:execute', 'skill:execute'],
    }).returning();

    return this.mapToEntity(result);
  }

  async findById(id: number): Promise<PublishedAgentOAuthClient | null> {
    const [result] = await this.db.select()
      .from(publishedAgentOauthClients)
      .where(eq(publishedAgentOauthClients.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findByClientId(clientId: string): Promise<PublishedAgentOAuthClient | null> {
    const [result] = await this.db.select()
      .from(publishedAgentOauthClients)
      .where(eq(publishedAgentOauthClients.clientId, clientId));

    return result ? this.mapToEntity(result) : null;
  }

  async findByPublishedAgentId(publishedAgentId: number): Promise<PublishedAgentOAuthClient[]> {
    const results = await this.db.select()
      .from(publishedAgentOauthClients)
      .where(eq(publishedAgentOauthClients.publishedAgentId, publishedAgentId));

    return results.map((r: typeof publishedAgentOauthClients.$inferSelect) => this.mapToEntity(r));
  }

  async recordUsage(id: number): Promise<void> {
    await this.db.update(publishedAgentOauthClients)
      .set({ lastUsedAt: new Date() })
      .where(eq(publishedAgentOauthClients.id, id));
  }

  async deactivate(id: number): Promise<PublishedAgentOAuthClient> {
    const [result] = await this.db.update(publishedAgentOauthClients)
      .set({ isActive: false })
      .where(eq(publishedAgentOauthClients.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(publishedAgentOauthClients)
      .where(eq(publishedAgentOauthClients.id, id));
  }

  private mapToEntity(row: typeof publishedAgentOauthClients.$inferSelect): PublishedAgentOAuthClient {
    return {
      id: row.id,
      publishedAgentId: row.publishedAgentId,
      clientId: row.clientId,
      clientSecretHash: row.clientSecretHash,
      name: row.name,
      redirectUris: (row.redirectUris ?? []) as string[],
      allowedScopes: (row.allowedScopes ?? ['task:execute', 'skill:execute']) as string[],
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    };
  }
}
