// AIDEV-NOTE: Repository interface for RAG query logs
// Defines analytics and search logging data access patterns

import { RagIndexId, SearchQuery } from '../value-objects';

export interface QueryLogEntry {
  id: string;
  indexId: RagIndexId;
  organizationId?: number;
  query: string;
  queryEmbedding: number[];
  resultsCount: number;
  topResults?: any[];
  userId?: string;
  agentId?: number;
  sessionId?: string;
  similarityMetric: string;
  threshold: number;
  createdAt: Date;
}

export interface QueryAnalytics {
  totalQueries: number;
  averageResults: number;
  topQueries: Array<{ query: string; count: number }>;
  searchVolume: Array<{ date: string; count: number }>;
}

export interface RagQueryLogRepository {
  /**
   * Log a search query for analytics
   */
  logQuery(params: {
    indexId: RagIndexId;
    query: SearchQuery;
    queryEmbedding: number[];
    resultCount: number;
    userId?: string;
    agentId?: number;
    sessionId?: string;
  }): Promise<void>;

  /**
   * Get search analytics for an index
   */
  getAnalytics(
    indexId: RagIndexId, 
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<QueryAnalytics>;

  /**
   * Get total query count for an index
   */
  getTotalQueryCount(
    indexId: RagIndexId, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<number>;

  /**
   * Get average result count for an index
   */
  getAverageResultCount(
    indexId: RagIndexId, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<number>;

  /**
   * Clear old query logs for data retention
   */
  clearOldLogs(olderThanDays: number): Promise<number>;

  /**
   * Get recent queries for an index
   */
  getRecentQueries(
    indexId: RagIndexId, 
    limit?: number
  ): Promise<QueryLogEntry[]>;
}