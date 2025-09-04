// AIDEV-NOTE: Query for RAG search operations
// Encapsulates search input validation and query data

import { RagIndexId, SearchQuery, type SimilarityMetric } from '@/ddd/domain/rag/value-objects';

export interface SearchRagQuery {
  indexId: string;
  query: string;
  limit?: number;
  threshold?: number;
  similarityMetric?: SimilarityMetric;
  sourceTypes?: string[];
  organizationId?: number;  // Organization scoping for RAG queries
  userId?: string;
  agentId?: number;
  sessionId?: string;
}

export class SearchRagQueryValidator {
  static validate(query: SearchRagQuery): void {
    if (!query.indexId || query.indexId.trim().length === 0) {
      throw new Error('Index ID is required');
    }

    try {
      RagIndexId.fromString(query.indexId);
    } catch (error) {
      throw new Error('Invalid index ID format');
    }

    if (!query.query || query.query.trim().length === 0) {
      throw new Error('Search query text is required');
    }

    if (query.query.length > 1000) {
      throw new Error('Search query cannot exceed 1000 characters');
    }

    if (query.limit !== undefined) {
      if (!Number.isInteger(query.limit) || query.limit <= 0 || query.limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }
    }

    if (query.threshold !== undefined) {
      if (typeof query.threshold !== 'number' || query.threshold < 0 || query.threshold > 1) {
        throw new Error('Threshold must be between 0 and 1');
      }
    }

    if (query.similarityMetric !== undefined) {
      const validMetrics: SimilarityMetric[] = ['cosine', 'euclidean', 'inner_product'];
      if (!validMetrics.includes(query.similarityMetric)) {
        throw new Error(`Invalid similarity metric: ${query.similarityMetric}`);
      }
    }

    if (query.sourceTypes !== undefined) {
      if (!Array.isArray(query.sourceTypes)) {
        throw new Error('Source types must be an array');
      }

      const validSourceTypes = ['tables', 'files', 'agents', 'teams', 'organizations', 'databases'];
      for (const sourceType of query.sourceTypes) {
        if (!validSourceTypes.includes(sourceType)) {
          throw new Error(`Invalid source type: ${sourceType}`);
        }
      }
    }

    if (query.agentId !== undefined && (!Number.isInteger(query.agentId) || query.agentId <= 0)) {
      throw new Error('Agent ID must be a positive integer');
    }
  }

  static toDomainParams(query: SearchRagQuery) {
    return {
      indexId: RagIndexId.fromString(query.indexId),
      searchQuery: SearchQuery.create(query.query.trim(), {
        limit: query.limit,
        threshold: query.threshold,
        similarityMetric: query.similarityMetric
      }),
      sourceTypes: query.sourceTypes,
      context: {
        userId: query.userId,
        agentId: query.agentId,
        sessionId: query.sessionId
      }
    };
  }
}