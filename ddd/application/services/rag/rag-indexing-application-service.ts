// AIDEV-NOTE: Application service for RAG indexing operations
// Orchestrates domain services and manages transaction boundaries

import type { RagIndexRepository } from '@/ddd/domain/rag/repositories/rag-index-repository';
import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import { RagIndex } from '@/ddd/domain/rag/entities';
import { RagIndexId, OrganizationId, type DomainType } from '@/ddd/domain/rag/value-objects';
import { BaseDomainEvent } from '@/ddd/domain/shared/events/base-domain-event';
import { 
  createRagIndexCreatedEvent, 
  createDataChangeEvent,
  type ChangeType,
} from '@/ddd/domain/rag/events';

import { 
  type CreateIndexCommand, 
  CreateIndexCommandValidator,
  type ReindexCommand,
  ReindexCommandValidator
} from '@/ddd/application/services/rag/commands';

import { IndexingQueueService } from './indexing-queue-service';

export interface IndexingResult {
  indexId: string;
  documentsProcessed: number;
  documentsAdded: number;
  documentsUpdated: number;
  documentsDeleted: number;
  executionTime: number;
  errors: string[];
}

export interface EventPublisher {
  publish(event: BaseDomainEvent): Promise<void>;
}

export class RagIndexingApplicationService {
  constructor(
    private readonly indexRepository: RagIndexRepository,
    private readonly tableApplicationService: TableApplicationService,
    private readonly indexingQueue: IndexingQueueService,
    private readonly eventPublisher?: EventPublisher
  ) {}

  // ================================================================
  // PUBLIC API - Index Management
  // ================================================================

  /**
   * Create a new RAG index
   */
  async createIndex(command: CreateIndexCommand): Promise<string> {
    CreateIndexCommandValidator.validate(command);

    const domainParams = CreateIndexCommandValidator.toDomainParams(command);

    // Check name uniqueness
    const isNameUnique = await this.indexRepository.isNameUnique(
      domainParams.organizationId, 
      domainParams.name
    );

    if (!isNameUnique) {
      throw new Error(`Index name "${domainParams.name}" already exists in this organization`);
    }

    // Create the index
    const index = RagIndex.create(domainParams);
    await this.indexRepository.save(index);

    // Publish domain event
    if (this.eventPublisher) {
      const event = createRagIndexCreatedEvent(
        index.id,
        index.organizationId,
        index.name,
        index.domainTypes
      );
      await this.eventPublisher.publish(event);
    }
    console.log(`[RAG-INDEXING-APP] Created RAG index: ${index.name} (${index.id.value.substring(0, 8)})`);

    // Queue initial indexing instead of doing it synchronously
    await this.indexingQueue.enqueue({
      indexId: index.id.value,
      operation: 'initial',
      maxRetries: 3
    });
    return index.id.value;
  }

  /**
   * Create a RAG index WITHOUT performing initial indexing
   * Useful for testing and when you want to control indexing timing
   */
  async createIndexOnly(command: CreateIndexCommand): Promise<string> {
    CreateIndexCommandValidator.validate(command);

    const domainParams = CreateIndexCommandValidator.toDomainParams(command);

    // Check name uniqueness
    const isNameUnique = await this.indexRepository.isNameUnique(
      domainParams.organizationId, 
      domainParams.name
    );

    if (!isNameUnique) {
      throw new Error(`Index name "${domainParams.name}" already exists in this organization`);
    }

    // Create the index
    const index = RagIndex.create(domainParams);
    await this.indexRepository.save(index);

    // Publish domain event
    if (this.eventPublisher) {
      const event = createRagIndexCreatedEvent(
        index.id,
        index.organizationId,
        index.name,
        index.domainTypes
      );
      await this.eventPublisher.publish(event);
    }

    console.log(`[RAG-INDEXING-APP] Created RAG index (no auto-indexing): ${index.name} (${index.id.value.substring(0, 8)})`);

    return index.id.value;
  }

  /**
   * Perform full reindexing of a RAG index
   */
  async reindexData(command: ReindexCommand): Promise<IndexingResult> {
    ReindexCommandValidator.validate(command);

    const domainParams = ReindexCommandValidator.toDomainParams(command);
    let operationsQueued = 0;

    if (domainParams.indexId) {
      // Queue reindex for specific index
      await this.indexingQueue.enqueue({
        indexId: domainParams.indexId.value,
        operation: 'reindex',
        domainType: domainParams.domainType,
        maxRetries: 3
      });
      operationsQueued = 1;
      
      console.log(`[RAG-INDEXING-APP] Queued reindex for index ${domainParams.indexId.value.substring(0, 8)}`);
      
    } else if (domainParams.organizationId) {
      // Queue reindex for all indexes in organization
      const indexes = await this.indexRepository.findByOrganization(domainParams.organizationId);
      
      for (const index of indexes) {
        await this.indexingQueue.enqueue({
          indexId: index.id.value,
          operation: 'reindex',
          domainType: domainParams.domainType,
          maxRetries: 3
        });
        operationsQueued++;
      }
      
      console.log(`[RAG-INDEXING-APP] Queued reindex for ${operationsQueued} indexes in organization ${domainParams.organizationId.value}`);
      
    } else {
      throw new Error('Either index ID or organization ID must be specified');
    }

    // Return immediate response indicating operations were queued
    return {
      indexId: domainParams.indexId?.value || 'organization-wide',
      documentsProcessed: 0,
      documentsAdded: 0,
      documentsUpdated: 0,
      documentsDeleted: 0,
      executionTime: 0,
      errors: [],
      operationsQueued // Add this field to track queued operations
    } as IndexingResult & { operationsQueued: number };
  }

  /**
   * Convenience method for rebuilding a specific index (used by auto-reindex service)
   */
  async rebuildIndex(command: { indexId: string }): Promise<IndexingResult> {
    const indexId = new RagIndexId(command.indexId);
    
    // Queue the rebuild operation instead of doing it directly
    await this.indexingQueue.enqueue({
      indexId: indexId.value,
      operation: 'reindex',
      maxRetries: 3
    });

    // Return immediate response indicating operation was queued
    return {
      indexId: indexId.value,
      documentsProcessed: 0,
      documentsAdded: 0,
      documentsUpdated: 0,
      documentsDeleted: 0,
      executionTime: 0,
      errors: []
    };
  }

  /**
   * Handle data change events for incremental reindexing
   */
  async handleDataChange(
    organizationId: number,
    domainType: DomainType,
    changeType: ChangeType,
    sourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const orgId = new OrganizationId(organizationId);

    // Find indexes that include this domain type
    const indexes = await this.indexRepository.findByOrganization(orgId);
    const relevantIndexes = indexes.filter(index => 
      index.domainTypes.includes(domainType)
    );

    if (relevantIndexes.length === 0) {
      console.log(`[RAG-INDEXING-APP] No indexes found for domain type ${domainType} in org ${organizationId}`);
      return;
    }

    console.log(`[RAG-INDEXING-APP] Processing ${changeType} for ${domainType}:${sourceId} across ${relevantIndexes.length} indexes`);

    // Queue data change processing for each affected index
    const queuePromises = relevantIndexes.map(async (index: RagIndex) => {
      try {
        await this.indexingQueue.enqueue({
          indexId: index.id.value,
          operation: 'data-change',
          domainType,
          sourceId,
          changeType,
          maxRetries: 2
        });
        console.log(`[RAG-INDEXING-APP] Queued data change processing for ${index.name}`);
      } catch (error) {
        console.error(`[RAG-INDEXING-APP] Failed to queue data change for ${index.name}:`, error);
      }
    });

    await Promise.allSettled(queuePromises);

    // Publish data change event
    if (this.eventPublisher) {
      const event = createDataChangeEvent(
        orgId,
        domainType,
        changeType,
        sourceId,
        { metadata }
      );
      await this.eventPublisher.publish(event);
    }
  }

  /**
   * Get indexing status for an organization
   */
  async getIndexingStatus(organizationId: number): Promise<{
    totalIndexes: number;
    activeIndexes: number;
    buildingIndexes: number;
    errorIndexes: number;
    totalDocuments: number;
  }> {
    const orgId = new OrganizationId(organizationId);
    const indexes = await this.indexRepository.findByOrganization(orgId);

    let totalDocuments = 0;
    for (const index of indexes) {
      totalDocuments += index.documentCount;
    }

    return {
      totalIndexes: indexes.length,
      activeIndexes: indexes.filter(i => i.status === 'active').length,
      buildingIndexes: indexes.filter(i => i.status === 'building').length,
      errorIndexes: indexes.filter(i => i.status === 'error').length,
      totalDocuments
    };
  }
}

