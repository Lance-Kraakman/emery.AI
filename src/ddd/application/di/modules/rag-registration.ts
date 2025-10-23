/**
 * RAG (Retrieval Augmented Generation) Domain Registration Module
 *
 * Registers repositories and services for RAG domain:
 * - RAG index repository
 * - RAG document repository
 * - RAG query log repository
 * - Embedding services
 * - Search services
 * - Indexing services
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IIndexingDomainService, ISearchDomainService } from '@/ddd/domain/rag/services';

import { DrizzleRagIndexRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-index-repository';
import { DrizzleRagDocumentRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-document-repository';
import { DrizzleRagQueryLogRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-query-log-repository';

import { EmbeddingService } from '@/ddd/application/services/embedding-service';
import { SearchAnalyticsService } from '@/ddd/application/services/search-analytics-service';
import { EmbeddingGeneratorDomainService } from '@/ddd/application/services/rag/embedding-generator-service/embedding-generator-service';
import { IndexingDomainService, SearchDomainService } from '@/ddd/domain/rag/services';
import { RagSearchApplicationService } from '@/ddd/application/services/rag/rag-search-application-service';
import { IndexingQueueService, indexingQueueService } from '@/ddd/application/services/rag/indexing-queue-service';

export interface RagServices {
  ragIndexRepository: DrizzleRagIndexRepository;
  ragDocumentRepository: DrizzleRagDocumentRepository;
  ragQueryLogRepository: DrizzleRagQueryLogRepository;
  embeddingService: EmbeddingService;
  searchAnalyticsService: SearchAnalyticsService;
  embeddingGeneratorService: EmbeddingGeneratorDomainService;
  indexingDomainService: IIndexingDomainService;
  searchDomainService: ISearchDomainService;
  ragSearchApplicationService: RagSearchApplicationService;
  indexingQueueService: IndexingQueueService;
}

export interface RagDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
  agentRepository: IAgentRepository;
  databaseRepository: IDatabaseRepository;
  teamRepository: ITeamRepository;
  taskRepository: ITaskRepository;
  fileStorageRepository: IFileStorageRepository;
  dynamicTableRepository: IDynamicTableRepository;
}

export function registerRagServices(deps: RagDependencies): RagServices {
  const {
    db,
    organizationRepository,
    agentRepository,
    databaseRepository,
    teamRepository,
    taskRepository,
    fileStorageRepository,
    dynamicTableRepository
  } = deps;

  // Register RAG repositories
  const ragIndexRepository = new DrizzleRagIndexRepository(db);
  const ragDocumentRepository = new DrizzleRagDocumentRepository(db);
  const ragQueryLogRepository = new DrizzleRagQueryLogRepository(db);

  // Register RAG application services
  const embeddingService = new EmbeddingService();
  const searchAnalyticsService = new SearchAnalyticsService(ragQueryLogRepository);
  const embeddingGeneratorService = new EmbeddingGeneratorDomainService(embeddingService);

  // Register RAG domain services
  const indexingDomainService = new IndexingDomainService(
    embeddingGeneratorService,
    organizationRepository,
    agentRepository,
    databaseRepository,
    teamRepository,
    taskRepository,
    fileStorageRepository,
    dynamicTableRepository,
    ragIndexRepository,
    ragDocumentRepository
  );

  const searchDomainService = new SearchDomainService(
    embeddingService,
    searchAnalyticsService
  );

  // Register RAG use case services
  const ragSearchApplicationService = new RagSearchApplicationService(
    ragIndexRepository,
    ragDocumentRepository,
    searchDomainService,
    embeddingService,
    searchAnalyticsService
  );

  return {
    ragIndexRepository,
    ragDocumentRepository,
    ragQueryLogRepository,
    embeddingService,
    searchAnalyticsService,
    embeddingGeneratorService,
    indexingDomainService,
    searchDomainService,
    ragSearchApplicationService,
    indexingQueueService // Singleton
  };
}
