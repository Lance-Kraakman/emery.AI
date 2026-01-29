/**
 * Drizzle Published Agent Usage Log Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { publishedAgentUsageLogs } from '@/ddd/infrastructure/db/schema';
import { eq, and, gte, lte, desc, lt, sql } from 'drizzle-orm';
import type {
  IPublishedAgentUsageLogRepository,
  CreateUsageLogData,
} from '@/ddd/domain/published-agents/interfaces/published-agent-repository';
import type { PublishedAgentUsageLog, UsageLogFilters } from '@/ddd/domain/published-agents/types';

export class DrizzlePublishedAgentUsageLogRepository implements IPublishedAgentUsageLogRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateUsageLogData): Promise<PublishedAgentUsageLog> {
    const [result] = await this.db.insert(publishedAgentUsageLogs).values({
      publishedAgentId: data.publishedAgentId,
      apiKeyId: data.apiKeyId ?? null,
      requestType: data.requestType,
      skillName: data.skillName ?? null,
      statusCode: data.statusCode,
      responseTimeMs: data.responseTimeMs,
      clientIp: data.clientIp ?? null,
      userAgent: data.userAgent ?? null,
    }).returning();

    return this.mapToEntity(result);
  }

  async findByPublishedAgentId(
    publishedAgentId: number,
    filters?: UsageLogFilters
  ): Promise<PublishedAgentUsageLog[]> {
    const conditions = [eq(publishedAgentUsageLogs.publishedAgentId, publishedAgentId)];

    if (filters?.requestType) {
      conditions.push(eq(publishedAgentUsageLogs.requestType, filters.requestType));
    }
    if (filters?.startDate) {
      conditions.push(gte(publishedAgentUsageLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(publishedAgentUsageLogs.createdAt, filters.endDate));
    }

    const results = await this.db.select()
      .from(publishedAgentUsageLogs)
      .where(and(...conditions))
      .orderBy(desc(publishedAgentUsageLogs.createdAt))
      .limit(filters?.limit ?? 100);

    return results.map((r: typeof publishedAgentUsageLogs.$inferSelect) => this.mapToEntity(r));
  }

  async getUsageStats(
    publishedAgentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRequests: number;
    taskRequests: number;
    skillRequests: number;
    avgResponseTimeMs: number;
    errorCount: number;
  }> {
    const result = await this.db.select({
      totalRequests: sql<number>`count(*)::int`,
      taskRequests: sql<number>`count(*) filter (where ${publishedAgentUsageLogs.requestType} = 'task')::int`,
      skillRequests: sql<number>`count(*) filter (where ${publishedAgentUsageLogs.requestType} = 'skill')::int`,
      avgResponseTimeMs: sql<number>`coalesce(avg(${publishedAgentUsageLogs.responseTimeMs})::int, 0)`,
      errorCount: sql<number>`count(*) filter (where ${publishedAgentUsageLogs.statusCode} >= 400)::int`,
    })
      .from(publishedAgentUsageLogs)
      .where(and(
        eq(publishedAgentUsageLogs.publishedAgentId, publishedAgentId),
        gte(publishedAgentUsageLogs.createdAt, startDate),
        lte(publishedAgentUsageLogs.createdAt, endDate)
      ));

    return result[0] ?? {
      totalRequests: 0,
      taskRequests: 0,
      skillRequests: 0,
      avgResponseTimeMs: 0,
      errorCount: 0,
    };
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.db.delete(publishedAgentUsageLogs)
      .where(lt(publishedAgentUsageLogs.createdAt, date))
      .returning({ id: publishedAgentUsageLogs.id });

    return result.length;
  }

  private mapToEntity(row: typeof publishedAgentUsageLogs.$inferSelect): PublishedAgentUsageLog {
    return {
      id: row.id,
      publishedAgentId: row.publishedAgentId,
      apiKeyId: row.apiKeyId,
      requestType: row.requestType as 'task' | 'skill',
      skillName: row.skillName,
      statusCode: row.statusCode,
      responseTimeMs: row.responseTimeMs,
      clientIp: row.clientIp,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }
}
