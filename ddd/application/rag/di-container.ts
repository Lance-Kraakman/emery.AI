// AIDEV-NOTE: Dependency injection container for RAG system
// Provides configured instances with proper dependency wiring

import { db, rawClient } from '@/lib/db/client';

// Infrastructure - Repositories and external integrations
import { 
  DrizzleRagIndexRepository,
  DrizzleRagDocumentRepository,
  DrizzleRagQueryLogRepository
} from '@/ddd/infrastructure/db/repositories/rag';
import { DrizzleOrganizationRepository } from '@/ddd/infrastructure/db/repositories/organizations/drizzle-organization-repository';
import { DrizzleDynamicTableRepository } from '@/ddd/infrastructure/db/repositories/tables/drizzle-dynamic-table-repository';
import { DrizzleFieldRepository } from '@/ddd/infrastructure/db/repositories/fields/drizzle-field-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { DrizzleDatabaseRepository } from '@/ddd/infrastructure/db/repositories/databases/drizzle-database-repository';
import { DrizzleTeamRepository } from '@/ddd/infrastructure/db/repositories/teams/drizzle-team-repository';
import { DrizzleFileStorageRepository } from '@/ddd/infrastructure/db/repositories/files/drizzle-file-storage-repository';
import { LlamaIndexContentProcessor } from '@/ddd/infrastructure/content-processing/llamaindex-content-processor';

// Application Services
import { 
  EmbeddingService,
  SearchAnalyticsService
} from '@/ddd/application/rag/services';

// Domain Services  
import { IndexingDomainService, SearchDomainService } from '@/ddd/domain/rag/services';

// Application Services
import { 
  RagIndexingApplicationService, 
  RagSearchApplicationService 
} from '@/ddd/application/rag/services';

/**
 * RAG Dependency Injection Container
 * Pre-configured service instances with proper dependencies
 */

// Infrastructure repositories
export const indexRepository = new DrizzleRagIndexRepository(db);
export const documentRepository = new DrizzleRagDocumentRepository(db);
export const queryLogRepository = new DrizzleRagQueryLogRepository(db);

// Domain repositories
export const organizationRepository = new DrizzleOrganizationRepository(db, rawClient);
export const tableRepository = new DrizzleDynamicTableRepository(db, rawClient);
export const fieldRepository = new DrizzleFieldRepository(db, rawClient);
export const agentRepository = new DrizzleAgentRepository(db);
export const databaseRepository = new DrizzleDatabaseRepository(db);
export const teamRepository = new DrizzleTeamRepository(db);
export const fileRepository = new DrizzleFileStorageRepository(db);

// Application services
export const embeddingService = new EmbeddingService();
export const contentProcessor = new LlamaIndexContentProcessor(embeddingService);
export const searchAnalyticsService = new SearchAnalyticsService(queryLogRepository);

// Domain services
export const indexingDomainService = new IndexingDomainService(contentProcessor);
export const searchDomainService = new SearchDomainService(embeddingService, searchAnalyticsService);

// Application services
export const indexingApplicationService = new RagIndexingApplicationService(
  indexRepository,
  documentRepository,
  indexingDomainService,
  organizationRepository,
  tableRepository,
  fieldRepository,
  agentRepository,
  databaseRepository,
  teamRepository,
  fileRepository
);

export const searchApplicationService = new RagSearchApplicationService(
  indexRepository,
  documentRepository,
  searchDomainService,
  embeddingService,
  searchAnalyticsService
);
