// AIDEV-NOTE: Application service for RAG indexing operations
// Orchestrates domain services and manages transaction boundaries

import { 
  type RagIndexRepository, 
  type RagDocumentRepository
} from '@/ddd/domain/rag/repositories';
import { IndexingDomainService, type ContentProcessor } from '@/ddd/domain/rag/services';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import { db } from '@/lib/db/client';
import { tables, fields } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import { RagIndex } from '@/ddd/domain/rag/entities';
import { RagIndexId, OrganizationId, type DomainType } from '@/ddd/domain/rag/value-objects';
import { 
  createRagIndexCreatedEvent, 
  createDataChangeEvent,
  type ChangeType,
  type DomainEvent 
} from '@/ddd/domain/rag/events';

import { 
  type CreateIndexCommand, 
  CreateIndexCommandValidator,
  type ReindexCommand,
  ReindexCommandValidator
} from '@/ddd/application/services/rag/commands';

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
  publish(event: DomainEvent): Promise<void>;
}

export class RagIndexingApplicationService {
  constructor(
    private readonly indexRepository: RagIndexRepository,
    private readonly documentRepository: RagDocumentRepository,
    private readonly indexingDomainService: IndexingDomainService,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly tableRepository: IDynamicTableRepository,
    private readonly agentRepository: IAgentRepository,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly teamRepository: ITeamRepository,
    private readonly fileRepository: IFileStorageRepository,
    private readonly eventPublisher?: EventPublisher
  ) {}

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
        index.domainTypes,
        index.createdBy
      );
      await this.eventPublisher.publish(event);
    }

    console.log(`[RAG-INDEXING-APP] Created RAG index: ${index.name} (${index.id.value.substring(0, 8)})`);

    // Start initial indexing asynchronously
    this.performInitialIndexing(index).catch(error => {
      console.error(`[RAG-INDEXING-APP] Failed initial indexing for ${index.id.value}:`, error);
    });

    return index.id.value;
  }

  /**
   * Perform full reindexing of a RAG index
   */
  async reindexData(command: ReindexCommand): Promise<IndexingResult> {
    ReindexCommandValidator.validate(command);

    const domainParams = ReindexCommandValidator.toDomainParams(command);
    const startTime = Date.now();

    if (domainParams.indexId) {
      // Reindex specific index
      return this.reindexSingleIndex(domainParams.indexId, domainParams.domainType, startTime);
    } else if (domainParams.organizationId) {
      // Reindex all indexes for organization
      return this.reindexOrganizationIndexes(domainParams.organizationId, domainParams.domainType, startTime);
    } else {
      throw new Error('Either index ID or organization ID must be specified');
    }
  }

  /**
   * Convenience method for rebuilding a specific index (used by auto-reindex service)
   */
  async rebuildIndex(command: { indexId: string }): Promise<IndexingResult> {
    const indexId = new RagIndexId(command.indexId);
    return this.reindexSingleIndex(indexId);
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

    // Process each affected index
    const reindexPromises = relevantIndexes.map(async (index) => {
      try {
        await this.reindexSingleIndex(index.id, domainType);
        console.log(`[RAG-INDEXING-APP] Reindexed ${index.name} for ${domainType} change`);
      } catch (error) {
        console.error(`[RAG-INDEXING-APP] Failed to reindex ${index.name}:`, error);
        // Mark index as error status
        index.failIndexing();
        await this.indexRepository.save(index);
      }
    });

    await Promise.allSettled(reindexPromises);

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

  // Private implementation methods
  private async reindexSingleIndex(
    indexId: RagIndexId, 
    domainType?: DomainType,
    startTime: number = Date.now()
  ): Promise<IndexingResult> {
    const index = await this.indexRepository.findById(indexId);
    if (!index) {
      throw new Error(`Index ${indexId.value} not found`);
    }

    console.log(`[RAG-INDEXING-APP] Starting reindex for ${index.name} (${indexId.value.substring(0, 8)})`);

    // Mark as building
    index.startIndexing();
    await this.indexRepository.save(index);

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    try {
      // Determine which domain types to reindex
      const domainTypesToProcess = domainType 
        ? index.domainTypes.filter(dt => dt === domainType)
        : index.domainTypes;

      // Process each domain type directly with repositories
      for (const dt of domainTypesToProcess) {
        try {
          const result = await this.indexDomainType(index, dt);
          totalProcessed += result.documentsProcessed;
          totalAdded += result.documentsAdded;
          totalDeleted += result.documentsDeleted;
        } catch (error) {
          const errorMsg = `Failed to index ${dt}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`[RAG-INDEXING-APP] ${errorMsg}`);
        }
      }

      // Update document count and mark as complete
      const finalDocumentCount = await this.documentRepository.countByIndexId(indexId);
      index.completeIndexing(finalDocumentCount);
      await this.indexRepository.save(index);

      const executionTime = Date.now() - startTime;
      console.log(`[RAG-INDEXING-APP] Completed reindex for ${index.name} in ${executionTime}ms`);

      return {
        indexId: indexId.value,
        documentsProcessed: totalProcessed,
        documentsAdded: totalAdded,
        documentsUpdated: 0,
        documentsDeleted: totalDeleted,
        executionTime,
        errors
      };

    } catch (error) {
      index.failIndexing();
      await this.indexRepository.save(index);
      throw error;
    }
  }

  private async reindexOrganizationIndexes(
    organizationId: OrganizationId,
    domainType?: DomainType,
    startTime: number = Date.now()
  ): Promise<IndexingResult> {
    const indexes = await this.indexRepository.findByOrganization(organizationId);
    
    if (indexes.length === 0) {
      return {
        indexId: 'organization-wide',
        documentsProcessed: 0,
        documentsAdded: 0,
        documentsUpdated: 0,
        documentsDeleted: 0,
        executionTime: Date.now() - startTime,
        errors: ['No indexes found for organization']
      };
    }

    console.log(`[RAG-INDEXING-APP] Reindexing ${indexes.length} indexes for organization ${organizationId.value}`);

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    // Process indexes in parallel (but limited concurrency)
    const reindexPromises = indexes.map(async (index) => {
      try {
        const result = await this.reindexSingleIndex(index.id, domainType, startTime);
        return result;
      } catch (error) {
        const errorMsg = `Failed to reindex ${index.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        return null;
      }
    });

    const results = await Promise.allSettled(reindexPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        totalProcessed += result.value.documentsProcessed;
        totalAdded += result.value.documentsAdded;
        totalDeleted += result.value.documentsDeleted;
      }
    }

    return {
      indexId: 'organization-wide',
      documentsProcessed: totalProcessed,
      documentsAdded: totalAdded,
      documentsUpdated: 0,
      documentsDeleted: totalDeleted,
      executionTime: Date.now() - startTime,
      errors
    };
  }

  private async indexDomainType(index: RagIndex, domainType: DomainType): Promise<{
    documentsProcessed: number;
    documentsAdded: number;
    documentsDeleted: number;
  }> {
    const indexers = {
      'organization': () => this.indexOrganization(index),
      'table': () => this.indexTables(index),
      'database': () => this.indexDatabases(index),
      'agent': () => this.indexAgents(index),
      'team': () => this.indexTeams(index),
      'file': () => this.indexFiles(index)
    };

    const indexer = indexers[domainType];
    if (!indexer) {
      console.warn(`[RAG-INDEXING-APP] Unsupported domain type: ${domainType}`);
      return { documentsProcessed: 0, documentsAdded: 0, documentsDeleted: 0 };
    }

    const documents = await indexer();
    if (documents.length === 0) {
      return { documentsProcessed: 0, documentsAdded: 0, documentsDeleted: 0 };
    }

    const syncResult = await this.documentRepository.synchronizeDocuments(
      index.id, 
      domainType, 
      documents
    );

    return {
      documentsProcessed: documents.length,
      documentsAdded: syncResult.added,
      documentsDeleted: syncResult.deleted
    };
  }

  private async indexOrganization(index: RagIndex): Promise<any[]> {
    const organization = await this.organizationRepository.findById(index.organizationId);
    if (!organization) return [];

    return await this.indexingDomainService.indexOrganizationData(
      index.id, index.organizationId, organization
    );
  }

  private async indexTables(index: RagIndex): Promise<any[]> {
    // AIDEV-NOTE: Fixed implementation - properly index table/field metadata from PostgreSQL
    // This enables RAG discovery while keeping actual data queries separate via DuckDB
    
    console.log(`[RAG-INDEXING-APP] Indexing table metadata (schemas only) for organization ${index.organizationId.value}`);
    
    // Query PostgreSQL metadata tables directly for this organization
    const tablesForOrg = await db.query.tables.findMany({
      where: eq(tables.organizationId, index.organizationId.value)
    });
    
    if (tablesForOrg.length === 0) {
      console.log(`[RAG-INDEXING-APP] No tables found for organization ${index.organizationId.value}`);
      return [];
    }
    
    // Get fields for all tables efficiently
    const fieldsMap = new Map();
    for (const table of tablesForOrg) {
      const tableFields = await db.query.fields.findMany({
        where: eq(fields.tableId, table.id),
        orderBy: (fields, { asc }) => [asc(fields.orderIndex)]
      });
      fieldsMap.set(table.id, tableFields);
    }
    
    console.log(`[RAG-INDEXING-APP] Found ${tablesForOrg.length} tables with metadata for indexing`);
    
    // Use existing domain service that already only indexes metadata (not row data)
    return await this.indexingDomainService.indexTableData(
      index.id, 
      index.organizationId, 
      tablesForOrg as any[], // Convert to domain entities
      fieldsMap
    );
  }

  private async indexDatabases(index: RagIndex): Promise<any[]> {
    const databases = await this.databaseRepository.findByOrganization(index.organizationId.value);
    if (databases.length === 0) return [];

    return await this.indexingDomainService.indexDatabaseData(
      index.id, index.organizationId, databases
    );
  }

  private async indexAgents(index: RagIndex): Promise<any[]> {
    const agents = await this.agentRepository.findByOrganization(index.organizationId);
    if (agents.length === 0) return [];

    return await this.indexingDomainService.indexAgentData(
      index.id, index.organizationId, agents
    );
  }

  private async indexTeams(index: RagIndex): Promise<any[]> {
    const teams = await this.teamRepository.findByOrganization(index.organizationId);
    if (teams.length === 0) return [];

    return await this.indexingDomainService.indexTeamData(
      index.id, index.organizationId, teams
    );
  }

  private async indexFiles(index: RagIndex): Promise<any[]> {
    const files = await this.fileRepository.findByOrganization(index.organizationId.value);
    if (files.length === 0) return [];

    return await this.indexingDomainService.indexFileData(
      index.id, index.organizationId, files
    );
  }

  private async performInitialIndexing(index: RagIndex): Promise<void> {
    try {
      await this.reindexSingleIndex(index.id);
      console.log(`[RAG-INDEXING-APP] Initial indexing completed for ${index.name}`);
    } catch (error) {
      console.error(`[RAG-INDEXING-APP] Initial indexing failed for ${index.name}:`, error);
    }
  }
}