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
import type { ViewRepository } from '@/ddd/domain/views/repositories/view-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IAgentExecutionRepository } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import type { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import type { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import type { IDelegationRepository } from '@/ddd/domain/delegations/repositories/delegation-repository';
import type { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';
import type { IToolConfigurationService } from '@/ddd/domain/tools/services/tool-configuration-service';
import type { IAuditRepository, IRowHistoryRepository } from '@/ddd/domain/audit/interfaces/audit-repository';
import type { AuditApplicationService } from '@/ddd/application/services/audit/audit-application-service';

import type { AgentTaskApplicationService } from '@/ddd/application/services/agents/agent-task-application-service';
import type { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import type { SkillApplicationService } from '@/ddd/application/services/skills/skill-application-service';
import type { SkillEnrichmentService } from '@/ddd/application/services/skills/skill-enrichment-service';
import type { TeamApplicationService } from '@/ddd/application/services/teams/team-application-service';
import type { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import type { UserRoleApplicationService } from '@/ddd/application/services/user-organizations/user-role-application-service';
import type { InvitationApplicationService } from '@/ddd/application/services/invitations/invitation-application-service';
import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import type { RowApplicationService } from '@/ddd/application/services/tables/row-application-service';
import type { TableEventCoordinatorService } from '@/ddd/application/services/tables/table-event-coordinator-service';
import type { FileUseCases } from '@/ddd/application/services/tables/file-application-service';
import type { DocumentApplicationService } from '@/ddd/application/services/tables/document-application-service';
import type { ViewApplicationService } from '@/ddd/application/services/views/view-application-service';
import type { ChatApplicationService } from '@/ddd/application/services/chat/chat-application-service';
import type { ToolSearchApplicationService } from '@/ddd/application/services/tools/tool-search-application-service';
import type { ToolConfigurationApplicationService } from '@/ddd/application/services/tools/tool-configuration-application-service';
import type { ConnectionApplicationService } from '@/ddd/application/services/connections/connection-application-service';
import type { OAuthProxyApplicationService } from '@/ddd/application/services/connections/oauth-proxy-application-service';
import type { CredentialDelegationApplicationService } from '@/ddd/application/services/delegations/credential-delegation-application-service';

import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';

import type { IAppRepository } from '@/ddd/domain/puck/repositories/app-repository';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { AppApplicationService } from '@/ddd/application/services/puck/app-application-service';
import type { PuckPageApplicationService } from '@/ddd/application/services/puck/puck-page-application-service';
import type { IContextMappingRepository } from '@/ddd/domain/context/repositories/context-mapping-repository';
import type { ContextMappingApplicationService } from '@/ddd/application/services/context/context-mapping-application-service';
import type {
  ISecurityReportRepository,
  ISecurityFindingRepository,
} from '@/ddd/domain/security/interfaces/security-repository';
import type { RuleEngineService } from '@/ddd/application/services/security/rule-engine.service';
import type { SecurityAnalyzerService } from '@/ddd/application/services/security/security-analyzer.service';

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

  // Data Source domain repositories (Puck integration)
  ViewRepository: ViewRepository;

  // Chat domain repositories
  IChatRepository: IChatRepository;
  IChatMessageRepository: IChatMessageRepository;

  // Billing domain repositories
  ITokenUsageRepository: ITokenUsageRepository;

  // Connection domain repositories (nullable when Pipedream not configured)
  IConnectionRepository: IConnectionRepository | null;

  // Delegation domain repositories
  IDelegationRepository: IDelegationRepository;

  // App domain repositories (Puck is implementation detail)
  IAppRepository: IAppRepository;
  IPuckPageRepository: IPuckPageRepository;

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
  SkillEnrichmentService: SkillEnrichmentService;

  // Database application services
  DatabaseApplicationService: DatabaseApplicationService;
  TableApplicationService: TableApplicationService;
  RowApplicationService: RowApplicationService;
  TableEventCoordinatorService: TableEventCoordinatorService;
  FileApplicationService: FileUseCases;
  DocumentApplicationService: DocumentApplicationService;

  // Data Source application services (Puck integration)
  ViewApplicationService: ViewApplicationService;

  // Chat application services
  ChatApplicationService: ChatApplicationService;

  // Tools application services
  ToolSearchApplicationService: ToolSearchApplicationService;
  ToolConfigurationApplicationService: ToolConfigurationApplicationService;

  // Connection application services (nullable when Pipedream not configured)
  ConnectionApplicationService: ConnectionApplicationService | null;
  OAuthProxyApplicationService: OAuthProxyApplicationService | null;

  // Delegation application services
  CredentialDelegationApplicationService: CredentialDelegationApplicationService;

  // App application services (Puck is implementation detail)
  AppApplicationService: AppApplicationService;
  PuckPageApplicationService: PuckPageApplicationService;

  // Audit domain repositories
  IAuditRepository: IAuditRepository;
  IRowHistoryRepository: IRowHistoryRepository;

  // Audit application services
  AuditApplicationService: AuditApplicationService;

  // Context domain repositories
  IContextMappingRepository: IContextMappingRepository;

  // Context application services
  ContextMappingApplicationService: ContextMappingApplicationService;

  // Security domain repositories
  ISecurityReportRepository: ISecurityReportRepository;
  ISecurityFindingRepository: ISecurityFindingRepository;

  // Security application services
  RuleEngineService: RuleEngineService;
  SecurityAnalyzerService: SecurityAnalyzerService;
}
