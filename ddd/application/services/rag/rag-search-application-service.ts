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
  async search(query: SearchRagQuery): Promise<SearchResult> {
    SearchRagQueryValidator.validate(query);

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

      return {
        documents: filteredDocuments.map(doc => doc.toSearchResult()),
        totalCount: filteredDocuments.length,
        query: searchQuery.text,
        searchTime,
        indexName: index.name
      };

    } catch (error) {
      const searchTime = Date.now() - startTime;
      console.error(`[RAG-SEARCH-APP] Search failed after ${searchTime}ms:`, error);

      // Try fallback text search if vector search fails
      try {
        return await this.fallbackTextSearch(indexId, searchQuery, sourceTypes, startTime);
      } catch (fallbackError) {
        console.error(`[RAG-SEARCH-APP] Fallback search also failed:`, fallbackError);
        throw error; // Throw original error
      }
    }
  }

  // Private helper methods
  private async fallbackTextSearch(
    indexId: RagIndexId,
    searchQuery: any,
    sourceTypes?: string[],
    startTime: number = Date.now()
  ): Promise<SearchResult> {
    console.log(`[RAG-SEARCH-APP] Attempting fallback text search for: "${searchQuery.text}"`);

    // Get all documents for the index
    const allDocuments = await this.documentRepository.findByIndexId(indexId);

    // Apply source type filter if specified
    let filteredDocuments = allDocuments;
    if (sourceTypes && sourceTypes.length > 0) {
      filteredDocuments = allDocuments.filter(doc => sourceTypes.includes(doc.domainType));
    }

    // Perform text-based search
    const textResults = this.searchDomainService.performTextSearch(filteredDocuments, searchQuery);

    const searchTime = Date.now() - startTime;

    console.log(`[RAG-SEARCH-APP] Fallback text search completed in ${searchTime}ms: ${textResults.length} results`);

    return {
      documents: textResults.map(doc => doc.toSearchResult()),
      totalCount: textResults.length,
      query: searchQuery.text,
      searchTime,
      indexName: 'Text Search Fallback'
    };
  }
}