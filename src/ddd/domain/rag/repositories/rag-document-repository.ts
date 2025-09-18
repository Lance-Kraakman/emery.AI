// AIDEV-NOTE: Repository interface for RAG documents
// Defines document storage and retrieval patterns for vector search

import { RagDocument } from '../entities';
import { DocumentId, RagIndexId, OrganizationId, DomainType } from '../value-objects';

export interface DocumentFilters {
  indexId?: RagIndexId;
  organizationId?: OrganizationId;
  domainType?: DomainType;
  sourceId?: string;
  contentHashes?: string[];
}

export interface VectorSearchParams {
  indexId: RagIndexId;
  queryEmbedding: number[];
  limit: number;
  threshold: number;
  similarityMetric: 'cosine' | 'euclidean' | 'inner_product';
}

export interface VectorSearchResult {
  documents: RagDocument[];
  totalCount: number;
}

export interface DocumentSyncResult {
  added: number;
  updated: number;
  deleted: number;
}

export interface RagDocumentRepository {
  /**
   * Find a document by its unique identifier
   */
  findById(id: DocumentId): Promise<RagDocument | null>;

  /**
   * Find documents by index
   */
  findByIndexId(indexId: RagIndexId): Promise<RagDocument[]>;

  /**
   * Find documents by source
   */
  findByDomain(sourceId: string, domainType: DomainType): Promise<RagDocument[]>;

  /**
   * Find documents with complex filters
   */
  findByFilters(filters: DocumentFilters): Promise<RagDocument[]>;

  /**
   * Perform vector similarity search
   */
  vectorSearch(params: VectorSearchParams): Promise<VectorSearchResult>;

  /**
   * Get existing content hashes for an index and source type
   */
  getContentHashes(indexId: RagIndexId, domainType: DomainType): Promise<Set<string>>;

  /**
   * Check if a document exists by content hash
   */
  existsByContentHash(indexId: RagIndexId, contentHash: string): Promise<boolean>;

  /**
   * Save a new document
   */
  save(document: RagDocument): Promise<void>;

  /**
   * Save multiple documents in batch
   */
  saveMany(documents: RagDocument[]): Promise<void>;

  /**
   * Update an existing document
   */
  update(document: RagDocument): Promise<void>;

  /**
   * Delete a document
   */
  delete(id: DocumentId): Promise<void>;

  /**
   * Delete documents by index
   */
  deleteByIndexId(indexId: RagIndexId): Promise<void>;

  /**
   * Delete documents by source type within an index
   */
  deleteByDomainType(indexId: RagIndexId, domainType: DomainType): Promise<void>;

  /**
   * Delete documents by content hashes
   */
  deleteByContentHashes(indexId: RagIndexId, domainType: DomainType, contentHashes: string[]): Promise<void>;

  /**
   * Synchronize documents for a source type (add new, remove stale)
   */
  synchronizeDocuments(
    indexId: RagIndexId, 
    domainType: DomainType, 
    newDocuments: RagDocument[]
  ): Promise<DocumentSyncResult>;

  /**
   * Get document count for an index
   */
  countByIndexId(indexId: RagIndexId): Promise<number>;

  /**
   * Get document statistics
   */
  getIndexStatistics(indexId: RagIndexId): Promise<{
    totalDocuments: number;
    totalSize: number;
    averageEmbeddingSize: number;
    domainTypeCounts: Record<DomainType, number>;
  }>;
}