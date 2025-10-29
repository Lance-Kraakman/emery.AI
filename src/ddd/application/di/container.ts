/**
 * DI Container - Dependency Injection Container
 *
 * Central container for managing application dependencies using the singleton pattern.
 * This container orchestrates registration of all domains through modular registration functions.
 *
 * AIDEV-NOTE: Refactored from monolithic (647 lines) to modular architecture.
 * Each domain has its own registration module in ./modules/ directory.
 */

import type { DbClient } from '@/lib/db/client';
import { contextAwareDb, type ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { RepositoryRegistry } from './registry';

// Import registration modules
import { registerCoreServices, type CoreServices } from './modules/core-registration';
import { registerAgentServices, type AgentServices } from './modules/agent-registration';
import { registerSkillServices, type SkillServices } from './modules/skill-registration';
import { registerDatabaseServices, type DatabaseServices } from './modules/database-registration';
import { registerChatServices, type ChatServices } from './modules/chat-registration';
import { registerToolsServices, type ToolsServices } from './modules/tools-registration';
import { registerRagServices, type RagServices } from './modules/rag-registration';
import { registerConnectionServices, type ConnectionServices } from './modules/connection-registration';
import { registerDelegationServices, type DelegationServices } from './modules/delegation-registration';
import { registerPuckServices, type PuckServices } from './modules/puck-registration';

export class DIContainer {
  private static instance: DIContainer;
  private repositories = new Map<string, any>();
  private isInitialized = false;
  private initializationAttempted = false;

  private constructor() {
    // Auto-initialize immediately when singleton is created
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
      this.autoInitialize();
    }
  }

  private autoInitialize(): void {
    this.initializationAttempted = true;
    try {
      // Use context-aware db client for automatic RLS context
      this.initialize(contextAwareDb);
      console.log('✅ DIContainer auto-initialized with context-aware database');
    } catch (error) {
      console.warn('⚠️ DIContainer auto-initialization failed, will require manual initialization:', error);
    }
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Initialize the container with database clients
   * This should be called once at application startup
   *
   * Orchestrates registration of all domains through modular registration functions.
   */
  initialize(db: DbClient | ContextAwareDbClient): void {
    if (this.isInitialized) {
      console.warn('DIContainer is already initialized');
      return;
    }

    // Phase 1: Register core services (organizations, users, teams, RBAC)
    // These have minimal dependencies
    const coreServices = registerCoreServices({ db });
    this.registerServices('core', coreServices);

    // Phase 2: Register agent services
    // Depends on: team repository
    const agentServices = registerAgentServices({
      db,
      teamRepository: coreServices.teamRepository
    });
    this.registerServices('agent', agentServices);

    // Update TeamApplicationService with agentRepository now that it exists
    const teamApplicationServiceWithAgent = coreServices.teamApplicationService;
    (teamApplicationServiceWithAgent as any).agentRepository = agentServices.agentRepository;

    // Phase 3: Register capability services
    // Depends on: database (for storage)
    const skillServices = registerSkillServices({ db });
    this.registerServices('skill', skillServices);

    // Phase 4: Register database services (tables, files, documents)
    // Depends on: organization repository
    const databaseServices = registerDatabaseServices({
      db,
      organizationRepository: coreServices.organizationRepository
    });
    this.registerServices('database', databaseServices);

    // Phase 5: Register chat services
    // Depends on: dynamic table service, agent repository
    const chatServices = registerChatServices({
      db,
      dynamicTableService: databaseServices.dynamicTableService,
      agentRepository: agentServices.agentRepository
    });
    this.registerServices('chat', chatServices);

    // Phase 6: Register tools services
    // Depends on: agent repository, table/agent/database application services
    const toolsServices = registerToolsServices({
      agentRepository: agentServices.agentRepository,
      tableApplicationService: databaseServices.tableApplicationService,
      agentApplicationService: agentServices.agentApplicationService,
      databaseApplicationService: databaseServices.databaseApplicationService
    });
    this.registerServices('tools', toolsServices);

    // Phase 7: Register RAG services
    // Depends on: many repositories from previous phases
    const ragServices = registerRagServices({
      db,
      organizationRepository: coreServices.organizationRepository,
      agentRepository: agentServices.agentRepository,
      databaseRepository: databaseServices.databaseRepository,
      teamRepository: coreServices.teamRepository,
      taskRepository: agentServices.taskRepository,
      fileStorageRepository: databaseServices.fileStorageRepository,
      dynamicTableRepository: databaseServices.dynamicTableRepository
    });
    this.registerServices('rag', ragServices);

    // Phase 8: Register delegation services
    // Depends on: database (for credential delegation storage)
    const delegationServices = registerDelegationServices({ db });
    this.registerServices('delegation', delegationServices);

    // Phase 9: Register Puck services
    // Depends on: organization repository
    const puckServices = registerPuckServices({
      db,
      organizationRepository: coreServices.organizationRepository
    });
    this.registerServices('puck', puckServices);

    // Phase 10: Register connection services (optional - Pipedream)
    // Depends on: agent repository, delegation service (for security)
    const connectionServices = registerConnectionServices({
      agentRepository: agentServices.agentRepository,
      delegationApplicationService: delegationServices.delegationApplicationService
    });
    this.registerServices('connection', connectionServices);

    // Update AgentApplicationService with delegation and connection services now that they exist
    if (delegationServices.delegationApplicationService && connectionServices.connectionApplicationService) {
      (agentServices.agentApplicationService as any).delegationService = delegationServices.delegationApplicationService;
      (agentServices.agentApplicationService as any).connectionService = connectionServices.connectionApplicationService;
    }

    this.isInitialized = true;
    console.log('✅ DIContainer initialized with all domain services');
  }

  /**
   * Helper method to register services from a registration module
   */
  private registerServices(
    domain: string,
    services: CoreServices | AgentServices | SkillServices | DatabaseServices | ChatServices | ToolsServices | RagServices | ConnectionServices | DelegationServices | PuckServices
  ): void {
    // Map service names to container keys
    const serviceKeyMappings: Record<string, string> = {
      // Core domain
      'organizationRepository': 'IOrganizationRepository',
      'userRepository': 'IUserRepository',
      'teamRepository': 'ITeamRepository',
      'invitationRepository': 'IInvitationRepository',
      'rbacRepository': 'IRBACRepository',
      'teamApplicationService': 'TeamApplicationService',
      'userRoleApplicationService': 'UserRoleApplicationService',
      'invitationApplicationService': 'InvitationApplicationService',

      // Agent domain
      'agentRepository': 'IAgentRepository',
      'taskRepository': 'ITaskRepository',
      'agentExecutionRepository': 'IAgentExecutionRepository',
      'agentTaskApplicationService': 'AgentTaskApplicationService',
      'agentApplicationService': 'AgentApplicationService',

      // Skill domain (formerly Capability)
      'skillRepository': 'ISkillRepository',
      'skillApplicationService': 'SkillApplicationService',

      // Database domain
      'databaseRepository': 'IDatabaseRepository',
      'dynamicTableRepository': 'IDynamicTableRepository',
      'fileStorageRepository': 'IFileStorageRepository',
      'dynamicTableService': 'DynamicTableService',
      'databaseApplicationService': 'DatabaseApplicationService',
      'tableApplicationService': 'TableApplicationService',
      'fileApplicationService': 'FileApplicationService',
      'documentApplicationService': 'DocumentApplicationService',

      // Chat domain
      'chatRepository': 'IChatRepository',
      'chatMessageRepository': 'IChatMessageRepository',
      'chatApplicationService': 'ChatApplicationService',

      // Tools domain
      'toolRegistryService': 'IToolRegistryService',
      'toolConfigurationService': 'IToolConfigurationService',
      'toolConfigurationApplicationService': 'ToolConfigurationApplicationService',
      'toolSearchApplicationService': 'ToolSearchApplicationService',

      // RAG domain
      'ragIndexRepository': 'IRagIndexRepository',
      'ragDocumentRepository': 'IRagDocumentRepository',
      'ragQueryLogRepository': 'IRagQueryLogRepository',
      'embeddingService': 'EmbeddingService',
      'searchAnalyticsService': 'SearchAnalyticsService',
      'embeddingGeneratorService': 'EmbeddingGeneratorService',
      'indexingDomainService': 'IndexingDomainService',
      'searchDomainService': 'SearchDomainService',
      'ragSearchApplicationService': 'RagSearchApplicationService',
      'indexingQueueService': 'IndexingQueueService',

      // Connection domain
      'connectionRepository': 'IConnectionRepository',
      'connectionApplicationService': 'ConnectionApplicationService',
      'oauthProxyApplicationService': 'OAuthProxyApplicationService',

      // Delegation domain
      'delegationRepository': 'IDelegationRepository',
      'delegationApplicationService': 'CredentialDelegationApplicationService',

      // Puck domain
      'puckAppRepository': 'IAppRepository',
      'puckPageRepository': 'IPuckPageRepository',
      'puckAppApplicationService': 'AppApplicationService',
      'puckPageApplicationService': 'PuckPageApplicationService'
    };

    // Register all services from the module
    Object.entries(services).forEach(([key, service]) => {
      const containerKey = serviceKeyMappings[key] || key;
      this.repositories.set(containerKey, service);
    });
  }

  /**
   * Get a repository by interface name
   */
  get<K extends keyof RepositoryRegistry>(interfaceName: K): RepositoryRegistry[K] {
    if (!this.isInitialized) {
      throw new Error('DIContainer must be initialized before use. Call initialize() first.');
    }

    const repository = this.repositories.get(interfaceName);
    if (!repository && !interfaceName.toString().includes('Connection')) {
      // Allow connection services to be null during build
      throw new Error(`Repository ${interfaceName} not found in container`);
    }

    return repository;
  }

  /**
   * Check if container is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get all registered repository names (for debugging)
   */
  getRegisteredRepositories(): string[] {
    return Array.from(this.repositories.keys());
  }

  /**
   * Reset the container (useful for testing)
   */
  reset(): void {
    this.repositories.clear();
    this.isInitialized = false;
  }
}

// Export context manager for API routes and tests
export { contextManager } from '@/lib/db/context-manager';

// Helper to initialize container from existing clients
export function initializeDI(db: DbClient | ContextAwareDbClient): void {
  DIContainer.getInstance().initialize(db);
}

// Export container instance for direct access if needed
export const container = DIContainer.getInstance();

// Re-export getters - explicit exports to avoid circular dependency issues with export *
export {
  // Core domain repositories
  getOrganizationRepository,
  getUserRepository,
  getTeamRepository,
  getInvitationRepository,
  getRBACRepository,

  // Agent domain repositories
  getAgentRepository,
  getTaskRepository,
  getAgentExecutionRepository,

  // Capability domain repositories
  getSkillRepository,

  // Database domain repositories
  getDatabaseRepository,
  getDynamicTableRepository,
  getFileStorageRepository,

  // Chat domain repositories
  getChatRepository,
  getChatMessageRepository,

  // Domain services
  getDynamicTableService,

  // Core application services
  getTeamApplicationService,
  getUserRoleApplicationService,
  getInvitationApplicationService,

  // Agent application services
  getAgentTaskApplicationService,
  getAgentApplicationService,

  // Capability application services
  getSkillApplicationService,

  // Database application services
  getDatabaseApplicationService,
  getTableApplicationService,
  getFileApplicationService,
  getDocumentApplicationService,

  // Chat application services
  getChatApplicationService,

  // Tools application services
  getToolSearchApplicationService,
  getToolConfigurationApplicationService,
  getToolRegistryService,

  // RAG services
  getRagIndexRepository,
  getRagDocumentRepository,
  getRagQueryLogRepository,
  getEmbeddingService,
  getSearchAnalyticsService,
  getIndexingDomainService,
  getSearchDomainService,
  getRagSearchApplicationService,
  getIndexingQueueService,

  // Connection services
  getConnectionRepository,
  getConnectionApplicationService,
  getOAuthProxyApplicationService,

  // Puck services
  getAppRepository,
  getPuckPageRepository,
  getAppApplicationService,
  getPuckPageApplicationService
} from './getters';
