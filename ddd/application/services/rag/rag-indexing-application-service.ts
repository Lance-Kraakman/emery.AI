// AIDEV-NOTE: Application service for RAG indexing operations
// Orchestrates domain services and manages transaction boundaries

import type { RagIndexRepository } from '@/ddd/domain/rag/repositories/rag-index-repository';
import type { RagDocumentRepository } from '@/ddd/domain/rag/repositories/rag-document-repository';
import { IndexingDomainService, type ContentProcessor } from '@/ddd/domain/rag/services';
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
    private readonly documentRepository: RagDocumentRepository,
    private readonly indexingDomainService: IndexingDomainService,
    private readonly tableApplicationService: TableApplicationService,
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

    // Perform initial indexing synchronously
    await this.performInitialIndexingInternal(index);

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
    const reindexPromises = relevantIndexes.map(async (index: RagIndex) => {
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

  // ================================================================
  // PRIVATE - Core Indexing Logic
  // ================================================================

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
        ? index.domainTypes.filter((dt: DomainType) => dt === domainType)
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
    let indexes = await this.indexRepository.findByOrganization(organizationId);
    
    // AIDEV-NOTE: Auto-create default index if organization has no indexes
    // This ensures all organizations can benefit from RAG indexing without manual setup
    if (indexes.length === 0) {
      console.log(`[RAG-INDEXING-APP] No indexes found for organization ${organizationId.value}, creating default index`);
      
      try {
        // Create system index with null creator (no user needed)
        const defaultIndex = await this.createDefaultIndexForOrganization(organizationId);
        indexes = [defaultIndex];
        console.log(`[RAG-INDEXING-APP] Auto-created default index for organization ${organizationId.value}`);
      } catch (error) {
        console.error(`[RAG-INDEXING-APP] Failed to auto-create default index for organization ${organizationId.value}:`, error);
        return {
          indexId: 'organization-wide',
          documentsProcessed: 0,
          documentsAdded: 0,
          documentsUpdated: 0,
          documentsDeleted: 0,
          executionTime: Date.now() - startTime,
          errors: [`Failed to auto-create default index: ${error instanceof Error ? error.message : 'Unknown error'}`]
        };
      }
    }

    console.log(`[RAG-INDEXING-APP] Reindexing ${indexes.length} indexes for organization ${organizationId.value}`);

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalDeleted = 0;
    const errors: string[] = [];

    // Process indexes in parallel (but limited concurrency)
    const reindexPromises = indexes.map(async (index: RagIndex) => {
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
      'organizations': () => this.indexOrganization(index),
      'tables': () => this.indexTables(index),
      'databases': () => this.indexDatabases(index),
      'agents': () => this.indexAgents(index),
      'teams': () => this.indexTeams(index),
      'files': () => this.indexFiles(index)
    };

    const indexer = indexers[domainType];
    if (!indexer) {
      console.warn(`[RAG-INDEXING-APP] Unsupported domain type: ${domainType}`);
      return { documentsProcessed: 0, documentsAdded: 0, documentsDeleted: 0 };
    }

    try {
      console.log(`[RAG-INDEXING-APP] 🔍 Calling indexer for ${domainType}...`);
      const documents = await indexer();
      console.log(`[RAG-INDEXING-APP] 📄 Found ${documents.length} documents for ${domainType}`);
      
      if (documents.length === 0) {
        console.log(`[RAG-INDEXING-APP] ⚠️  No documents found for ${domainType}, skipping synchronization`);
        return { documentsProcessed: 0, documentsAdded: 0, documentsDeleted: 0 };
      }

      console.log(`[RAG-INDEXING-APP] 🔄 Synchronizing ${documents.length} documents for ${domainType}...`);
      const syncResult = await this.documentRepository.synchronizeDocuments(
        index.id, 
        domainType, 
        documents
      );
      console.log(`[RAG-INDEXING-APP] ✅ Sync result for ${domainType}: +${syncResult.added} documents, -${syncResult.deleted} documents`);

      return {
        documentsProcessed: documents.length,
        documentsAdded: syncResult.added,
        documentsDeleted: syncResult.deleted
      };
    } catch (error) {
      console.error(`[RAG-INDEXING-APP] Failed to index ${domainType}:`, error);
      
      // Return zero progress but don't throw - allows other domain types to continue processing
      return { documentsProcessed: 0, documentsAdded: 0, documentsDeleted: 0 };
    }
  }

  // ================================================================
  // PRIVATE - Domain Type Indexers
  // ================================================================

  private async indexOrganization(index: RagIndex): Promise<any[]> {
    return await this.indexingDomainService.indexDomainData(
      index.id, index.organizationId, 'organizations'
    );
  }

  private async indexTables(index: RagIndex): Promise<any[]> {
    try {
      console.log(`[RAG-INDEXING-APP] Indexing table metadata (schemas only) for organization ${index.organizationId.value}`);
      
      // Get all tables with their fields using table service (follows DDD pattern)
      const tablesWithFields = await this.tableApplicationService.getTablesWithFieldsForOrganization(index.organizationId);
      
      if (tablesWithFields.length === 0) {
        console.log(`[RAG-INDEXING-APP] No tables found for organization ${index.organizationId.value}`);
        return [];
      }
      
      console.log(`[RAG-INDEXING-APP] Found ${tablesWithFields.length} tables with metadata for indexing`);
      
      // Use existing domain service that already only indexes metadata (not row data)
      return await this.indexingDomainService.indexTableData(
        index.id, 
        index.organizationId, 
        tablesWithFields
      );
      
    } catch (error) {
      console.error(`[RAG-INDEXING-APP] Error indexing tables for organization ${index.organizationId.value}:`, error);
      return [];
    }
  }

  private async indexDatabases(index: RagIndex): Promise<any[]> {
    return await this.indexingDomainService.indexDomainData(
      index.id, index.organizationId, 'databases'
    );
  }

  private async indexAgents(index: RagIndex): Promise<any[]> {
    return await this.indexingDomainService.indexDomainData(
      index.id, index.organizationId, 'agents'
    );
  }

  private async indexTeams(index: RagIndex): Promise<any[]> {
    return await this.indexingDomainService.indexDomainData(
      index.id, index.organizationId, 'teams'
    );
  }

  private async indexFiles(index: RagIndex): Promise<any[]> {
    try {
      // Get all files from organization tables using table service
      console.log(`[RAG-INDEXING-APP] Getting files for organization ${index.organizationId.value}`);
      const filesWithContext = await this.tableApplicationService.getFilesForOrganization(index.organizationId);

      if (filesWithContext.length === 0) {
        console.log(`[RAG-INDEXING-APP] No files found in organization ${index.organizationId.value}`);
        return [];
      }

      console.log(`[RAG-INDEXING-APP] Found ${filesWithContext.length} files for indexing`);

      // Process each file for content indexing
      const allDocuments = [];
      
      for (const item of filesWithContext) {
        const file = item.file; // Extract the pure domain FileFieldValue
        
        try {
          
          // Create file processing context with additional metadata
          const fileProcessingContext = {
            id: file.id,
            key: file.s3Key,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: new Date(file.uploadedAt),
            metadata: {},
            checksums: {},
            
            // Add context from table service using domain types
            tableName: item.tableName,
            tableId: item.tableId.value,           // Extract value from domain object
            fieldName: item.fieldName,
            fieldId: item.fieldId,
            databaseId: item.databaseId.value,     // Extract value from domain object
            organizationId: item.organizationId.value // Extract value from domain object
          };

          // Process file content using domain service
          const processedDocuments = await this.indexingDomainService.indexFileData(
            index.id, 
            index.organizationId, 
            [fileProcessingContext]
          );
          
          allDocuments.push(...processedDocuments);
          
          console.log(`[RAG-INDEXING-APP] Processed file ${file.name} (${file.size} bytes)`);
          
        } catch (error) {
          console.error(`[RAG-INDEXING-APP] Error processing file ${file.name}:`, error);
          // Continue with other files
        }
      }

      console.log(`[RAG-INDEXING-APP] Successfully indexed ${allDocuments.length} documents from ${filesWithContext.length} files`);
      return allDocuments;

    } catch (error) {
      console.error(`[RAG-INDEXING-APP] Error indexing files for organization ${index.organizationId.value}:`, error);
      return [];
    }
  }

  /**
   * Perform initial indexing for a newly created index
   * Made public to allow explicit control in testing
   */
  async performInitialIndexing(indexIdOrIndex: RagIndexId | RagIndex | string): Promise<void> {
    let index: RagIndex;
    
    if (typeof indexIdOrIndex === 'string') {
      const ragIndexId = RagIndexId.fromString(indexIdOrIndex);
      const foundIndex = await this.indexRepository.findById(ragIndexId);
      if (!foundIndex) {
        throw new Error(`Index ${indexIdOrIndex} not found`);
      }
      index = foundIndex;
    } else if (indexIdOrIndex instanceof RagIndex) {
      index = indexIdOrIndex;
    } else {
      // It's a RagIndexId
      const foundIndex = await this.indexRepository.findById(indexIdOrIndex);
      if (!foundIndex) {
        throw new Error(`Index ${indexIdOrIndex.value} not found`);
      }
      index = foundIndex;
    }

    return this.performInitialIndexingInternal(index);
  }

  // ================================================================
  // PRIVATE - Helper Methods
  // ================================================================

  private async performInitialIndexingInternal(index: RagIndex): Promise<void> {
    try {
      await this.reindexSingleIndex(index.id);
      console.log(`[RAG-INDEXING-APP] Initial indexing completed for ${index.name}`);
    } catch (error) {
      // Fetch fresh index to avoid stale state issues
      const freshIndex = await this.indexRepository.findById(index.id);
      if (freshIndex && freshIndex.status === 'building') {
        freshIndex.failIndexing();
        await this.indexRepository.save(freshIndex);
      }
      console.error(`[RAG-INDEXING-APP] Initial indexing failed for ${index.name}:`, error);
      throw error; // Let caller handle the error
    }
  }

  /**
   * AIDEV-NOTE: Helper method to create a comprehensive default RAG index for an organization
   * This ensures organizations always have a default index covering all domain types
   * Called by reindexOrganizationIndexes() when no indexes exist
   * Uses null creator since these are system-created indexes
   */
  private async createDefaultIndexForOrganization(organizationId: OrganizationId): Promise<RagIndex> {
    // Check for existing default index to avoid duplicates
    const existingIndexes = await this.indexRepository.findByOrganization(organizationId);
    const defaultIndexName = 'Organization Knowledge Base';
    
    // If default index already exists, return it
    const existingDefault = existingIndexes.find(idx => idx.name === defaultIndexName);
    if (existingDefault) {
      console.log(`[RAG-INDEXING-APP] Default index already exists for organization ${organizationId.value}`);
      return existingDefault;
    }

    // Create comprehensive default index covering all domain types
    const createIndexCommand: CreateIndexCommand = {
      name: defaultIndexName,
      description: 'Automatic RAG index for organizational data - covers all tables, agents, teams, databases, and files',
      organizationId,
      domainTypes: ['tables', 'agents', 'teams', 'organizations', 'databases', 'files'], // All available domain types
    };

    console.log(`[RAG-INDEXING-APP] Creating default RAG index for organization ${organizationId.value}`);
    
    try {
      const indexId = await this.createIndexOnly(createIndexCommand);
      
      // Retrieve and return the created index
      const createdIndex = await this.indexRepository.findById(RagIndexId.fromString(indexId));
      if (!createdIndex) {
        throw new Error(`Failed to retrieve created default index for organization ${organizationId.value}`);
      }

      console.log(`[RAG-INDEXING-APP] Default index created successfully: ${createdIndex.name} (${indexId})`);
      return createdIndex;
    } catch (error) {
      // Handle race condition: another request may have created the default index
      console.log(`[RAG-INDEXING-APP] Index creation failed, checking for race condition...`);
      
      // Re-check for existing default index (race condition)
      const raceCheckIndexes = await this.indexRepository.findByOrganization(organizationId);
      const existingAfterRace = raceCheckIndexes.find(idx => idx.name === defaultIndexName);
      
      if (existingAfterRace) {
        console.log(`[RAG-INDEXING-APP] Race condition detected - default index created by another request: ${existingAfterRace.name}`);
        return existingAfterRace;
      }
      
      // If still no index exists, re-throw the original error
      throw error;
    }
  }
}