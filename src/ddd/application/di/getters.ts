/**
 * DI Container Typed Getters
 *
 * Provides type-safe getter functions for retrieving services from the DI container.
 * These functions are auto-generated from the ServiceMap type for consistency.
 */

import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IAgentExecutionRepository } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { IInvitationRepository } from '@/ddd/domain/invitations/repositories/invitation-repository';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import type { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import type { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import type { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';
import type { IIndexingDomainService, ISearchDomainService } from '@/ddd/domain/rag/services';

import type { AgentTaskApplicationService } from '@/ddd/application/services/agents/agent-task-application-service';
import type { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import type { SkillApplicationService } from '@/ddd/application/services/skills/skill-application-service';
import type { TeamApplicationService } from '@/ddd/application/services/teams/team-application-service';
import type { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import type { UserRoleApplicationService } from '@/ddd/application/services/user-organizations/user-role-application-service';
import type { InvitationApplicationService } from '@/ddd/application/services/invitations/invitation-application-service';
import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import type { FileUseCases } from '@/ddd/application/services/tables/file-application-service';
import type { DocumentApplicationService } from '@/ddd/application/services/tables/document-application-service';
import type { ChatApplicationService } from '@/ddd/application/services/chat/chat-application-service';
import type { ToolSearchApplicationService } from '@/ddd/application/services/tools/tool-search-application-service';
import type { ToolConfigurationApplicationService } from '@/ddd/application/services/tools/tool-configuration-application-service';
import type { ConnectionApplicationService } from '@/ddd/application/services/connections/connection-application-service';
import type { OAuthProxyApplicationService } from '@/ddd/application/services/connections/oauth-proxy-application-service';
import type { EmbeddingService } from '@/ddd/application/services/embedding-service';
import type { SearchAnalyticsService } from '@/ddd/application/services/search-analytics-service';
import type { RagSearchApplicationService } from '@/ddd/application/services/rag/rag-search-application-service';
import type { IndexingQueueService } from '@/ddd/application/services/rag/indexing-queue-service';

import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { EmbeddingGeneratorService } from '@/ddd/domain/rag/services/embedding-generator-service';

import type { DrizzleRagIndexRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-index-repository';
import type { DrizzleRagDocumentRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-document-repository';
import type { DrizzleRagQueryLogRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-query-log-repository';
import type { IAppRepository } from '@/ddd/domain/puck/repositories/app-repository';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { AppApplicationService } from '@/ddd/application/services/puck/app-application-service';
import type { PuckPageApplicationService } from '@/ddd/application/services/puck/puck-page-application-service';
import type { ViewRepository as IViewRepository } from '@/ddd/domain/views/repositories/view-repository';
import type { ViewApplicationService } from '@/ddd/application/services/views/view-application-service';

import { DIContainer } from './container';

/**
 * Service map defines all services with simplified names for getter functions.
 * This ensures type safety when retrieving services.
 */
type ServiceMap = {
  // Repositories
  OrganizationRepository: IOrganizationRepository;
  UserRepository: IUserRepository;
  DynamicTableRepository: IDynamicTableRepository;
  FileStorageRepository: IFileStorageRepository;
  AgentRepository: IAgentRepository;
  TaskRepository: ITaskRepository;
  AgentExecutionRepository: IAgentExecutionRepository;
  SkillRepository: ISkillRepository;
  TeamRepository: ITeamRepository;
  InvitationRepository: IInvitationRepository;
  RBACRepository: IRBACRepository;
  DatabaseRepository: IDatabaseRepository;
  ChatRepository: IChatRepository;
  ChatMessageRepository: IChatMessageRepository;

  // Domain services
  DynamicTableService: DynamicTableService;

  // Application services
  AgentTaskApplicationService: AgentTaskApplicationService;
  AgentApplicationService: AgentApplicationService;
  SkillApplicationService: SkillApplicationService;
  TeamApplicationService: TeamApplicationService;
  DatabaseApplicationService: DatabaseApplicationService;
  UserRoleApplicationService: UserRoleApplicationService;
  InvitationApplicationService: InvitationApplicationService;
  TableApplicationService: TableApplicationService;
  FileApplicationService: FileUseCases;
  DocumentApplicationService: DocumentApplicationService;
  ChatApplicationService: ChatApplicationService;
  ToolSearchApplicationService: ToolSearchApplicationService;
  ToolConfigurationApplicationService: ToolConfigurationApplicationService;

  // RAG Services
  RagIndexRepository: DrizzleRagIndexRepository;
  RagDocumentRepository: DrizzleRagDocumentRepository;
  RagQueryLogRepository: DrizzleRagQueryLogRepository;
  EmbeddingService: EmbeddingService;
  SearchAnalyticsService: SearchAnalyticsService;
  EmbeddingGeneratorDomainService: EmbeddingGeneratorService;
  IndexingDomainService: IIndexingDomainService;
  SearchDomainService: ISearchDomainService;
  RagSearchApplicationService: RagSearchApplicationService;
  IndexingQueueService: IndexingQueueService;

  // Connection Services
  ConnectionRepository: IConnectionRepository;
  ConnectionApplicationService: ConnectionApplicationService;

  // Puck Services
  AppRepository: IAppRepository;
  PuckPageRepository: IPuckPageRepository;
  AppApplicationService: AppApplicationService;
  PuckPageApplicationService: PuckPageApplicationService;

  // Data Source Services
  ViewRepository: IViewRepository;
  ViewApplicationService: ViewApplicationService;

  // Tool Services
  IToolRegistryService: IToolRegistryService;
};

/**
 * Generic getter factory that creates type-safe getter functions
 * NOTE: Container is accessed lazily to avoid initialization issues during module loading
 */
const createGetter = <K extends keyof ServiceMap>(key: K) => (): ServiceMap[K] => {
  const diContainer = DIContainer.getInstance(); // Lazy access
  // Map simple names to container keys (e.g., 'AgentRepository' -> 'IAgentRepository')
  let containerKey;

  // Special mappings for services with interface prefix
  const specialMappings: Record<string, string> = {
    'RagIndexRepository': 'IRagIndexRepository',
    'RagDocumentRepository': 'IRagDocumentRepository',
    'RagQueryLogRepository': 'IRagQueryLogRepository',
    'ConnectionRepository': 'IConnectionRepository',
    'AppRepository': 'IAppRepository',
    'PuckPageRepository': 'IPuckPageRepository',
    'ViewRepository': 'ViewRepository',
    'IToolRegistryService': 'IToolRegistryService',
  };

  if (specialMappings[key as string]) {
    containerKey = specialMappings[key as string];
  } else if (key.includes('Repository')) {
    containerKey = `I${key}`;
  } else {
    // All other services are registered as-is (domain services, application services)
    containerKey = key;
  }
  return diContainer.get(containerKey as any) as ServiceMap[K];
};

// Core domain repository getters
export const getOrganizationRepository = createGetter('OrganizationRepository');
export const getUserRepository = createGetter('UserRepository');
export const getTeamRepository = createGetter('TeamRepository');
export const getInvitationRepository = createGetter('InvitationRepository');
export const getRBACRepository = createGetter('RBACRepository');

// Agent domain repository getters
export const getAgentRepository = createGetter('AgentRepository');
export const getTaskRepository = createGetter('TaskRepository');
export const getAgentExecutionRepository = createGetter('AgentExecutionRepository');

// Capability domain repository getters
export const getSkillRepository = createGetter('SkillRepository');

// Database domain repository getters
export const getDatabaseRepository = createGetter('DatabaseRepository');
export const getDynamicTableRepository = createGetter('DynamicTableRepository');
export const getFileStorageRepository = createGetter('FileStorageRepository');

// Chat domain repository getters
export const getChatRepository = createGetter('ChatRepository');
export const getChatMessageRepository = createGetter('ChatMessageRepository');

// Domain service getters
export const getDynamicTableService = createGetter('DynamicTableService');

// Core application service getters
export const getTeamApplicationService = createGetter('TeamApplicationService');
export const getUserRoleApplicationService = createGetter('UserRoleApplicationService');
export const getInvitationApplicationService = createGetter('InvitationApplicationService');

// Agent application service getters
export const getAgentTaskApplicationService = createGetter('AgentTaskApplicationService');
export const getAgentApplicationService = createGetter('AgentApplicationService');

// Capability application service getters
export const getSkillApplicationService = createGetter('SkillApplicationService');

// Database application service getters
export const getDatabaseApplicationService = createGetter('DatabaseApplicationService');
export const getTableApplicationService = createGetter('TableApplicationService');
export const getFileApplicationService = createGetter('FileApplicationService');
export const getDocumentApplicationService = createGetter('DocumentApplicationService');

// Chat application service getters
export const getChatApplicationService = createGetter('ChatApplicationService');

// Tools application service getters
export const getToolSearchApplicationService = createGetter('ToolSearchApplicationService');
export const getToolConfigurationApplicationService = createGetter('ToolConfigurationApplicationService');
export const getToolRegistryService = createGetter('IToolRegistryService');

// RAG service getters
export const getRagIndexRepository = createGetter('RagIndexRepository');
export const getRagDocumentRepository = createGetter('RagDocumentRepository');
export const getRagQueryLogRepository = createGetter('RagQueryLogRepository');
export const getEmbeddingService = createGetter('EmbeddingService');
export const getSearchAnalyticsService = createGetter('SearchAnalyticsService');
export const getIndexingDomainService = createGetter('IndexingDomainService');
export const getSearchDomainService = createGetter('SearchDomainService');
export const getRagSearchApplicationService = createGetter('RagSearchApplicationService');
export const getIndexingQueueService = createGetter('IndexingQueueService');

// Connection service getters - handle null gracefully when Pipedream not configured
export const getConnectionRepository = (): IConnectionRepository => {
  const diContainer = DIContainer.getInstance(); // Lazy access
  const service = diContainer.get('IConnectionRepository');
  if (!service) {
    throw new Error('Connection services not available. Pipedream client not configured. This is expected during build time.');
  }
  return service;
};

export const getConnectionApplicationService = (): ConnectionApplicationService => {
  const diContainer = DIContainer.getInstance(); // Lazy access
  const service = diContainer.get('ConnectionApplicationService');
  if (!service) {
    throw new Error('Connection services not available. Pipedream client not configured. This is expected during build time.');
  }
  return service;
};

export const getOAuthProxyApplicationService = (): OAuthProxyApplicationService => {
  const diContainer = DIContainer.getInstance(); // Lazy access
  const service = diContainer.get('OAuthProxyApplicationService');
  if (!service) {
    throw new Error('OAuth proxy service not available. Pipedream client not configured. This is expected during build time.');
  }
  return service;
};

// Puck domain repository getters
export const getAppRepository = createGetter('AppRepository');
export const getPuckPageRepository = createGetter('PuckPageRepository');

// Puck application service getters
export const getAppApplicationService = createGetter('AppApplicationService');
export const getPuckPageApplicationService = createGetter('PuckPageApplicationService');

// Data Source domain repository getters
export const getViewRepository = createGetter('ViewRepository');

// Data Source application service getters
export const getViewApplicationService = createGetter('ViewApplicationService');
