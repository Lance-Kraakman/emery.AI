// AIDEV-NOTE: Drizzle implementation of RagDocumentRepository
// Provides vector search capabilities using pgvector and raw SQL

import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import type postgres from 'postgres';
import type { DbClient } from '@/lib/db/client';
import { ragDocuments } from '@/lib/db/schema';

import { 
  type RagDocumentRepository,
  type DocumentFilters,
  type VectorSearchParams,
  type VectorSearchResult,
  type DocumentSyncResult
} from '@/ddd/domain/rag/repositories';
import { RagDocument, type DocumentMetadata } from '@/ddd/domain/rag/entities';
import { DocumentId, RagIndexId, type DomainType } from '@/ddd/domain/rag/value-objects';

export class DrizzleRagDocumentRepository implements RagDocumentRepository {
  constructor(
    private readonly db: DbClient,
    private readonly rawClient: postgres.Sql
  ) {}

  async findById(id: DocumentId): Promise<RagDocument | null> {
    const [record] = await this.db
      .select()
      .from(ragDocuments)
      .where(eq(ragDocuments.id, id.value))
      .limit(1);

    if (!record) return null;

    return this.mapToDomainEntity(record);
  }

  async findByIndexId(indexId: RagIndexId): Promise<RagDocument[]> {
    const records = await this.db
      .select()
      .from(ragDocuments)
      .where(eq(ragDocuments.ragIndexId, indexId.value))
      .orderBy(desc(ragDocuments.indexedAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  async findByDomain(sourceId: string, domainType: DomainType): Promise<RagDocument[]> {
    const records = await this.db
      .select()
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.sourceId, sourceId),
          eq(ragDocuments.domainType, domainType)
        )
      )
      .orderBy(desc(ragDocuments.indexedAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  async findByFilters(filters: DocumentFilters): Promise<RagDocument[]> {
    const conditions = [];

    if (filters.indexId) {
      conditions.push(eq(ragDocuments.ragIndexId, filters.indexId.value));
    }

    if (filters.organizationId) {
      conditions.push(eq(ragDocuments.organizationId, filters.organizationId.value));
    }

    if (filters.domainType) {
      conditions.push(eq(ragDocuments.domainType, filters.domainType));
    }

    if (filters.sourceId) {
      conditions.push(eq(ragDocuments.sourceId, filters.sourceId));
    }

    if (filters.contentHashes && filters.contentHashes.length > 0) {
      conditions.push(inArray(ragDocuments.contentHash, filters.contentHashes));
    }

    const records = await this.db
      .select()
      .from(ragDocuments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ragDocuments.indexedAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  async vectorSearch(params: VectorSearchParams): Promise<VectorSearchResult> {
    try {
      // Build query based on similarity metric
      // AIDEV-NOTE: Using proper parameterized queries to prevent SQL injection
      let rawResults;
      const embeddingVector = `[${params.queryEmbedding.join(',')}]`;
      const indexId = params.indexId.value;
      const limit = params.limit * 2;
      
      switch (params.similarityMetric) {
        case 'cosine':
          // Cosine distance (lower is better)
          rawResults = await this.rawClient`
            SELECT 
              id, 
              rag_index_id,
              organization_id,
              source_type, 
              source_id, 
              source_name, 
              title, 
              content, 
              metadata,
              content_hash,
              indexed_at,
              source_updated_at,
              embedding <=> ${embeddingVector}::vector as similarity
            FROM rag_documents
            WHERE rag_index_id = ${indexId}
            ORDER BY embedding <=> ${embeddingVector}::vector ASC
            LIMIT ${limit}
          `;
          break;
          
        case 'euclidean':
          // Euclidean distance (lower is better)
          rawResults = await this.rawClient`
            SELECT 
              id, 
              rag_index_id,
              organization_id,
              source_type, 
              source_id, 
              source_name, 
              title, 
              content, 
              metadata,
              content_hash,
              indexed_at,
              source_updated_at,
              embedding <-> ${embeddingVector}::vector as similarity
            FROM rag_documents
            WHERE rag_index_id = ${indexId}
            ORDER BY embedding <-> ${embeddingVector}::vector ASC
            LIMIT ${limit}
          `;
          break;
          
        case 'inner_product':
          // Inner product (higher is better)
          rawResults = await this.rawClient`
            SELECT 
              id, 
              rag_index_id,
              organization_id,
              source_type, 
              source_id, 
              source_name, 
              title, 
              content, 
              metadata,
              content_hash,
              indexed_at,
              source_updated_at,
              embedding <#> ${embeddingVector}::vector as similarity
            FROM rag_documents
            WHERE rag_index_id = ${indexId}
            ORDER BY embedding <#> ${embeddingVector}::vector DESC
            LIMIT ${limit}
          `;
          break;
          
        default:
          // Default to cosine distance
          rawResults = await this.rawClient`
            SELECT 
              id, 
              rag_index_id,
              organization_id,
              source_type, 
              source_id, 
              source_name, 
              title, 
              content, 
              metadata,
              content_hash,
              indexed_at,
              source_updated_at,
              embedding <=> ${embeddingVector}::vector as similarity
            FROM rag_documents
            WHERE rag_index_id = ${indexId}
            ORDER BY embedding <=> ${embeddingVector}::vector ASC
            LIMIT ${limit}
          `;
      }

      // Convert distance to similarity score and apply threshold
      const scoredDocuments = rawResults.map((doc: any) => {
        let similarity: number;
        if (params.similarityMetric === 'inner_product') {
          similarity = Math.max(0, Number(doc.similarity)); // Inner product can be negative
        } else {
          // Convert distance to similarity (1 - distance, clamped to 0-1)
          similarity = Math.max(0, Math.min(1, 1 - Number(doc.similarity)));
        }
        
        const domainDocument = this.mapToDomainEntity(doc);
        domainDocument.setSimilarity(similarity);
        
        return domainDocument;
      }).filter(doc => (doc.similarity || 0) >= params.threshold)
        .slice(0, params.limit);

      return {
        documents: scoredDocuments,
        totalCount: scoredDocuments.length
      };

    } catch (error) {
      console.error('[VECTOR-SEARCH] Vector search failed:', error);
      throw error;
    }
  }

  async getContentHashes(indexId: RagIndexId, domainType: DomainType): Promise<Set<string>> {
    const records = await this.db
      .select({ contentHash: ragDocuments.contentHash })
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.ragIndexId, indexId.value),
          eq(ragDocuments.domainType, domainType)
        )
      );

    return new Set(records.map(r => r.contentHash).filter(hash => hash !== null));
  }

  async existsByContentHash(indexId: RagIndexId, contentHash: string): Promise<boolean> {
    const [record] = await this.db
      .select({ id: ragDocuments.id })
      .from(ragDocuments)
      .where(
        and(
          eq(ragDocuments.ragIndexId, indexId.value),
          eq(ragDocuments.contentHash, contentHash)
        )
      )
      .limit(1);

    return !!record;
  }

  async save(document: RagDocument): Promise<void> {
    const persistence = document.toPersistence();
    
    await this.db.insert(ragDocuments).values({
      id: persistence.id,
      ragIndexId: persistence.indexId,
      organizationId: persistence.organizationId,
      domainType: persistence.domainType,
      sourceId: persistence.sourceId,
      sourceName: persistence.sourceName,
      title: persistence.title,
      content: persistence.content,
      metadata: persistence.metadata,
      embedding: JSON.stringify(persistence.embedding), // Convert for pgvector
      contentHash: persistence.contentHash,
      indexedAt: new Date(),
      sourceUpdatedAt: persistence.updatedAt
    });
  }

  async saveMany(documents: RagDocument[]): Promise<void> {
    if (documents.length === 0) return;

    const values = documents.map(document => {
      const persistence = document.toPersistence();
      return {
        id: persistence.id,
        ragIndexId: persistence.indexId,
        organizationId: persistence.organizationId,
        domainType: persistence.domainType,
        sourceId: persistence.sourceId,
        sourceName: persistence.sourceName,
        title: persistence.title,
        content: persistence.content,
        metadata: persistence.metadata,
        embedding: JSON.stringify(persistence.embedding), // Convert for pgvector
        contentHash: persistence.contentHash,
        indexedAt: new Date(),
        sourceUpdatedAt: persistence.updatedAt
      };
    });

    await this.db.insert(ragDocuments).values(values);
  }

  async update(document: RagDocument): Promise<void> {
    const persistence = document.toPersistence();
    
    await this.db
      .update(ragDocuments)
      .set({
        title: persistence.title,
        content: persistence.content,
        metadata: persistence.metadata,
        embedding: JSON.stringify(persistence.embedding), // Convert for pgvector
        contentHash: persistence.contentHash,
        sourceUpdatedAt: persistence.updatedAt
      })
      .where(eq(ragDocuments.id, persistence.id));
  }

  async delete(id: DocumentId): Promise<void> {
    await this.db
      .delete(ragDocuments)
      .where(eq(ragDocuments.id, id.value));
  }

  async deleteByIndexId(indexId: RagIndexId): Promise<void> {
    await this.db
      .delete(ragDocuments)
      .where(eq(ragDocuments.ragIndexId, indexId.value));
  }

  async deleteByDomainType(indexId: RagIndexId, domainType: DomainType): Promise<void> {
    await this.db
      .delete(ragDocuments)
      .where(
        and(
          eq(ragDocuments.ragIndexId, indexId.value),
          eq(ragDocuments.domainType, domainType)
        )
      );
  }

  async deleteByContentHashes(
    indexId: RagIndexId, 
    domainType: DomainType, 
    contentHashes: string[]
  ): Promise<void> {
    if (contentHashes.length === 0) return;

    await this.db
      .delete(ragDocuments)
      .where(
        and(
          eq(ragDocuments.ragIndexId, indexId.value),
          eq(ragDocuments.domainType, domainType),
          inArray(ragDocuments.contentHash, contentHashes)
        )
      );
  }

  async synchronizeDocuments(
    indexId: RagIndexId, 
    domainType: DomainType, 
    newDocuments: RagDocument[]
  ): Promise<DocumentSyncResult> {
    // Get existing content hashes for this source type
    const existingHashes = await this.getContentHashes(indexId, domainType);
    const newHashes = new Set(newDocuments.map(d => d.contentHash));

    // Documents to add (new hashes not in existing)
    const documentsToAdd = newDocuments.filter(d => !existingHashes.has(d.contentHash));

    // Hashes to delete (existing hashes not in new)
    const hashesToDelete: string[] = [];
    for (const hash of Array.from(existingHashes)) {
      if (!newHashes.has(hash)) {
        hashesToDelete.push(hash);
      }
    }

    // Perform batch operations
    let added = 0;
    let deleted = 0;

    if (documentsToAdd.length > 0) {
      await this.saveMany(documentsToAdd);
      added = documentsToAdd.length;
    }

    if (hashesToDelete.length > 0) {
      await this.deleteByContentHashes(indexId, domainType, hashesToDelete);
      deleted = hashesToDelete.length;
    }

    return {
      added,
      updated: 0, // Current implementation replaces rather than updates
      deleted
    };
  }

  async countByIndexId(indexId: RagIndexId): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(ragDocuments)
      .where(eq(ragDocuments.ragIndexId, indexId.value));

    return result.count;
  }

  async getIndexStatistics(indexId: RagIndexId): Promise<{
    totalDocuments: number;
    totalSize: number;
    averageEmbeddingSize: number;
    domainTypeCounts: Record<DomainType, number>;
  }> {
    // Get total documents and sizes
    const [stats] = await this.rawClient`
      SELECT 
        COUNT(*) as total_documents,
        COALESCE(AVG(pg_column_size(content)), 0) as avg_content_size,
        COALESCE(AVG(pg_column_size(embedding)), 0) as avg_embedding_size,
        COALESCE(SUM(pg_column_size(content)), 0) as total_size
      FROM rag_documents
      WHERE rag_index_id = ${indexId.value}
    `;

    // Get source type counts
    const domainTypeResults = await this.rawClient`
      SELECT source_type, COUNT(*) as count
      FROM rag_documents
      WHERE rag_index_id = ${indexId.value}
      GROUP BY source_type
    `;

    const domainTypeCounts: Record<DomainType, number> = {} as any;
    for (const result of domainTypeResults) {
      domainTypeCounts[result.source_type as DomainType] = Number(result.count);
    }

    return {
      totalDocuments: Number(stats.total_documents),
      totalSize: Number(stats.total_size),
      averageEmbeddingSize: Number(stats.avg_embedding_size),
      domainTypeCounts
    };
  }

  // Private mapping methods
  private mapToDomainEntity(record: any): RagDocument {
    return RagDocument.fromPersistence({
      id: record.id,
      indexId: record.rag_index_id || record.ragIndexId,
      organizationId: record.organization_id || record.organizationId,
      sourceId: record.source_id || record.sourceId,
      domainType: (record.source_type || record.domainType) as DomainType,
      sourceName: record.source_name || record.sourceName,
      title: record.title,
      content: record.content,
      metadata: record.metadata as DocumentMetadata,
      embedding: typeof record.embedding === 'string' 
        ? JSON.parse(record.embedding) 
        : record.embedding,
      contentHash: record.content_hash || record.contentHash,
      createdAt: record.indexed_at || record.indexedAt || new Date(),
      updatedAt: record.source_updated_at || record.sourceUpdatedAt || new Date(),
      similarity: record.similarity ? Number(record.similarity) : undefined
    });
  }
}