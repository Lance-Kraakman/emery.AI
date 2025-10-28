/**
 * DI Container Registry Interface
 *
 * Central registry interface that defines all available services in the DI container.
 * This interface ensures type safety when retrieving services from the container.
 */

import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { IInvitationRepository } from '@/ddd/domain/invitations/repositories/invitation-repository';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IAgentExecutionRepository } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import type { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import type { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import type { IDelegationRepository } from '@/ddd/domain/delegations/repositories/delegation-repository';
import type { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';
import type { IToolConfigurationService } from '@/ddd/domain/tools/services/tool-configuration-service';
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
import type { CredentialDelegationApplicationService } from '@/ddd/application/services/delegations/credential-delegation-application-service';
import type { EmbeddingService } from '@/ddd/application/services/embedding-service';
import type { SearchAnalyticsService } from '@/ddd/application/services/search-analytics-service';
import type { RagSearchApplicationService } from '@/ddd/application/services/rag/rag-search-application-service';
import type { IndexingQueueService } from '@/ddd/application/services/rag/indexing-queue-service';

import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { EmbeddingGeneratorService } from '@/ddd/domain/rag/services/embedding-generator-service';

import type { DrizzleRagIndexRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-index-repository';
import type { DrizzleRagDocumentRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-document-repository';
import type { DrizzleRagQueryLogRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-query-log-repository';

/**
 * Registry of all available repository interfaces and services in the DI container.
 * This interface is used internally by the container for type-safe service retrieval.
 */
export interface RepositoryRegistry {
  // Core domain repositories
  IOrganizationRepository: IOrganizationRepository;
  IUserRepository: IUserRepository;
  ITeamRepository: ITeamRepository;
  IInvitationRepository: IInvitationRepository;
  IRBACRepository: IRBACRepository;

  // Agent domain repositories
  IAgentRepository: IAgentRepository;
  ITaskRepository: ITaskRepository;
  IAgentExecutionRepository: IAgentExecutionRepository;

  // Capability domain repositories
  ISkillRepository: ISkillRepository;

  // Database domain repositories
  IDatabaseRepository: IDatabaseRepository;
  IDynamicTableRepository: IDynamicTableRepository;
  IFileStorageRepository: IFileStorageRepository;

  // Chat domain repositories
  IChatRepository: IChatRepository;
  IChatMessageRepository: IChatMessageRepository;

  // RAG domain repositories
  IRagIndexRepository: DrizzleRagIndexRepository;
  IRagDocumentRepository: DrizzleRagDocumentRepository;
  IRagQueryLogRepository: DrizzleRagQueryLogRepository;

  // Connection domain repositories (nullable when Pipedream not configured)
  IConnectionRepository: IConnectionRepository | null;

  // Delegation domain repositories
  IDelegationRepository: IDelegationRepository;

  // Tool domain services
  IToolRegistryService: IToolRegistryService;
  IToolConfigurationService: IToolConfigurationService;

  // Domain services
  DynamicTableService: DynamicTableService;

  // Core application services
  TeamApplicationService: TeamApplicationService;
  UserRoleApplicationService: UserRoleApplicationService;
  InvitationApplicationService: InvitationApplicationService;

  // Agent application services
  AgentTaskApplicationService: AgentTaskApplicationService;
  AgentApplicationService: AgentApplicationService;

  // Capability application services
  SkillApplicationService: SkillApplicationService;

  // Database application services
  DatabaseApplicationService: DatabaseApplicationService;
  TableApplicationService: TableApplicationService;
  FileApplicationService: FileUseCases;
  DocumentApplicationService: DocumentApplicationService;

  // Chat application services
  ChatApplicationService: ChatApplicationService;

  // Tools application services
  ToolSearchApplicationService: ToolSearchApplicationService;
  ToolConfigurationApplicationService: ToolConfigurationApplicationService;

  // RAG application services
  EmbeddingService: EmbeddingService;
  SearchAnalyticsService: SearchAnalyticsService;
  EmbeddingGeneratorService: EmbeddingGeneratorService;
  IndexingDomainService: IIndexingDomainService;
  SearchDomainService: ISearchDomainService;
  RagSearchApplicationService: RagSearchApplicationService;
  IndexingQueueService: IndexingQueueService;

  // Connection application services (nullable when Pipedream not configured)
  ConnectionApplicationService: ConnectionApplicationService | null;
  OAuthProxyApplicationService: OAuthProxyApplicationService | null;

  // Delegation application services
  CredentialDelegationApplicationService: CredentialDelegationApplicationService;
}
