// AIDEV-NOTE: Drizzle implementation of RagQueryLogRepository
// Provides query logging and analytics using existing schema

import { eq, and, sql, desc } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { DbClient } from '@/src/lib/db/client';
import { ragQueryLogs } from '@/src/lib/db/schema';


import { RagIndexId, SearchQuery } from '@/src/ddd/domain/rag/value-objects';
import { QueryAnalytics, QueryLogEntry, RagQueryLogRepository } from '@/src/ddd/domain/rag/repositories/rag-query-log-repository';

type RagQueryLogRow = InferSelectModel<typeof ragQueryLogs>;

export class DrizzleRagQueryLogRepository implements RagQueryLogRepository {
  constructor(private readonly db: DbClient) {}

  async logQuery(params: {
    indexId: RagIndexId;
    query: SearchQuery;
    queryEmbedding: number[];
    resultCount: number;
    userId?: string;
    agentId?: number;
    sessionId?: string;
  }): Promise<void> {
    try {
      await this.db.insert(ragQueryLogs).values({
        ragIndexId: params.indexId.value,
        query: params.query.text,
        queryEmbedding: null, // AIDEV-NOTE: Skip embeddings in analytics logs to avoid pgvector dimension issues
        resultsCount: params.resultCount,
        topResults: null, // Could store top results if needed for analytics
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId,
        similarityMetric: params.query.similarityMetric,
        threshold: Math.round(params.query.threshold * 100), // Store as integer percentage
        createdAt: new Date()
      });

      console.log(`[QUERY-LOG-REPO] Logged search query for index ${params.indexId.value.substring(0, 8)}: "${params.query.text.substring(0, 50)}..."`);
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to log search query:', error);
      // Don't throw - logging failure shouldn't break search functionality
    }
  }

  async getAnalytics(
    indexId: RagIndexId, 
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<QueryAnalytics> {
    try {
      const totalQueries = await this.getTotalQueryCount(indexId, options?.startDate, options?.endDate);
      const averageResults = await this.getAverageResultCount(indexId, options?.startDate, options?.endDate);
      
      // Get top queries (simplified implementation)
      const topQueriesResult = await this.getTopQueries(indexId, options?.limit || 10);
      
      return {
        totalQueries,
        averageResults,
        topQueries: topQueriesResult,
        searchVolume: [] // TODO: Implement search volume over time
      };
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to get analytics:', error);
      return {
        totalQueries: 0,
        averageResults: 0,
        topQueries: [],
        searchVolume: []
      };
    }
  }

  async getTotalQueryCount(
    indexId: RagIndexId, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<number> {
    try {
      const conditions = [eq(ragQueryLogs.ragIndexId, indexId.value)];
      
      if (startDate) {
        conditions.push(sql`created_at >= ${startDate}`);
      }
      
      if (endDate) {
        conditions.push(sql`created_at <= ${endDate}`);
      }

      const [result] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(ragQueryLogs)
        .where(and(...conditions));

      return result.count;
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to get total query count:', error);
      return 0;
    }
  }

  async getAverageResultCount(
    indexId: RagIndexId, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<number> {
    try {
      const conditions = [eq(ragQueryLogs.ragIndexId, indexId.value)];
      
      if (startDate) {
        conditions.push(sql`created_at >= ${startDate}`);
      }
      
      if (endDate) {
        conditions.push(sql`created_at <= ${endDate}`);
      }

      const [result] = await this.db
        .select({ average: sql<number>`avg(results_count)` })
        .from(ragQueryLogs)
        .where(and(...conditions));

      return Math.round(result.average || 0);
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to get average result count:', error);
      return 0;
    }
  }

  async clearOldLogs(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.db
        .delete(ragQueryLogs)
        .where(sql`created_at < ${cutoffDate}`)
        .returning({ id: ragQueryLogs.id });

      const deletedCount = result.length;
      console.log(`[QUERY-LOG-REPO] Cleared ${deletedCount} search logs older than ${olderThanDays} days`);
      
      return deletedCount;
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to clear old logs:', error);
      return 0;
    }
  }

  async getRecentQueries(
    indexId: RagIndexId, 
    limit: number = 50
  ): Promise<QueryLogEntry[]> {
    try {
      const records = await this.db
        .select()
        .from(ragQueryLogs)
        .where(eq(ragQueryLogs.ragIndexId, indexId.value))
        .orderBy(desc(ragQueryLogs.createdAt))
        .limit(limit);

      return records.map((record: RagQueryLogRow) => this.mapToDomainEntity(record));
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to get recent queries:', error);
      return [];
    }
  }

  // Private helper methods
  private async getTopQueries(indexId: RagIndexId, limit: number): Promise<Array<{ query: string; count: number }>> {
    try {
      const result = await this.db.execute(sql`
        SELECT query, COUNT(*) as count
        FROM rag_query_logs
        WHERE rag_index_id = ${indexId.value}
        GROUP BY query
        ORDER BY count DESC
        LIMIT ${limit}
      `);

      return result.map((row: any) => ({
        query: row.query,
        count: Number(row.count)
      }));
    } catch (error) {
      console.error('[QUERY-LOG-REPO] Failed to get top queries:', error);
      return [];
    }
  }

  private mapToDomainEntity(record: RagQueryLogRow): QueryLogEntry {
    return {
      id: record.id,
      indexId: RagIndexId.fromString(record.ragIndexId),
      organizationId: record.organizationId || undefined,
      query: record.query,
      queryEmbedding: typeof record.queryEmbedding === 'string'
        ? JSON.parse(record.queryEmbedding)
        : record.queryEmbedding || [],
      resultsCount: record.resultsCount,
      topResults: (record.topResults as any[]) || undefined,
      userId: record.userId || undefined,
      agentId: record.agentId || undefined,
      sessionId: record.sessionId || undefined,
      similarityMetric: record.similarityMetric || 'cosine',
      threshold: record.threshold || 0,
      createdAt: record.createdAt || new Date()
    };
  }
}