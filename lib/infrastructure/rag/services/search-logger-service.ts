// AIDEV-NOTE: Search logging service implementation
// Provides analytics logging for RAG search queries

import { db } from '@/lib/db/client';
import { ragQueryLogs } from '@/lib/db/schema';
import { type SearchLogger } from '@/lib/domain/rag/services';
import { RagIndexId, SearchQuery } from '@/lib/domain/rag/value-objects';

export class DrizzleSearchLoggerService implements SearchLogger {
  async logQuery(params: {
    indexId: RagIndexId;
    query: SearchQuery;
    resultCount: number;
    searchTime: number;
    userId?: string;
    agentId?: number;
    sessionId?: string;
  }): Promise<void> {
    try {
      // Generate embedding for the query for analytics
      const queryEmbedding = await this.generateQueryEmbedding(params.query.text);

      await db.insert(ragQueryLogs).values({
        ragIndexId: params.indexId.value,
        query: params.query.text,
        queryEmbedding: JSON.stringify(queryEmbedding), // Convert for pgvector
        resultsCount: params.resultCount,
        topResults: null, // Could store top results if needed for analytics
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId,
        similarityMetric: params.query.similarityMetric,
        threshold: Math.round(params.query.threshold * 100), // Store as integer percentage
        createdAt: new Date()
      });

      console.log(`[SEARCH-LOGGER] Logged search query for index ${params.indexId.value.substring(0, 8)}: "${params.query.text.substring(0, 50)}..."`);
    } catch (error) {
      console.error('[SEARCH-LOGGER] Failed to log search query:', error);
      // Don't throw - logging failure shouldn't break search functionality
    }
  }

  /**
   * Get search analytics for an index
   */
  async getSearchAnalytics(indexId: RagIndexId, options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<{
    totalQueries: number;
    averageResults: number;
    topQueries: Array<{ query: string; count: number }>;
    searchVolume: Array<{ date: string; count: number }>;
  }> {
    try {
      // This is a placeholder implementation
      // In a real system, you'd implement comprehensive analytics queries
      
      const totalQueries = await this.getTotalQueryCount(indexId, options?.startDate, options?.endDate);
      const averageResults = await this.getAverageResultCount(indexId, options?.startDate, options?.endDate);
      
      return {
        totalQueries,
        averageResults,
        topQueries: [], // TODO: Implement top queries aggregation
        searchVolume: [] // TODO: Implement search volume over time
      };
    } catch (error) {
      console.error('[SEARCH-LOGGER] Failed to get search analytics:', error);
      return {
        totalQueries: 0,
        averageResults: 0,
        topQueries: [],
        searchVolume: []
      };
    }
  }

  /**
   * Clear old search logs (for data retention)
   */
  async clearOldLogs(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db
        .delete(ragQueryLogs)
        .where(sql`created_at < ${cutoffDate}`)
        .returning({ id: ragQueryLogs.id });

      const deletedCount = result.length;
      console.log(`[SEARCH-LOGGER] Cleared ${deletedCount} search logs older than ${olderThanDays} days`);
      
      return deletedCount;
    } catch (error) {
      console.error('[SEARCH-LOGGER] Failed to clear old logs:', error);
      return 0;
    }
  }

  // Private helper methods
  private async generateQueryEmbedding(queryText: string): Promise<number[]> {
    // For now, return empty array since embedding generation requires additional setup
    // In a full implementation, this would use the same embedding service as the main search
    return [];
  }

  private async getTotalQueryCount(indexId: RagIndexId, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      const conditions = [eq(ragQueryLogs.ragIndexId, indexId.value)];
      
      if (startDate) {
        conditions.push(sql`created_at >= ${startDate}`);
      }
      
      if (endDate) {
        conditions.push(sql`created_at <= ${endDate}`);
      }

      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ragQueryLogs)
        .where(and(...conditions));

      return result.count;
    } catch (error) {
      console.error('[SEARCH-LOGGER] Failed to get total query count:', error);
      return 0;
    }
  }

  private async getAverageResultCount(indexId: RagIndexId, startDate?: Date, endDate?: Date): Promise<number> {
    try {
      const conditions = [eq(ragQueryLogs.ragIndexId, indexId.value)];
      
      if (startDate) {
        conditions.push(sql`created_at >= ${startDate}`);
      }
      
      if (endDate) {
        conditions.push(sql`created_at <= ${endDate}`);
      }

      const [result] = await db
        .select({ average: sql<number>`avg(results_count)` })
        .from(ragQueryLogs)
        .where(and(...conditions));

      return Math.round(result.average || 0);
    } catch (error) {
      console.error('[SEARCH-LOGGER] Failed to get average result count:', error);
      return 0;
    }
  }
}

// Import required SQL functions
import { eq, and, sql } from 'drizzle-orm';