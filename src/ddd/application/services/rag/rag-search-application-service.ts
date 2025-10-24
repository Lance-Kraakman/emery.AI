// AIDEV-NOTE: Application service for RAG search operations
// Orchestrates search domain services and manages performance monitoring

import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { RagIndexRepository } from '@/ddd/domain/rag/repositories/rag-index-repository';
import type { RagDocumentRepository } from '@/ddd/domain/rag/repositories/rag-document-repository';
import type { VectorSearchParams } from '@/ddd/domain/rag/repositories/rag-document-repository';
import { 
  SearchDomainService, 
  type EmbeddingGenerator,
  type SearchLogger 
} from '@/ddd/domain/rag/services';

// Define inline until exported from services
interface SearchFilters {
  indexId?: string;
  domainTypes?: string[];
  dateRange?: { from: Date; to: Date };
}

import { 
  type SearchRagQuery, 
  SearchRagQueryValidator 
} from '@/ddd/application/services/rag/queries';
import { Result, ResultHelpers } from '@/ddd/domain/shared';

export interface SearchResult {
  documents: Array<{
    id: string;
    indexId: string;
    sourceId: string;
    domainType: string;
    sourceName: string;
    title: string;
    content: string;
    metadata: Record<string, any>;
    similarity?: number;
  }>;
  totalCount: number;
  query: string;
  searchTime: number;
  indexName?: string;
}

const logger = createDebugLogger('RagSearch');

export class RagSearchApplicationService {
  constructor(
    private readonly indexRepository: RagIndexRepository,
    private readonly documentRepository: RagDocumentRepository,
    private readonly searchDomainService: SearchDomainService,
    private readonly embeddingGenerator: EmbeddingGenerator,
    private readonly searchLogger?: SearchLogger
  ) {}

  /**
   * Perform vector similarity search
   */
  async search(query: SearchRagQuery): Promise<Result<SearchResult>> {
    logger.summary('Starting search operation');
    logger.debug('Raw query:', query);

    try {
      SearchRagQueryValidator.validate(query);
      logger.debug('Query validation passed');
    } catch (error) {
      logger.error('Query validation failed', error);
      return ResultHelpers.failure(`${error instanceof Error ? error.message : String(error)}`);
    }

    const { indexId, searchQuery, sourceTypes, context } = SearchRagQueryValidator.toDomainParams(query);
    logger.debug(`Parsed query`, { indexId: indexId.value, text: searchQuery.text.substring(0, 50), limit: searchQuery.limit });
    logger.debug(`Source types: ${sourceTypes?.join(', ') || 'none'}`);

    const startTime = Date.now();

    try {
      // Verify index exists and is active
      logger.debug(`Looking up index: ${indexId.value}`);
      const index = await this.indexRepository.findById(indexId);
      if (!index) {
        logger.error(`Index not found: ${indexId.value}`);
        throw new Error(`Index ${indexId.value} not found`);
      }

      logger.debug(`Found index: "${index.name}" (status: ${index.status})`);

      if (index.status !== 'active') {
        logger.error(`Index not active: ${index.status}`);
        throw new Error(`Index ${index.name} is not active (status: ${index.status})`);
      }

      // Prepare search query with embeddings
      logger.debug('Preparing search query (generating embeddings)');
      const embeddingStartTime = Date.now();

      // AIDEV-NOTE: Use shorter timeout for RAG context to avoid blocking chat
      const { queryEmbedding } = await this.searchDomainService.prepareSearchQuery(searchQuery, { timeout: 8000 });

      const embeddingTime = Date.now() - embeddingStartTime;
      logger.debug(`Query embedding generated`, { time: `${embeddingTime}ms`, dimensions: queryEmbedding.length });

      // Perform vector search
      const vectorSearchParams: VectorSearchParams = {
        indexId,
        queryEmbedding,
        limit: searchQuery.limit * 2, // Get more results for filtering
        threshold: 0, // Apply threshold in domain service instead
        similarityMetric: searchQuery.similarityMetric
      };

      logger.debug('Performing vector search', {
        indexId: indexId.value,
        embeddingDimensions: queryEmbedding.length,
        limit: vectorSearchParams.limit,
        threshold: vectorSearchParams.threshold,
        similarityMetric: vectorSearchParams.similarityMetric
      });

      const vectorSearchStartTime = Date.now();
      const vectorResult = await this.documentRepository.vectorSearch(vectorSearchParams);
      const vectorSearchTime = Date.now() - vectorSearchStartTime;

      logger.debug(`Vector search completed`, { time: `${vectorSearchTime}ms`, found: vectorResult.documents.length });

      // Apply domain filters and ranking
      const searchFilters: SearchFilters = {
        domainTypes: sourceTypes
      };

      logger.debug('Filtering and ranking results');
      const filterStartTime = Date.now();

      const filteredDocuments = this.searchDomainService.filterAndRankResults(
        vectorResult.documents,
        searchQuery,
        searchFilters as any
      );

      const filterTime = Date.now() - filterStartTime;
      logger.debug(`Filtering completed`, { time: `${filterTime}ms`, filtered: filteredDocuments.length });

      const searchTime = Date.now() - startTime;

      // Log search for analytics
      if (this.searchLogger) {
        logger.debug('Logging search analytics');
        await this.searchDomainService.logSearchAnalytics(
          indexId,
          searchQuery,
          queryEmbedding,
          filteredDocuments.length,
          searchTime,
          context
        );
      }

      logger.summary('Search completed', {
        time: `${searchTime}ms`,
        results: filteredDocuments.length,
        query: searchQuery.text.substring(0, 50)
      });
      logger.debug(`Performance breakdown`, {
        embedding: `${embeddingTime}ms`,
        vector: `${vectorSearchTime}ms`,
        filter: `${filterTime}ms`
      });

      return ResultHelpers.success({
        documents: filteredDocuments.map(doc => doc.toSearchResult()),
        totalCount: filteredDocuments.length,
        query: searchQuery.text,
        searchTime,
        indexName: index.name
      });

    } catch (error) {
      const searchTime = Date.now() - startTime;
      logger.error(`Search failed after ${searchTime}ms`, error);

      if (error instanceof Error) {
        logger.error(`Error type: ${error.constructor.name}, message: ${error.message}`);
        if (error.stack) {
          logger.debug(`Stack trace (first 3 lines): ${error.stack.split('\n').slice(0, 3).join(' | ')}`);
        }
      }

      return ResultHelpers.failure(`${error instanceof Error ? error.message : String(error)}`);
    }
  }
}