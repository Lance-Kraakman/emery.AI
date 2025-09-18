// AIDEV-NOTE: Search analytics service implementation
// Provides search logging and analytics using repository pattern

import { type SearchLogger } from '@/src/ddd/domain/rag/services';
import type { RagQueryLogRepository } from '@/src/ddd/domain/rag/repositories/rag-query-log-repository';
import { RagIndexId, SearchQuery } from '@/src/ddd/domain/rag/value-objects';

export class SearchAnalyticsService implements SearchLogger {
  constructor(private readonly queryLogRepository: RagQueryLogRepository) {}

  async logQuery(params: {
    indexId: RagIndexId;
    query: SearchQuery;
    queryEmbedding: number[];
    resultCount: number;
    searchTime: number;
    userId?: string;
    agentId?: number;
    sessionId?: string;
  }): Promise<void> {
    try {
      // AIDEV-NOTE: Query embeddings are not stored in analytics logs to avoid dimension issues
      await this.queryLogRepository.logQuery({
        indexId: params.indexId,
        query: params.query,
        queryEmbedding: params.queryEmbedding, // Passed through but ignored by repository
        resultCount: params.resultCount,
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId
      });

      console.log(`[SEARCH-SERVICE] Logged search query for index ${params.indexId.value.substring(0, 8)}: "${params.query.text.substring(0, 50)}..."`);
    } catch (error) {
      console.error('[SEARCH-SERVICE] Failed to log search query:', error);
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
      return await this.queryLogRepository.getAnalytics(indexId, options);
    } catch (error) {
      console.error('[SEARCH-SERVICE] Failed to get search analytics:', error);
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
      const deletedCount = await this.queryLogRepository.clearOldLogs(olderThanDays);
      console.log(`[SEARCH-SERVICE] Cleared ${deletedCount} search logs older than ${olderThanDays} days`);
      return deletedCount;
    } catch (error) {
      console.error('[SEARCH-SERVICE] Failed to clear old logs:', error);
      return 0;
    }
  }

  /**
   * Get recent queries for debugging/monitoring
   */
  async getRecentQueries(indexId: RagIndexId, limit: number = 50): Promise<Array<{
    query: string;
    resultCount: number;
    timestamp: Date;
    userId?: string;
  }>> {
    try {
      const entries = await this.queryLogRepository.getRecentQueries(indexId, limit);
      
      return entries.map(entry => ({
        query: entry.query,
        resultCount: entry.resultsCount,
        timestamp: entry.createdAt,
        userId: entry.userId
      }));
    } catch (error) {
      console.error('[SEARCH-SERVICE] Failed to get recent queries:', error);
      return [];
    }
  }
}