// AIDEV-NOTE: Application service for RAG search operations
// Orchestrates search domain services and manages performance monitoring

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
import { RagIndexId } from '@/ddd/domain/rag/value-objects';

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
    try {
      SearchRagQueryValidator.validate(query);
    } catch (error) {
      return ResultHelpers.failure(`${error instanceof Error ? error.message : String(error)}`);
    }

    const { indexId, searchQuery, sourceTypes, context } = SearchRagQueryValidator.toDomainParams(query);
    const startTime = Date.now();

    try {
      // Verify index exists and is active
      const index = await this.indexRepository.findById(indexId);
      if (!index) {
        throw new Error(`Index ${indexId.value} not found`);
      }

      if (index.status !== 'active') {
        throw new Error(`Index ${index.name} is not active (status: ${index.status})`);
      }

      // Prepare search query with embeddings
      const { queryEmbedding } = await this.searchDomainService.prepareSearchQuery(searchQuery);

      // Perform vector search
      const vectorSearchParams: VectorSearchParams = {
        indexId,
        queryEmbedding,
        limit: searchQuery.limit * 2, // Get more results for filtering
        threshold: 0, // Apply threshold in domain service instead
        similarityMetric: searchQuery.similarityMetric
      };

      const vectorResult = await this.documentRepository.vectorSearch(vectorSearchParams);

      // Apply domain filters and ranking
      const searchFilters: SearchFilters = {
        domainTypes: sourceTypes
      };

      const filteredDocuments = this.searchDomainService.filterAndRankResults(
        vectorResult.documents,
        searchQuery,
        searchFilters as any
      );

      const searchTime = Date.now() - startTime;

      // Log search for analytics
      if (this.searchLogger) {
        await this.searchDomainService.logSearchAnalytics(
          indexId,
          searchQuery,
          filteredDocuments.length,
          searchTime,
          context
        );
      }
      console.log(`[RAG-SEARCH-APP] Search completed in ${searchTime}ms: "${searchQuery.text.substring(0, 50)}..." → ${filteredDocuments.length} results`);

      return ResultHelpers.success({
        documents: filteredDocuments.map(doc => doc.toSearchResult()),
        totalCount: filteredDocuments.length,
        query: searchQuery.text,
        searchTime,
        indexName: index.name
      });

    } catch (error) {
      const searchTime = Date.now() - startTime;
      console.error(`[RAG-SEARCH-APP] Search failed after ${searchTime}ms:`, error);

      return ResultHelpers.failure(`${error instanceof Error ? error.message : String(error)}`);
    }
  }
}