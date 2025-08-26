import type { DbClient } from '@/lib/db/client';
import type postgres from 'postgres';

import { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { DrizzleOrganizationRepository } from '@/ddd/infrastructure/db/repositories/organizations/drizzle-organization-repository';
import { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import { DrizzleUserRepository } from '@/ddd/infrastructure/db/repositories/users/drizzle-user-repository';
import { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
import { DrizzleRoleRepository } from '@/ddd/infrastructure/db/repositories/roles/drizzle-role-repository';
import { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import { S3TableRepository } from '@/ddd/infrastructure/storage/repositories/s3-table-repository';
import { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service';
import { ArrowDataStorageService } from '@/ddd/infrastructure/data/arrow-data-storage-service';
import { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';
import { DuckDBTableQueryService } from '@/ddd/infrastructure/data/duckdb-table-query-service';
import { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import { S3FileStorageRepository } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { FileFieldService } from '@/ddd/domain/files/services/file-field-service';

// Agent domain imports
import { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { ITaskRepository } from '@/ddd/domain/agents/repositories/task-repository';
import { DrizzleTaskRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-task-repository';
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

// Chat domain imports
import { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import { DrizzleChatRepository } from '@/ddd/infrastructure/db/repositories/chat/drizzle-chat-repository';
import { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import { DrizzleChatMessageRepository } from '@/ddd/infrastructure/db/repositories/chat/drizzle-chat-message-repository';

// Registry of all available repository interfaces and services
interface RepositoryRegistry {
  IOrganizationRepository: IOrganizationRepository;
  IUserRepository: IUserRepository;
  IRoleRepository: IRoleRepository;
  IDynamicTableRepository: IDynamicTableRepository;
  DataStorageService: DataStorageService;
  TableQueryService: TableQueryService;
  IFileStorageRepository: IFileStorageRepository;
  FileFieldService: FileFieldService;
  
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
}

export class DIContainer {
  private static instance: DIContainer;
  private repositories = new Map<string, any>();
  private isInitialized = false;

  private constructor() {}

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
    const dataStorageService = new ArrowDataStorageService();
    const tableQueryService = new DuckDBTableQueryService();
    const s3TableRepository = new S3TableRepository(dataStorageService, tableQueryService);
    
    this.repositories.set('DataStorageService', dataStorageService);
    this.repositories.set('TableQueryService', tableQueryService);
    this.repositories.set('IDynamicTableRepository', s3TableRepository);

    // TODO: FileFieldService needs refactoring for S3 architecture
    // For now, create a placeholder service
    const fileFieldService = {} as any; // Placeholder - needs proper implementation
    this.repositories.set('FileFieldService', fileFieldService);

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
    const taskRepository = new DrizzleTaskRepository();
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
    // TODO: DatabaseApplicationService needs refactoring for S3 architecture
    const databaseApplicationService = {} as any; // Placeholder - needs proper implementation
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
    
    // Initialize TableApplicationService - needs IFieldRepository implementation
    // TODO: IFieldRepository needs to be implemented for S3 architecture
    const fieldRepository = {} as any; // Placeholder for now - IFieldRepository needs S3 implementation
    const tableApplicationService = new TableApplicationService(
      s3TableRepository,
      fieldRepository,
      databaseRepository,
      this.repositories.get('IOrganizationRepository')
    );
    
    // TODO: Other application services need refactoring for S3 architecture
    const fieldApplicationService = {} as any; // Placeholder  
    const rowApplicationService = {} as any; // Placeholder
    const fileApplicationService = {} as any; // Placeholder
    
    // Register chat repositories
    const chatRepository = new DrizzleChatRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    this.repositories.set('IChatRepository', chatRepository);
    this.repositories.set('IChatMessageRepository', chatMessageRepository);
    
    // TODO: ChatApplicationService needs refactoring for S3 architecture
    const chatApplicationService = {} as any; // Placeholder
    
    this.repositories.set('TableApplicationService', tableApplicationService);
    this.repositories.set('FieldApplicationService', fieldApplicationService);
    this.repositories.set('RowApplicationService', rowApplicationService);
    this.repositories.set('FileApplicationService', fileApplicationService);
    this.repositories.set('ChatApplicationService', chatApplicationService);

    this.isInitialized = true;
    console.log('✅ DIContainer initialized with repositories, file storage, and agent services');
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
  
  // Services
  FileFieldService: FileFieldService;
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
};

// Generate getter functions dynamically
const diContainer = DIContainer.getInstance();
const createGetter = <K extends keyof ServiceMap>(key: K) => (): ServiceMap[K] => {
  // Map simple names to container keys (e.g., 'AgentRepository' -> 'IAgentRepository')
  let containerKey;
  if (key.includes('Repository')) {
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
export const getFileStorageRepository = createGetter('FileStorageRepository');
export const getAgentRepository = createGetter('AgentRepository');
export const getTaskRepository = createGetter('TaskRepository');
export const getAgentExecutionRepository = createGetter('AgentExecutionRepository');
export const getTeamRepository = createGetter('TeamRepository');
export const getInvitationRepository = createGetter('InvitationRepository');
export const getDatabaseRepository = createGetter('DatabaseRepository');
export const getChatRepository = createGetter('ChatRepository');
export const getChatMessageRepository = createGetter('ChatMessageRepository');
export const getFileFieldService = createGetter('FileFieldService');
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

// Helper to initialize container from existing clients
export function initializeDI(db: DbClient, rawClient: postgres.Sql): void {
  DIContainer.getInstance().initialize(db, rawClient);
}

// Export container instance for direct access if needed
export const container = DIContainer.getInstance();