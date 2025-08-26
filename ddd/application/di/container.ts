import type { DbClient } from '@/lib/db/client';
import type postgres from 'postgres';

import { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { DrizzleOrganizationRepository } from '@/ddd/infrastructure/db/repositories/organizations/drizzle-organization-repository';
import { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import { DrizzleUserRepository } from '@/ddd/infrastructure/db/repositories/users/drizzle-user-repository';
import { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
import { DrizzleRoleRepository } from '@/ddd/infrastructure/db/repositories/roles/drizzle-role-repository';
import { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import { TableService } from '@/ddd/infrastructure/services/tables/table-service';
import { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service';
import { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';
import { DuckDBTableQueryService } from '@/ddd/infrastructure/data/duckdb-table-query-service';
import { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import { S3FileStorageRepository } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';

// Agent domain imports
import { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import { DrizzleTaskRepository } from '@/ddd/infrastructure/db/repositories/tasks/drizzle-task-repository';
import { IAgentExecutionRepository } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import { GrpcAgentExecutionRepository } from '@/ddd/infrastructure/execution/grpc-agent-execution-repository';
import { AgentTaskApplicationService } from '@/ddd/application/services/agents/agent-task-application-service';
import { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import { TeamApplicationService } from '@/ddd/application/services/teams/team-application-service';
import { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import { PermissionApplicationService } from '@/ddd/application/services/permissions/permission-application-service';
import { UserOrganizationApplicationService } from '@/ddd/application/services/user-organizations/user-organization-application-service';
import { InvitationApplicationService } from '@/ddd/application/services/invitations/invitation-application-service';

// Team domain imports
import { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import { DrizzleTeamRepository } from '@/ddd/infrastructure/db/repositories/teams/drizzle-team-repository';

// Invitation domain imports
import { IInvitationRepository } from '@/ddd/domain/invitations/repositories/invitation-repository';
import { DrizzleInvitationRepository } from '@/ddd/infrastructure/db/repositories/invitations/drizzle-invitation-repository';

// Database domain imports
import { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import { DrizzleDatabaseRepository } from '@/ddd/infrastructure/db/repositories/databases/drizzle-database-repository';

// New application services for tables, fields, rows, files, and chat
import { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import { FieldApplicationService } from '@/ddd/application/services/fields/field-application-service';
import { RowApplicationService } from '@/ddd/application/services/rows/row-application-service';
import { FileApplicationService } from '@/ddd/application/services/files/file-application-service';
import { ChatApplicationService } from '@/ddd/application/services/chat/chat-application-service';

// Field and table services
import { FieldSchemaService } from '@/ddd/domain/fields/services/field-schema-service';
import { ArrowFieldSchemaService } from '@/ddd/infrastructure/fields/arrow-field-schema-service';
import { TableDataService } from '@/ddd/domain/tables/services/table-data-service';
import { ArrowTableDataService } from '@/ddd/infrastructure/tables/arrow-table-data-service';
import { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import { DrizzleFieldRepository } from '@/ddd/infrastructure/db/repositories/fields/drizzle-field-repository';

// Chat domain imports
import { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import { DrizzleChatRepository } from '@/ddd/infrastructure/db/repositories/chat/drizzle-chat-repository';
import { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import { DrizzleChatMessageRepository } from '@/ddd/infrastructure/db/repositories/chat/drizzle-chat-message-repository';

// RAG domain imports
import { DrizzleRagIndexRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-index-repository';
import { DrizzleRagDocumentRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-document-repository';
import { DrizzleRagQueryLogRepository } from '@/ddd/infrastructure/db/repositories/rag/drizzle-rag-query-log-repository';
import { LlamaIndexContentProcessor } from '@/ddd/application/services/content-processing/llamaindex-content-processor';
import { EmbeddingService } from '@/ddd/application/services/embedding-service';
import { SearchAnalyticsService } from '@/ddd/application/services/search-analytics-service';
import type { IIndexingDomainService, ISearchDomainService } from '@/ddd/domain/rag/services';
import { IndexingDomainService, SearchDomainService } from '@/ddd/domain/rag/services';
import { RagIndexingApplicationService } from '@/ddd/application/services/rag/rag-indexing-application-service';
import { RagSearchApplicationService } from '@/ddd/application/services/rag/rag-search-application-service';

// Registry of all available repository interfaces and services
interface RepositoryRegistry {
  IOrganizationRepository: IOrganizationRepository;
  IUserRepository: IUserRepository;
  IRoleRepository: IRoleRepository;
  IDynamicTableRepository: IDynamicTableRepository;
  DataStorageService: DataStorageService;
  TableQueryService: TableQueryService;
  IFileStorageRepository: IFileStorageRepository;
  
  // Field and table services
  IFieldRepository: IFieldRepository;
  FieldSchemaService: FieldSchemaService;
  TableDataService: TableDataService;
  
  // Team domain
  ITeamRepository: ITeamRepository;
  
  // Invitation domain
  IInvitationRepository: IInvitationRepository;
  
  // Database domain
  IDatabaseRepository: IDatabaseRepository;
  
  // Agent domain services
  IAgentRepository: IAgentRepository;
  ITaskRepository: ITaskRepository;
  IAgentExecutionRepository: IAgentExecutionRepository;
  AgentTaskApplicationService: AgentTaskApplicationService;
  AgentApplicationService: AgentApplicationService;
  TeamApplicationService: TeamApplicationService;
  DatabaseApplicationService: DatabaseApplicationService;
  PermissionApplicationService: PermissionApplicationService;
  UserOrganizationApplicationService: UserOrganizationApplicationService;
  InvitationApplicationService: InvitationApplicationService;
  
  // New application services for data management
  TableApplicationService: TableApplicationService;
  FieldApplicationService: FieldApplicationService;
  RowApplicationService: RowApplicationService;
  FileApplicationService: FileApplicationService;
  
  // Chat domain services
  IChatRepository: IChatRepository;
  IChatMessageRepository: IChatMessageRepository;
  ChatApplicationService: ChatApplicationService;

  // RAG domain repositories
  IRagIndexRepository: DrizzleRagIndexRepository;
  IRagDocumentRepository: DrizzleRagDocumentRepository;
  IRagQueryLogRepository: DrizzleRagQueryLogRepository;

  // RAG application services
  EmbeddingService: EmbeddingService;
  SearchAnalyticsService: SearchAnalyticsService;
  LlamaIndexContentProcessor: LlamaIndexContentProcessor;

  // RAG domain services
  IndexingDomainService: IIndexingDomainService;
  SearchDomainService: ISearchDomainService;

  // RAG use case services
  RagIndexingApplicationService: RagIndexingApplicationService;
  RagSearchApplicationService: RagSearchApplicationService;
}

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
      // Import db clients dynamically to avoid circular dependencies
      const { db, rawClient } = require('@/lib/db/client');
      this.initialize(db, rawClient);
      console.log('✅ DIContainer auto-initialized successfully');
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
   */
  initialize(db: DbClient, rawClient: postgres.Sql): void {
    if (this.isInitialized) {
      console.warn('DIContainer is already initialized');
      return;
    }

    // Register storage repository
    const fileStorageRepository = new S3FileStorageRepository();
    this.repositories.set('IFileStorageRepository', fileStorageRepository);

    // Register S3 + Arrow + DuckDB services
    const tableQueryService = new DuckDBTableQueryService();
    this.repositories.set('TableQueryService', tableQueryService);


    // Register other repository implementations
    this.repositories.set('IOrganizationRepository', 
      new DrizzleOrganizationRepository(db, rawClient));
    this.repositories.set('IUserRepository', 
      new DrizzleUserRepository(db, rawClient));
    this.repositories.set('IRoleRepository', 
      new DrizzleRoleRepository(db, rawClient));

    // Register team and invitation repositories
    const teamRepository = new DrizzleTeamRepository(db);
    const invitationRepository = new DrizzleInvitationRepository(db);
    this.repositories.set('ITeamRepository', teamRepository);
    this.repositories.set('IInvitationRepository', invitationRepository);
    
    // Register database repository
    const databaseRepository = new DrizzleDatabaseRepository(db);
    this.repositories.set('IDatabaseRepository', databaseRepository);

    // Register agent domain repositories and services
    const agentRepository = new DrizzleAgentRepository(db);
    const roleRepository = new DrizzleRoleRepository(db, rawClient);
    const taskRepository = new DrizzleTaskRepository(db);
    const agentExecutionRepository = new GrpcAgentExecutionRepository(agentRepository);
    const agentTaskApplicationService = new AgentTaskApplicationService(
      agentRepository,
      taskRepository,
      agentExecutionRepository
    );
    const agentApplicationService = new AgentApplicationService(
      agentRepository,
      roleRepository,
      teamRepository
    );
    const teamApplicationService = new TeamApplicationService(
      teamRepository,
      agentRepository
    );

    // Register field repository and services
    const fieldRepository = new DrizzleFieldRepository(db);

    // Create consolidated Arrow table data service
    const arrowTableDataService = new ArrowTableDataService(
      tableQueryService,
      this.repositories.get('IDynamicTableRepository'),
      fieldRepository
    );
        
    // Create table service with consolidated data service
    const tableService = new TableService(
      fieldRepository,
      arrowTableDataService,
      tableQueryService
    );

    // Initialize DatabaseApplicationService with proper dependencies
    const databaseApplicationService = new DatabaseApplicationService(
      tableService,
      fieldRepository,
      this.repositories.get('IOrganizationRepository')
    );
        
    const permissionApplicationService = new PermissionApplicationService(
      this.repositories.get('IRoleRepository'),
      this.repositories.get('IUserRepository')
    );
    const userOrganizationApplicationService = new UserOrganizationApplicationService(
      this.repositories.get('IUserRepository'),
      this.repositories.get('IOrganizationRepository'),
      this.repositories.get('IRoleRepository')
    );
    const invitationApplicationService = new InvitationApplicationService(
      this.repositories.get('IInvitationRepository'),
      this.repositories.get('IUserRepository'),
      this.repositories.get('IOrganizationRepository')
    );

    this.repositories.set('IAgentRepository', agentRepository);
    this.repositories.set('ITaskRepository', taskRepository);
    this.repositories.set('IAgentExecutionRepository', agentExecutionRepository);
    this.repositories.set('AgentTaskApplicationService', agentTaskApplicationService);
    this.repositories.set('AgentApplicationService', agentApplicationService);
    this.repositories.set('TeamApplicationService', teamApplicationService);
    this.repositories.set('DatabaseApplicationService', databaseApplicationService);
    this.repositories.set('PermissionApplicationService', permissionApplicationService);
    this.repositories.set('UserOrganizationApplicationService', userOrganizationApplicationService);
    this.repositories.set('InvitationApplicationService', invitationApplicationService);
    this.repositories.set('IFieldRepository', fieldRepository);
    this.repositories.set('IDynamicTableRepository', tableService);
    
    // Create field schema and table data services
    const fieldSchemaService = new ArrowFieldSchemaService(
      fieldRepository,
      tableService,
      tableQueryService
    );
    // Update the table reference in the consolidated service
    (arrowTableDataService as any).tableRepository = tableService;
    
    this.repositories.set('FieldSchemaService', fieldSchemaService);
    this.repositories.set('TableDataService', arrowTableDataService);
    this.repositories.set('DataStorageService', arrowTableDataService);
    
    // Initialize TableApplicationService with proper dependencies
    const tableApplicationService = new TableApplicationService(
      tableService,
      fieldRepository,
      databaseRepository,
      this.repositories.get('IOrganizationRepository')
    );
    
    // Initialize FieldApplicationService with new services
    const fieldApplicationService = new FieldApplicationService(
      fieldRepository,
      tableService,
      fieldSchemaService,
      arrowTableDataService
    );
    
    // Initialize RowApplicationService with proper dependencies
    const rowApplicationService = new RowApplicationService(
      tableService,
      fieldRepository,
      fileStorageRepository,
      tableQueryService
    );
    
    // Initialize FileApplicationService with proper dependencies  
    const fileApplicationService = new FileApplicationService(
      fileStorageRepository,
      fieldRepository,
      tableService
    );
    
    // Register chat repositories
    const chatRepository = new DrizzleChatRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    this.repositories.set('IChatRepository', chatRepository);
    this.repositories.set('IChatMessageRepository', chatMessageRepository);
    
    // Initialize ChatApplicationService with proper dependencies
    const chatApplicationService = new ChatApplicationService(
      chatRepository,
      chatMessageRepository,
      this.repositories.get('IOrganizationRepository'),
      this.repositories.get('IUserRepository')
    );
    
    this.repositories.set('TableApplicationService', tableApplicationService);
    this.repositories.set('FieldApplicationService', fieldApplicationService);
    this.repositories.set('RowApplicationService', rowApplicationService);
    this.repositories.set('FileApplicationService', fileApplicationService);
    this.repositories.set('ChatApplicationService', chatApplicationService);

    // Initialize RAG domain repositories
    const ragIndexRepository = new DrizzleRagIndexRepository(db);
    const ragDocumentRepository = new DrizzleRagDocumentRepository(db);
    const ragQueryLogRepository = new DrizzleRagQueryLogRepository(db);
    this.repositories.set('IRagIndexRepository', ragIndexRepository);
    this.repositories.set('IRagDocumentRepository', ragDocumentRepository);
    this.repositories.set('IRagQueryLogRepository', ragQueryLogRepository);

    // Initialize RAG application services
    const embeddingService = new EmbeddingService();
    const searchAnalyticsService = new SearchAnalyticsService(ragQueryLogRepository);
    const contentProcessor = new LlamaIndexContentProcessor(embeddingService);
    
    this.repositories.set('EmbeddingService', embeddingService);
    this.repositories.set('SearchAnalyticsService', searchAnalyticsService);
    this.repositories.set('LlamaIndexContentProcessor', contentProcessor);

    // Initialize RAG domain services
    const indexingDomainService = new IndexingDomainService(contentProcessor);
    const searchDomainService = new SearchDomainService(embeddingService, searchAnalyticsService);
    
    this.repositories.set('IndexingDomainService', indexingDomainService);
    this.repositories.set('SearchDomainService', searchDomainService);

    // Initialize RAG use case services
    const ragIndexingApplicationService = new RagIndexingApplicationService(
      ragIndexRepository,
      ragDocumentRepository,
      indexingDomainService,
      this.repositories.get('IOrganizationRepository'),
      agentRepository,
      databaseRepository,
      teamRepository,
    );
    
    const ragSearchApplicationService = new RagSearchApplicationService(
      ragIndexRepository,
      ragDocumentRepository,
      searchDomainService,
      embeddingService,
      searchAnalyticsService
    );
    
    
    this.repositories.set('RagIndexingApplicationService', ragIndexingApplicationService);
    this.repositories.set('RagSearchApplicationService', ragSearchApplicationService);

    this.isInitialized = true;
    console.log('✅ DIContainer initialized with repositories, file storage, agent services, and RAG services');
  }

  /**
   * Get a repository by interface name
   */
  get<K extends keyof RepositoryRegistry>(interfaceName: K): RepositoryRegistry[K] {
    if (!this.isInitialized) {
      throw new Error('DIContainer must be initialized before use. Call initialize() first.');
    }

    const repository = this.repositories.get(interfaceName);
    if (!repository) {
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

// Simplified convenience getters using dynamic function generation
// AIDEV-NOTE: This reduces 125+ lines of repetitive getter functions to ~25 lines

type ServiceMap = {
  // Repositories
  OrganizationRepository: IOrganizationRepository;
  UserRepository: IUserRepository;
  RoleRepository: IRoleRepository;
  DynamicTableRepository: IDynamicTableRepository;
  FileStorageRepository: IFileStorageRepository;
  FieldRepository: IFieldRepository;
  AgentRepository: IAgentRepository;
  TaskRepository: ITaskRepository;
  AgentExecutionRepository: IAgentExecutionRepository;
  TeamRepository: ITeamRepository;
  InvitationRepository: IInvitationRepository;
  DatabaseRepository: IDatabaseRepository;
  ChatRepository: IChatRepository;
  ChatMessageRepository: IChatMessageRepository;
  
  // New data services
  DataStorageService: DataStorageService;
  TableQueryService: TableQueryService;
  FieldSchemaService: FieldSchemaService;
  TableDataService: TableDataService;
  
  // Services
  AgentTaskApplicationService: AgentTaskApplicationService;
  AgentApplicationService: AgentApplicationService;
  TeamApplicationService: TeamApplicationService;
  DatabaseApplicationService: DatabaseApplicationService;
  PermissionApplicationService: PermissionApplicationService;
  UserOrganizationApplicationService: UserOrganizationApplicationService;
  InvitationApplicationService: InvitationApplicationService;
  TableApplicationService: TableApplicationService;
  FieldApplicationService: FieldApplicationService;
  RowApplicationService: RowApplicationService;
  FileApplicationService: FileApplicationService;
  ChatApplicationService: ChatApplicationService;

  // RAG Services
  RagIndexRepository: DrizzleRagIndexRepository;
  RagDocumentRepository: DrizzleRagDocumentRepository;
  RagQueryLogRepository: DrizzleRagQueryLogRepository;
  EmbeddingService: EmbeddingService;
  SearchAnalyticsService: SearchAnalyticsService;
  LlamaIndexContentProcessor: LlamaIndexContentProcessor;
  IndexingDomainService: IIndexingDomainService;
  SearchDomainService: ISearchDomainService;
  RagIndexingApplicationService: RagIndexingApplicationService;
  RagSearchApplicationService: RagSearchApplicationService;
};

// Generate getter functions dynamically
const diContainer = DIContainer.getInstance();
const createGetter = <K extends keyof ServiceMap>(key: K) => (): ServiceMap[K] => {
  // Map simple names to container keys (e.g., 'AgentRepository' -> 'IAgentRepository')
  let containerKey;
  
  // Special mappings for RAG services
  const ragMappings: Record<string, string> = {
    'RagIndexRepository': 'IRagIndexRepository',
    'RagDocumentRepository': 'IRagDocumentRepository', 
    'RagQueryLogRepository': 'IRagQueryLogRepository',
  };
  
  if (ragMappings[key as string]) {
    containerKey = ragMappings[key as string];
  } else if (key.includes('Repository')) {
    containerKey = `I${key}`;
  } else if (key.includes('Service') && !key.includes('ApplicationService')) {
    containerKey = `I${key}`;
  } else {
    containerKey = key;
  }
  return diContainer.get(containerKey as any) as ServiceMap[K];
};

// Export typed getter functions
export const getOrganizationRepository = createGetter('OrganizationRepository');
export const getUserRepository = createGetter('UserRepository');
export const getRoleRepository = createGetter('RoleRepository');
export const getDynamicTableRepository = createGetter('DynamicTableRepository');
export const getDataStorageService = createGetter('DataStorageService');
export const getTableQueryService = createGetter('TableQueryService');
export const getFieldRepository = createGetter('FieldRepository');
export const getFieldSchemaService = createGetter('FieldSchemaService');
export const getTableDataService = createGetter('TableDataService');
export const getFileStorageRepository = createGetter('FileStorageRepository');
export const getAgentRepository = createGetter('AgentRepository');
export const getTaskRepository = createGetter('TaskRepository');
export const getAgentExecutionRepository = createGetter('AgentExecutionRepository');
export const getTeamRepository = createGetter('TeamRepository');
export const getInvitationRepository = createGetter('InvitationRepository');
export const getDatabaseRepository = createGetter('DatabaseRepository');
export const getChatRepository = createGetter('ChatRepository');
export const getChatMessageRepository = createGetter('ChatMessageRepository');
export const getAgentTaskApplicationService = createGetter('AgentTaskApplicationService');
export const getAgentApplicationService = createGetter('AgentApplicationService');
export const getTeamApplicationService = createGetter('TeamApplicationService');
export const getDatabaseApplicationService = createGetter('DatabaseApplicationService');
export const getPermissionApplicationService = createGetter('PermissionApplicationService');
export const getUserOrganizationApplicationService = createGetter('UserOrganizationApplicationService');
export const getInvitationApplicationService = createGetter('InvitationApplicationService');
export const getTableApplicationService = createGetter('TableApplicationService');
export const getFieldApplicationService = createGetter('FieldApplicationService');
export const getRowApplicationService = createGetter('RowApplicationService');
export const getFileApplicationService = createGetter('FileApplicationService');
export const getChatApplicationService = createGetter('ChatApplicationService');

// RAG service getters
export const getRagIndexRepository = createGetter('RagIndexRepository');
export const getRagDocumentRepository = createGetter('RagDocumentRepository');
export const getRagQueryLogRepository = createGetter('RagQueryLogRepository');
export const getEmbeddingService = createGetter('EmbeddingService');
export const getSearchAnalyticsService = createGetter('SearchAnalyticsService');
export const getLlamaIndexContentProcessor = createGetter('LlamaIndexContentProcessor');
export const getIndexingDomainService = createGetter('IndexingDomainService');
export const getSearchDomainService = createGetter('SearchDomainService');
export const getRagIndexingApplicationService = createGetter('RagIndexingApplicationService');
export const getRagSearchApplicationService = createGetter('RagSearchApplicationService');

// Helper to initialize container from existing clients
export function initializeDI(db: DbClient, rawClient: postgres.Sql): void {
  DIContainer.getInstance().initialize(db, rawClient);
}

// Export container instance for direct access if needed
export const container = DIContainer.getInstance();