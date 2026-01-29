/**
 * Drizzle Published Agent Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { publishedAgents } from '@/ddd/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  IPublishedAgentRepository,
  CreatePublishedAgentData,
  UpdatePublishedAgentData,
} from '@/ddd/domain/published-agents/interfaces/published-agent-repository';
import type {
  PublishedAgent,
  PublishedAgentFilters,
  PublicationStatus,
  PublishedAgentIntegrations,
  SecurityGrade,
  BillingMode,
} from '@/ddd/domain/published-agents/types';

export class DrizzlePublishedAgentRepository implements IPublishedAgentRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreatePublishedAgentData): Promise<PublishedAgent> {
    const [result] = await this.db.insert(publishedAgents).values({
      agentId: data.agentId,
      organizationId: data.organizationId,
      slug: data.slug,
      displayName: data.displayName,
      description: data.description ?? null,
      minSecurityGrade: data.minSecurityGrade ?? 'B',
      allowTaskMode: data.allowTaskMode ?? true,
      allowSkillMode: data.allowSkillMode ?? true,
      status: 'draft',
    }).returning();

    return this.mapToEntity(result);
  }

  async findById(id: number): Promise<PublishedAgent | null> {
    const [result] = await this.db.select()
      .from(publishedAgents)
      .where(eq(publishedAgents.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findBySlug(organizationId: number, slug: string): Promise<PublishedAgent | null> {
    const [result] = await this.db.select()
      .from(publishedAgents)
      .where(and(
        eq(publishedAgents.organizationId, organizationId),
        eq(publishedAgents.slug, slug)
      ));

    return result ? this.mapToEntity(result) : null;
  }

  async findByAgentId(agentId: number): Promise<PublishedAgent | null> {
    const [result] = await this.db.select()
      .from(publishedAgents)
      .where(eq(publishedAgents.agentId, agentId));

    return result ? this.mapToEntity(result) : null;
  }

  async findByOrganization(
    organizationId: number,
    filters?: PublishedAgentFilters
  ): Promise<PublishedAgent[]> {
    const conditions = [eq(publishedAgents.organizationId, organizationId)];

    if (filters?.status) {
      conditions.push(eq(publishedAgents.status, filters.status));
    }
    if (filters?.agentId) {
      conditions.push(eq(publishedAgents.agentId, filters.agentId));
    }

    const results = await this.db.select()
      .from(publishedAgents)
      .where(and(...conditions));

    return results.map((r: typeof publishedAgents.$inferSelect) => this.mapToEntity(r));
  }

  async update(id: number, data: UpdatePublishedAgentData): Promise<PublishedAgent> {
    const updateData: Partial<typeof publishedAgents.$inferInsert> = {};

    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.minSecurityGrade !== undefined) updateData.minSecurityGrade = data.minSecurityGrade;
    if (data.allowTaskMode !== undefined) updateData.allowTaskMode = data.allowTaskMode;
    if (data.allowSkillMode !== undefined) updateData.allowSkillMode = data.allowSkillMode;
    if (data.billingMode !== undefined) updateData.billingMode = data.billingMode;
    if (data.rateLimitPerMinute !== undefined) updateData.rateLimitPerMinute = data.rateLimitPerMinute;
    if (data.rateLimitPerDay !== undefined) updateData.rateLimitPerDay = data.rateLimitPerDay;
    if (data.integrations !== undefined) updateData.integrations = data.integrations;

    updateData.updatedAt = new Date();

    const [result] = await this.db.update(publishedAgents)
      .set(updateData)
      .where(eq(publishedAgents.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async updateStatus(
    id: number,
    status: PublicationStatus,
    metadata?: {
      publishedAt?: Date;
      publishedBy?: string;
      securityApprovedAt?: Date;
      securityApprovedBy?: string;
      latestSecurityReportId?: number;
    }
  ): Promise<PublishedAgent> {
    const updateData: Partial<typeof publishedAgents.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    if (metadata?.publishedAt) updateData.publishedAt = metadata.publishedAt;
    if (metadata?.publishedBy) updateData.publishedBy = metadata.publishedBy;
    if (metadata?.securityApprovedAt) updateData.securityApprovedAt = metadata.securityApprovedAt;
    if (metadata?.securityApprovedBy) updateData.securityApprovedBy = metadata.securityApprovedBy;
    if (metadata?.latestSecurityReportId) updateData.latestSecurityReportId = metadata.latestSecurityReportId;

    const [result] = await this.db.update(publishedAgents)
      .set(updateData)
      .where(eq(publishedAgents.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(publishedAgents)
      .where(eq(publishedAgents.id, id));
  }

  private mapToEntity(row: typeof publishedAgents.$inferSelect): PublishedAgent {
    return {
      id: row.id,
      agentId: row.agentId,
      organizationId: row.organizationId,
      slug: row.slug,
      displayName: row.displayName,
      description: row.description,
      status: row.status as PublicationStatus,
      publishedAt: row.publishedAt,
      publishedBy: row.publishedBy,
      latestSecurityReportId: row.latestSecurityReportId,
      securityApprovedAt: row.securityApprovedAt,
      securityApprovedBy: row.securityApprovedBy,
      minSecurityGrade: row.minSecurityGrade as SecurityGrade,
      allowTaskMode: row.allowTaskMode,
      allowSkillMode: row.allowSkillMode,
      billingMode: row.billingMode as BillingMode,
      rateLimitPerMinute: row.rateLimitPerMinute,
      rateLimitPerDay: row.rateLimitPerDay,
      integrations: (row.integrations ?? {}) as PublishedAgentIntegrations,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
