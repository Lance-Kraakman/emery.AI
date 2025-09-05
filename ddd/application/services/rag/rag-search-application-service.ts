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
    console.log('[RAG-SEARCH-APP] 🔍 Starting search operation');
    console.log(`[RAG-SEARCH-APP] Raw query:`, JSON.stringify(query, null, 2));
    
    try {
      SearchRagQueryValidator.validate(query);
      console.log('[RAG-SEARCH-APP] ✅ Query validation passed');
    } catch (error) {
      console.error('[RAG-SEARCH-APP] ❌ Query validation failed:', error);
      return ResultHelpers.failure(`${error instanceof Error ? error.message : String(error)}`);
    }

    const { indexId, searchQuery, sourceTypes, context } = SearchRagQueryValidator.toDomainParams(query);
    console.log(`[RAG-SEARCH-APP] Parsed query - IndexId: ${indexId.value}, Text: "${searchQuery.text}", Limit: ${searchQuery.limit}`);
    console.log(`[RAG-SEARCH-APP] Source types: ${sourceTypes?.join(', ') || 'none'}`);
    
    const startTime = Date.now();

    try {
      // Verify index exists and is active
      console.log(`[RAG-SEARCH-APP] 🔎 Looking up index: ${indexId.value}`);
      const index = await this.indexRepository.findById(indexId);
      if (!index) {
        console.error(`[RAG-SEARCH-APP] ❌ Index not found: ${indexId.value}`);
        throw new Error(`Index ${indexId.value} not found`);
      }

      console.log(`[RAG-SEARCH-APP] ✅ Found index: "${index.name}" (status: ${index.status})`);
      
      if (index.status !== 'active') {
        console.error(`[RAG-SEARCH-APP] ❌ Index not active: ${index.status}`);
        throw new Error(`Index ${index.name} is not active (status: ${index.status})`);
      }

      // Prepare search query with embeddings
      console.log('[RAG-SEARCH-APP] 🧮 Preparing search query (generating embeddings)...');
      const embeddingStartTime = Date.now();
      
      // AIDEV-NOTE: Use shorter timeout for RAG context to avoid blocking chat
      const { queryEmbedding } = await this.searchDomainService.prepareSearchQuery(searchQuery, { timeout: 8000 });
      
      const embeddingTime = Date.now() - embeddingStartTime;
      console.log(`[RAG-SEARCH-APP] ✅ Query embedding generated in ${embeddingTime}ms (${queryEmbedding.length} dimensions)`);

      // Perform vector search
      const vectorSearchParams: VectorSearchParams = {
        indexId,
        queryEmbedding,
        limit: searchQuery.limit * 2, // Get more results for filtering
        threshold: 0, // Apply threshold in domain service instead
        similarityMetric: searchQuery.similarityMetric
      };

      console.log(`[RAG-SEARCH-APP] 🔍 Performing vector search with params:`, {
        indexId: indexId.value,
        embeddingDimensions: queryEmbedding.length,
        limit: vectorSearchParams.limit,
        threshold: vectorSearchParams.threshold,
        similarityMetric: vectorSearchParams.similarityMetric
      });

      const vectorSearchStartTime = Date.now();
      const vectorResult = await this.documentRepository.vectorSearch(vectorSearchParams);
      const vectorSearchTime = Date.now() - vectorSearchStartTime;
      
      console.log(`[RAG-SEARCH-APP] ✅ Vector search completed in ${vectorSearchTime}ms: ${vectorResult.documents.length} raw documents found`);

      // Apply domain filters and ranking
      const searchFilters: SearchFilters = {
        domainTypes: sourceTypes
      };

      console.log('[RAG-SEARCH-APP] 🔽 Filtering and ranking results...');
      const filterStartTime = Date.now();
      
      const filteredDocuments = this.searchDomainService.filterAndRankResults(
        vectorResult.documents,
        searchQuery,
        searchFilters as any
      );

      const filterTime = Date.now() - filterStartTime;
      console.log(`[RAG-SEARCH-APP] ✅ Filtering completed in ${filterTime}ms: ${filteredDocuments.length} documents after filtering`);

      const searchTime = Date.now() - startTime;

      // Log search for analytics
      if (this.searchLogger) {
        console.log('[RAG-SEARCH-APP] 📊 Logging search analytics...');
        await this.searchDomainService.logSearchAnalytics(
          indexId,
          searchQuery,
          queryEmbedding,
          filteredDocuments.length,
          searchTime,
          context
        );
      }

      console.log(`[RAG-SEARCH-APP] ✅ Search completed successfully in ${searchTime}ms`);
      console.log(`[RAG-SEARCH-APP] Performance breakdown: embedding=${embeddingTime}ms, vector=${vectorSearchTime}ms, filter=${filterTime}ms`);
      console.log(`[RAG-SEARCH-APP] Final results: ${filteredDocuments.length} documents for "${searchQuery.text.substring(0, 50)}..."`);

      return ResultHelpers.success({
        documents: filteredDocuments.map(doc => doc.toSearchResult()),
        totalCount: filteredDocuments.length,
        query: searchQuery.text,
        searchTime,
        indexName: index.name
      });

    } catch (error) {
      const searchTime = Date.now() - startTime;
      console.error(`[RAG-SEARCH-APP] ❌ Search failed after ${searchTime}ms`);
      console.error(`[RAG-SEARCH-APP] Error details:`, error);
      
      if (error instanceof Error) {
        console.error(`[RAG-SEARCH-APP] Error type: ${error.constructor.name}`);
        console.error(`[RAG-SEARCH-APP] Error message: ${error.message}`);
        if (error.stack) {
          console.error(`[RAG-SEARCH-APP] Stack trace (first 3 lines):`);
          console.error(error.stack.split('\n').slice(0, 3).join('\n'));
        }
      }

      return ResultHelpers.failure(`${error instanceof Error ? error.message : String(error)}`);
    }
  }
}