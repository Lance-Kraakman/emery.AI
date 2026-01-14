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
import type { FileUseCases } from '@/ddd/application/services/tables/file-application-service';
import type { DocumentApplicationService } from '@/ddd/application/services/tables/document-application-service';
import type { ChatApplicationService } from '@/ddd/application/services/chat/chat-application-service';
import type { ToolSearchApplicationService } from '@/ddd/application/services/tools/tool-search-application-service';
import type { ToolConfigurationApplicationService } from '@/ddd/application/services/tools/tool-configuration-application-service';
import type { ConnectionApplicationService } from '@/ddd/application/services/connections/connection-application-service';
import type { OAuthProxyApplicationService } from '@/ddd/application/services/connections/oauth-proxy-application-service';

import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';

import type { IAppRepository } from '@/ddd/domain/puck/repositories/app-repository';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import type { ITemplateRepository } from '@/ddd/domain/puck/repositories/template-repository';
export type { ITemplateRepository } from '@/ddd/domain/puck/repositories/template-repository';
import type { AppApplicationService } from '@/ddd/application/services/puck/app-application-service';
import type { PuckPageApplicationService } from '@/ddd/application/services/puck/puck-page-application-service';
import type { TemplateApplicationService } from '@/ddd/application/services/puck/template-application-service';
import type { ViewRepository as IViewRepository } from '@/ddd/domain/views/repositories/view-repository';
import type { ViewApplicationService } from '@/ddd/application/services/views/view-application-service';
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { IInvoiceRepository } from '@/ddd/domain/billing/repositories/invoice-repository';
import type { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import type { CreditUsageApplicationService } from '@/ddd/application/services/billing/credit-usage-application-service';
import type { InvoiceApplicationService } from '@/ddd/application/services/billing/invoice-application-service';
import type { StorageQuotaApplicationService } from '@/ddd/application/services/billing/storage-quota-application-service';
import type { StorageRecalculationApplicationService } from '@/ddd/application/services/billing/storage-recalculation-application-service';
import type { AuditApplicationService } from '@/ddd/application/services/audit/audit-application-service';
import type { IContextMappingRepository } from '@/ddd/domain/context/repositories/context-mapping-repository';
import type { ContextMappingApplicationService } from '@/ddd/application/services/context/context-mapping-application-service';

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
  SkillEnrichmentService: SkillEnrichmentService;
  TeamApplicationService: TeamApplicationService;
  DatabaseApplicationService: DatabaseApplicationService;
  UserRoleApplicationService: UserRoleApplicationService;
  InvitationApplicationService: InvitationApplicationService;
  TableApplicationService: TableApplicationService;
  RowApplicationService: RowApplicationService;
  FileApplicationService: FileUseCases;
  DocumentApplicationService: DocumentApplicationService;
  ChatApplicationService: ChatApplicationService;
  ToolSearchApplicationService: ToolSearchApplicationService;
  ToolConfigurationApplicationService: ToolConfigurationApplicationService;

  // Connection Services
  ConnectionRepository: IConnectionRepository;
  ConnectionApplicationService: ConnectionApplicationService;

  // Puck Services
  AppRepository: IAppRepository;
  PuckPageRepository: IPuckPageRepository;
  TemplateRepository: ITemplateRepository;
  AppApplicationService: AppApplicationService;
  PuckPageApplicationService: PuckPageApplicationService;
  TemplateApplicationService: TemplateApplicationService;

  // Data Source Services
  ViewRepository: IViewRepository;
  ViewApplicationService: ViewApplicationService;

  // Tool Services
  IToolRegistryService: IToolRegistryService;

  // Billing Services
  TokenUsageRepository: ITokenUsageRepository;
  InvoiceRepository: IInvoiceRepository;
  TokenUsageApplicationService: TokenUsageApplicationService;
  CreditUsageApplicationService: CreditUsageApplicationService;
  InvoiceApplicationService: InvoiceApplicationService;
  StorageQuotaApplicationService: StorageQuotaApplicationService;
  StorageRecalculationApplicationService: StorageRecalculationApplicationService;

  // Audit Services
  AuditApplicationService: AuditApplicationService;

  // Context Services
  ContextMappingRepository: IContextMappingRepository;
  ContextMappingApplicationService: ContextMappingApplicationService;
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
    'ConnectionRepository': 'IConnectionRepository',
    'AppRepository': 'IAppRepository',
    'PuckPageRepository': 'IPuckPageRepository',
    'TemplateRepository': 'ITemplateRepository',
    'ViewRepository': 'ViewRepository',
    'TokenUsageRepository': 'ITokenUsageRepository',
    'InvoiceRepository': 'IInvoiceRepository',
    'IToolRegistryService': 'IToolRegistryService',
    'ContextMappingRepository': 'IContextMappingRepository',
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
export const getSkillEnrichmentService = createGetter('SkillEnrichmentService');

// Database application service getters
export const getDatabaseApplicationService = createGetter('DatabaseApplicationService');
export const getTableApplicationService = createGetter('TableApplicationService');
export const getRowApplicationService = createGetter('RowApplicationService');
export const getFileApplicationService = createGetter('FileApplicationService');
export const getDocumentApplicationService = createGetter('DocumentApplicationService');

// Chat application service getters
export const getChatApplicationService = createGetter('ChatApplicationService');

// Tools application service getters
export const getToolSearchApplicationService = createGetter('ToolSearchApplicationService');
export const getToolConfigurationApplicationService = createGetter('ToolConfigurationApplicationService');
export const getToolRegistryService = createGetter('IToolRegistryService');

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
export const getTemplateRepository = createGetter('TemplateRepository');

// Puck application service getters
export const getAppApplicationService = createGetter('AppApplicationService');
export const getPuckPageApplicationService = createGetter('PuckPageApplicationService');
export const getTemplateApplicationService = createGetter('TemplateApplicationService');

// Data Source domain repository getters
export const getViewRepository = createGetter('ViewRepository');

// Data Source application service getters
export const getViewApplicationService = createGetter('ViewApplicationService');

// Billing domain repository getters
export const getTokenUsageRepository = createGetter('TokenUsageRepository');
export const getInvoiceRepository = createGetter('InvoiceRepository');

// Billing application service getters
export const getTokenUsageApplicationService = createGetter('TokenUsageApplicationService');
export const getCreditUsageApplicationService = createGetter('CreditUsageApplicationService');
export const getInvoiceApplicationService = createGetter('InvoiceApplicationService');
export const getStorageQuotaApplicationService = createGetter('StorageQuotaApplicationService');
export const getStorageRecalculationApplicationService = createGetter('StorageRecalculationApplicationService');

// Audit application service getters
export const getAuditApplicationService = createGetter('AuditApplicationService');

// Context domain repository getters
export const getContextMappingRepository = createGetter('ContextMappingRepository');

// Context application service getters
export const getContextMappingApplicationService = createGetter('ContextMappingApplicationService');
