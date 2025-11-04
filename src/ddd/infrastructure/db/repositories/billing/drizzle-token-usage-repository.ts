/**
 * Drizzle Token Usage Repository Implementation
 *
 * Infrastructure implementation of token usage repository using Drizzle ORM.
 */
import { and, eq, gte, lte, desc, sql, sum, count, avg } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ITokenUsageRepository, UsageQueryFilters, UsageStatistics } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { TokenUsage, CreateTokenUsageData, EntityType } from '@/ddd/domain/billing/entities/token-usage';
import { TokenUsageId } from '@/ddd/domain/billing/value-objects/token-usage-id';
import { OrganizationId, UserId, AgentId } from '@/ddd/domain/shared/value-objects';
import { tokenUsageLogs, organizations } from '@/lib/db/schema';

export class DrizzleTokenUsageRepository implements ITokenUsageRepository {
  constructor(private readonly db: PostgresJsDatabase<Record<string, unknown>>) {}

  async create(data: CreateTokenUsageData): Promise<TokenUsage> {
    const [record] = await this.db
      .insert(tokenUsageLogs)
      .values({
        organizationId: data.organizationId.value,
        userId: data.userId?.value,
        entityType: data.entityType,
        entityId: data.entityId,
        agentId: data.agentId?.value,
        modelName: data.modelName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        costUsd: data.costUsd,
        processingTimeMs: data.processingTimeMs,
        metadata: data.metadata as any,
      })
      .returning();

    return this.toDomain(record);
  }

  async findById(id: TokenUsageId): Promise<TokenUsage | null> {
    const [record] = await this.db
      .select()
      .from(tokenUsageLogs)
      .where(eq(tokenUsageLogs.id, id.value))
      .limit(1);

    return record ? this.toDomain(record) : null;
  }

  async find(filters: UsageQueryFilters): Promise<TokenUsage[]> {
    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(tokenUsageLogs.organizationId, filters.organizationId.value));
    }
    if (filters.userId) {
      conditions.push(eq(tokenUsageLogs.userId, filters.userId.value));
    }
    if (filters.agentId) {
      conditions.push(eq(tokenUsageLogs.agentId, filters.agentId.value));
    }
    if (filters.entityType) {
      conditions.push(eq(tokenUsageLogs.entityType, filters.entityType));
    }
    if (filters.entityId) {
      conditions.push(eq(tokenUsageLogs.entityId, filters.entityId));
    }
    if (filters.modelName) {
      conditions.push(eq(tokenUsageLogs.modelName, filters.modelName));
    }
    if (filters.startDate) {
      conditions.push(gte(tokenUsageLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(tokenUsageLogs.createdAt, filters.endDate));
    }

    const query = this.db
      .select()
      .from(tokenUsageLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tokenUsageLogs.createdAt));

    if (filters.limit) {
      query.limit(filters.limit);
    }
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const records = await query;
    return records.map(record => this.toDomain(record));
  }

  async getOrganizationStatistics(
    organizationId: OrganizationId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatistics> {
    const conditions = [eq(tokenUsageLogs.organizationId, organizationId.value)];

    if (startDate) {
      conditions.push(gte(tokenUsageLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(tokenUsageLogs.createdAt, endDate));
    }

    // Get overall statistics
    const [overallStats] = await this.db
      .select({
        totalTokens: sum(tokenUsageLogs.totalTokens).mapWith(Number),
        inputTokens: sum(tokenUsageLogs.inputTokens).mapWith(Number),
        outputTokens: sum(tokenUsageLogs.outputTokens).mapWith(Number),
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
        executionCount: count(tokenUsageLogs.id).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions));

    // Get model breakdown
    const modelBreakdown = await this.db
      .select({
        modelName: tokenUsageLogs.modelName,
        totalTokens: sum(tokenUsageLogs.totalTokens).mapWith(Number),
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
        executionCount: count(tokenUsageLogs.id).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions))
      .groupBy(tokenUsageLogs.modelName);

    const totalTokens = overallStats.totalTokens || 0;
    const totalCost = overallStats.totalCost || 0;
    const executionCount = overallStats.executionCount || 0;

    return {
      totalTokens,
      inputTokens: overallStats.inputTokens || 0,
      outputTokens: overallStats.outputTokens || 0,
      totalCost,
      executionCount,
      averageTokensPerExecution: executionCount > 0 ? totalTokens / executionCount : 0,
      averageCostPerExecution: executionCount > 0 ? totalCost / executionCount : 0,
      modelBreakdown,
    };
  }

  async getCurrentMonthUsage(organizationId: OrganizationId): Promise<number> {
    const [org] = await this.db
      .select({ tokenUsageCurrentMonth: organizations.tokenUsageCurrentMonth })
      .from(organizations)
      .where(eq(organizations.id, organizationId.value))
      .limit(1);

    return org?.tokenUsageCurrentMonth || 0;
  }

  async updateOrganizationUsage(
    organizationId: OrganizationId,
    totalTokens: number
  ): Promise<void> {
    await this.db
      .update(organizations)
      .set({
        tokenUsageCurrentMonth: sql`${organizations.tokenUsageCurrentMonth} + ${totalTokens}`,
      })
      .where(eq(organizations.id, organizationId.value));
  }

  async getTotalCost(
    organizationId: OrganizationId,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const conditions = [eq(tokenUsageLogs.organizationId, organizationId.value)];

    if (startDate) {
      conditions.push(gte(tokenUsageLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(tokenUsageLogs.createdAt, endDate));
    }

    const [result] = await this.db
      .select({
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions));

    return result.totalCost || 0;
  }

  async getUserStatistics(
    userId: UserId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatistics> {
    const conditions = [eq(tokenUsageLogs.userId, userId.value)];

    if (startDate) {
      conditions.push(gte(tokenUsageLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(tokenUsageLogs.createdAt, endDate));
    }

    const [overallStats] = await this.db
      .select({
        totalTokens: sum(tokenUsageLogs.totalTokens).mapWith(Number),
        inputTokens: sum(tokenUsageLogs.inputTokens).mapWith(Number),
        outputTokens: sum(tokenUsageLogs.outputTokens).mapWith(Number),
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
        executionCount: count(tokenUsageLogs.id).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions));

    const modelBreakdown = await this.db
      .select({
        modelName: tokenUsageLogs.modelName,
        totalTokens: sum(tokenUsageLogs.totalTokens).mapWith(Number),
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
        executionCount: count(tokenUsageLogs.id).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions))
      .groupBy(tokenUsageLogs.modelName);

    const totalTokens = overallStats.totalTokens || 0;
    const totalCost = overallStats.totalCost || 0;
    const executionCount = overallStats.executionCount || 0;

    return {
      totalTokens,
      inputTokens: overallStats.inputTokens || 0,
      outputTokens: overallStats.outputTokens || 0,
      totalCost,
      executionCount,
      averageTokensPerExecution: executionCount > 0 ? totalTokens / executionCount : 0,
      averageCostPerExecution: executionCount > 0 ? totalCost / executionCount : 0,
      modelBreakdown,
    };
  }

  async getAgentStatistics(
    agentId: AgentId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatistics> {
    const conditions = [eq(tokenUsageLogs.agentId, agentId.value)];

    if (startDate) {
      conditions.push(gte(tokenUsageLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(tokenUsageLogs.createdAt, endDate));
    }

    const [overallStats] = await this.db
      .select({
        totalTokens: sum(tokenUsageLogs.totalTokens).mapWith(Number),
        inputTokens: sum(tokenUsageLogs.inputTokens).mapWith(Number),
        outputTokens: sum(tokenUsageLogs.outputTokens).mapWith(Number),
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
        executionCount: count(tokenUsageLogs.id).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions));

    const modelBreakdown = await this.db
      .select({
        modelName: tokenUsageLogs.modelName,
        totalTokens: sum(tokenUsageLogs.totalTokens).mapWith(Number),
        totalCost: sum(tokenUsageLogs.costUsd).mapWith(Number),
        executionCount: count(tokenUsageLogs.id).mapWith(Number),
      })
      .from(tokenUsageLogs)
      .where(and(...conditions))
      .groupBy(tokenUsageLogs.modelName);

    const totalTokens = overallStats.totalTokens || 0;
    const totalCost = overallStats.totalCost || 0;
    const executionCount = overallStats.executionCount || 0;

    return {
      totalTokens,
      inputTokens: overallStats.inputTokens || 0,
      outputTokens: overallStats.outputTokens || 0,
      totalCost,
      executionCount,
      averageTokensPerExecution: executionCount > 0 ? totalTokens / executionCount : 0,
      averageCostPerExecution: executionCount > 0 ? totalCost / executionCount : 0,
      modelBreakdown,
    };
  }

  private toDomain(record: any): TokenUsage {
    return {
      id: TokenUsageId.fromNumber(record.id),
      organizationId: OrganizationId.fromNumber(record.organizationId),
      userId: record.userId ? UserId.fromString(record.userId) : undefined,
      entityType: record.entityType as EntityType,
      entityId: record.entityId,
      agentId: record.agentId ? AgentId.fromNumber(record.agentId) : undefined,
      modelName: record.modelName,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      costUsd: record.costUsd,
      processingTimeMs: record.processingTimeMs,
      metadata: record.metadata,
      createdAt: record.createdAt,
    };
  }
}
