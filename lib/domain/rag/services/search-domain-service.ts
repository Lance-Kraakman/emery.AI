// AIDEV-NOTE: Domain service for RAG search operations
// Contains core business logic for vector similarity search and result ranking

import { RagDocument } from '../entities';
import { RagIndexId, SearchQuery, type SimilarityMetric } from '../value-objects';

export interface SearchResult {
  documents: RagDocument[];
  totalCount: number;
  query: SearchQuery;
  searchTime: number;
}

export interface SearchFilters {
  sourceTypes?: string[];
  minSimilarity?: number;
  maxResults?: number;
}

export interface EmbeddingGenerator {
  /**
   * Generate embedding vector for search query text
   */
  generateEmbedding(text: string): Promise<number[]>;
}

export interface SearchLogger {
  /**
   * Log search query for analytics
   */
  logQuery(params: {
    indexId: RagIndexId;
    query: SearchQuery;
    resultCount: number;
    searchTime: number;
    userId?: string;
    agentId?: number;
    sessionId?: string;
  }): Promise<void>;
}

export class SearchDomainService {
  constructor(
    private readonly embeddingGenerator: EmbeddingGenerator,
    private readonly searchLogger?: SearchLogger
  ) {}

  /**
   * Prepare search query by generating embeddings
   */
  async prepareSearchQuery(query: SearchQuery): Promise<{
    query: SearchQuery;
    queryEmbedding: number[];
  }> {
    const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query.text);
    
    return {
      query,
      queryEmbedding
    };
  }

  /**
   * Calculate similarity score between query and document embeddings
   */
  calculateSimilarity(
    queryEmbedding: number[],
    documentEmbedding: number[],
    metric: SimilarityMetric = 'cosine'
  ): number {
    if (queryEmbedding.length !== documentEmbedding.length) {
      throw new Error('Embedding dimensions must match');
    }

    switch (metric) {
      case 'cosine':
        return this.cosineSimilarity(queryEmbedding, documentEmbedding);
      case 'euclidean':
        return this.euclideanSimilarity(queryEmbedding, documentEmbedding);
      case 'inner_product':
        return this.innerProductSimilarity(queryEmbedding, documentEmbedding);
      default:
        throw new Error(`Unsupported similarity metric: ${metric}`);
    }
  }

  /**
   * Filter and rank search results based on domain rules
   */
  filterAndRankResults(
    documents: RagDocument[],
    query: SearchQuery,
    filters?: SearchFilters
  ): RagDocument[] {
    let filteredDocuments = [...documents];

    // Apply source type filters
    if (filters?.sourceTypes && filters.sourceTypes.length > 0) {
      filteredDocuments = filteredDocuments.filter(doc => 
        filters.sourceTypes!.includes(doc.sourceType)
      );
    }

    // Apply minimum similarity filter
    if (filters?.minSimilarity !== undefined) {
      filteredDocuments = filteredDocuments.filter(doc => 
        (doc.similarity || 0) >= filters.minSimilarity!
      );
    }

    // Apply similarity threshold from query
    filteredDocuments = filteredDocuments.filter(doc => 
      (doc.similarity || 0) >= query.threshold
    );

    // Sort by similarity (descending)
    filteredDocuments.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    // Apply result limit
    const maxResults = filters?.maxResults || query.limit;
    if (maxResults > 0) {
      filteredDocuments = filteredDocuments.slice(0, maxResults);
    }

    return filteredDocuments;
  }

  /**
   * Process search results with similarity scores
   */
  processSearchResults(
    documents: RagDocument[],
    queryEmbedding: number[],
    similarityMetric: SimilarityMetric
  ): RagDocument[] {
    return documents.map(document => {
      const similarity = this.calculateSimilarity(
        queryEmbedding,
        document.embedding,
        similarityMetric
      );
      
      // Create a copy with similarity score
      const documentCopy = RagDocument.fromPersistence(document.toPersistence());
      documentCopy.setSimilarity(similarity);
      
      return documentCopy;
    });
  }

  /**
   * Fallback text-based search when vector search fails
   */
  performTextSearch(
    documents: RagDocument[],
    query: SearchQuery
  ): RagDocument[] {
    const queryLower = query.text.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);

    return documents.map(document => {
      const similarity = this.calculateTextSimilarity(queryWords, document.content.toLowerCase());
      
      if (similarity >= 0.1) { // Minimum text similarity threshold
        const documentCopy = RagDocument.fromPersistence(document.toPersistence());
        documentCopy.setSimilarity(similarity);
        return documentCopy;
      }
      
      return null;
    })
    .filter((doc): doc is RagDocument => doc !== null)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, query.limit);
  }

  /**
   * Log search analytics if logger is configured
   */
  async logSearchAnalytics(
    indexId: RagIndexId,
    query: SearchQuery,
    resultCount: number,
    searchTime: number,
    context?: {
      userId?: string;
      agentId?: number;
      sessionId?: string;
    }
  ): Promise<void> {
    if (this.searchLogger) {
      try {
        await this.searchLogger.logQuery({
          indexId,
          query,
          resultCount,
          searchTime,
          ...context
        });
      } catch (error) {
        console.warn('[SEARCH-DOMAIN] Failed to log search analytics:', error);
        // Don't throw - logging failure shouldn't break search
      }
    }
  }

  // Private similarity calculation methods
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private euclideanSimilarity(a: number[], b: number[]): number {
    const distance = Math.sqrt(
      a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
    );
    
    // Convert distance to similarity (1 / (1 + distance))
    return 1 / (1 + distance);
  }

  private innerProductSimilarity(a: number[], b: number[]): number {
    return Math.max(0, a.reduce((sum, val, i) => sum + val * b[i], 0));
  }

  private calculateTextSimilarity(queryWords: string[], content: string): number {
    const contentWords = content.split(/\s+/);
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (contentWords.some(word => word.includes(queryWord))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }
}