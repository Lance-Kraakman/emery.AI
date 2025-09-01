// AIDEV-NOTE: Drizzle implementation of RagIndexRepository
// Provides concrete database operations using existing schema

import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { ragIndexes } from '@/lib/db/schema';


import { RagIndex } from '@/ddd/domain/rag/entities';
import { RagIndexId, OrganizationId, type DomainType, type IndexStatus } from '@/ddd/domain/rag/value-objects';
import { RagIndexRepository } from '@/ddd/domain/rag';
import { RagIndexFilters } from '@/ddd/domain/rag/repositories/rag-index-repository';
import { ContextAwareDbClient } from '@/lib/db/context-client';

export class DrizzleRagIndexRepository implements RagIndexRepository {
  constructor(private readonly db: ContextAwareDbClient) {}

  async findById(id: RagIndexId): Promise<RagIndex | null> {
    const [record] = await this.db
      .select()
      .from(ragIndexes)
      .where(eq(ragIndexes.id, id.value))
      .limit(1);

    if (!record) return null;

    return this.mapToDomainEntity(record);
  }

  async findByOrganization(organizationId: OrganizationId): Promise<RagIndex[]> {
    const records = await this.db
      .select()
      .from(ragIndexes)
      .where(eq(ragIndexes.organizationId, organizationId.value))
      .orderBy(desc(ragIndexes.createdAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  async findByAgent(agentId: number): Promise<RagIndex[]> {
    const records = await this.db
      .select()
      .from(ragIndexes)
      .where(eq(ragIndexes.agentId, agentId))
      .orderBy(desc(ragIndexes.createdAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  async findByFilters(filters: RagIndexFilters): Promise<RagIndex[]> {
    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(ragIndexes.organizationId, filters.organizationId.value));
    }

    if (filters.agentId) {
      conditions.push(eq(ragIndexes.agentId, filters.agentId));
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(ragIndexes.status, filters.status));
    }

    // Domain types filter using JSONB operations
    if (filters.domainTypes && filters.domainTypes.length > 0) {
      for (const domainType of filters.domainTypes) {
        conditions.push(sql`${ragIndexes.domainTypes} @> ${JSON.stringify([domainType])}`);
      }
    }

    const records = await this.db
      .select()
      .from(ragIndexes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ragIndexes.createdAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  async exists(id: RagIndexId): Promise<boolean> {
    const [record] = await this.db
      .select({ id: ragIndexes.id })
      .from(ragIndexes)
      .where(eq(ragIndexes.id, id.value))
      .limit(1);

    return !!record;
  }

  async isNameUnique(
    organizationId: OrganizationId, 
    name: string, 
    excludeId?: RagIndexId
  ): Promise<boolean> {
    const conditions = [
      eq(ragIndexes.organizationId, organizationId.value),
      eq(ragIndexes.name, name)
    ];

    if (excludeId) {
      conditions.push(sql`${ragIndexes.id} != ${excludeId.value}`);
    }

    const [record] = await this.db
      .select({ id: ragIndexes.id })
      .from(ragIndexes)
      .where(and(...conditions))
      .limit(1);

    return !record; // Name is unique if no record found
  }

  async save(index: RagIndex): Promise<void> {
    const persistence = index.toPersistence();
    
    await this.db.insert(ragIndexes).values({
      id: persistence.id,
      name: persistence.name,
      description: persistence.description,
      organizationId: persistence.organizationId,
      agentId: persistence.agentId,
      domainTypes: persistence.domainTypes,
      domainFilters: persistence.domainFilters,
      embeddingModel: persistence.embeddingModel,
      embeddingDimensions: persistence.embeddingDimensions,
      status: persistence.status,
      documentCount: persistence.documentCount,
      createdBy: persistence.createdBy,
      createdAt: persistence.createdAt,
      lastIndexedAt: persistence.lastIndexedAt,
      updatedAt: new Date()
    });
  }

  async update(index: RagIndex): Promise<void> {
    const persistence = index.toPersistence();
    
    await this.db
      .update(ragIndexes)
      .set({
        name: persistence.name,
        description: persistence.description,
        domainTypes: persistence.domainTypes,
        domainFilters: persistence.domainFilters,
        status: persistence.status,
        documentCount: persistence.documentCount,
        lastIndexedAt: persistence.lastIndexedAt,
        updatedAt: new Date()
      })
      .where(eq(ragIndexes.id, persistence.id));
  }

  async delete(id: RagIndexId): Promise<void> {
    await this.db
      .delete(ragIndexes)
      .where(eq(ragIndexes.id, id.value));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(ragIndexes)
      .where(eq(ragIndexes.organizationId, organizationId.value));

    return result.count;
  }

  async findIndexesNeedingReindexing(): Promise<RagIndex[]> {
    const records = await this.db
      .select()
      .from(ragIndexes)
      .where(inArray(ragIndexes.status, ['error', 'created']))
      .orderBy(desc(ragIndexes.createdAt));

    return records.map(record => this.mapToDomainEntity(record));
  }

  // Private mapping methods
  private mapToDomainEntity(record: any): RagIndex {
    return RagIndex.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      description: record.description,
      agentId: record.agentId,
      domainTypes: record.domainTypes as DomainType[],
      domainFilters: record.domainFilters,
      embeddingModel: record.embeddingModel || 'sentence-transformers/all-mpnet-base-v2',
      embeddingDimensions: record.embeddingDimensions || 768,
      status: record.status as IndexStatus,
      documentCount: record.documentCount || 0,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      lastIndexedAt: record.lastIndexedAt
    });
  }
}