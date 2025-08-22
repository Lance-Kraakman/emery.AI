// AIDEV-NOTE: Application service for RAG search operations
// Orchestrates search domain services and manages performance monitoring

import { 
  type RagIndexRepository, 
  type RagDocumentRepository,
  type VectorSearchParams
} from '@/ddd/domain/rag/repositories';
import { 
  SearchDomainService, 
  type SearchFilters,
  type EmbeddingGenerator,
  type SearchLogger 
} from '@/ddd/domain/rag/services';
import { RagIndexId } from '@/ddd/domain/rag/value-objects';

import { 
  type SearchRagQuery, 
  SearchRagQueryValidator 
} from '@/ddd/application/rag/queries';

export interface SearchResult {
  documents: Array<{
    id: string;
    indexId: string;
    sourceId: string;
    sourceType: string;
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
        sourceTypes,
        minSimilarity: searchQuery.threshold,
        maxResults: searchQuery.limit
      };

      const filteredDocuments = this.searchDomainService.filterAndRankResults(
        vectorResult.documents,
        searchQuery,
        searchFilters
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

  /**
   * Get search suggestions based on existing queries
   */
  async getSearchSuggestions(indexId: string, partialQuery: string): Promise<string[]> {
    try {
      const ragIndexId = RagIndexId.fromString(indexId);
      
      // This is a placeholder implementation
      // In a real system, you'd implement query suggestion logic
      // based on historical search data or content analysis
      
      return [];
    } catch (error) {
      console.error('[RAG-SEARCH-APP] Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Get search analytics for an index
   */
  async getSearchAnalytics(indexId: string, options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalQueries: number;
    averageResults: number;
    averageSearchTime: number;
    popularQueries: Array<{ query: string; count: number }>;
  }> {
    try {
      const ragIndexId = RagIndexId.fromString(indexId);
      
      // This would be implemented with actual analytics queries
      // For now, return placeholder data
      return {
        totalQueries: 0,
        averageResults: 0,
        averageSearchTime: 0,
        popularQueries: []
      };
    } catch (error) {
      console.error('[RAG-SEARCH-APP] Failed to get search analytics:', error);
      return {
        totalQueries: 0,
        averageResults: 0,
        averageSearchTime: 0,
        popularQueries: []
      };
    }
  }

  /**
   * Test search performance and quality
   */
  async testSearchQuality(indexId: string, testQueries: Array<{
    query: string;
    expectedSources: string[];
  }>): Promise<{
    overallScore: number;
    queryResults: Array<{
      query: string;
      score: number;
      foundSources: string[];
      missingSources: string[];
    }>;
  }> {
    try {
      const ragIndexId = RagIndexId.fromString(indexId);
      const results = [];
      let totalScore = 0;

      for (const testQuery of testQueries) {
        const searchResult = await this.search({
          indexId,
          query: testQuery.query,
          limit: 10
        });

        const foundSources = searchResult.documents.map(doc => doc.sourceId);
        const missingSources = testQuery.expectedSources.filter(
          expected => !foundSources.includes(expected)
        );

        // Simple scoring: % of expected sources found
        const score = (testQuery.expectedSources.length - missingSources.length) / testQuery.expectedSources.length;
        
        results.push({
          query: testQuery.query,
          score,
          foundSources,
          missingSources
        });

        totalScore += score;
      }

      return {
        overallScore: totalScore / testQueries.length,
        queryResults: results
      };
    } catch (error) {
      console.error('[RAG-SEARCH-APP] Failed to test search quality:', error);
      throw error;
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
      filteredDocuments = allDocuments.filter(doc => sourceTypes.includes(doc.sourceType));
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