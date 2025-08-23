import type { DbClient } from '@/lib/db/client';
import type postgres from 'postgres';

import { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { DrizzleOrganizationRepository } from '@/ddd/infrastructure/db/repositories/organizations/drizzle-organization-repository';
import { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import { DrizzleUserRepository } from '@/ddd/infrastructure/db/repositories/users/drizzle-user-repository';
import { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
import { DrizzleRoleRepository } from '@/ddd/infrastructure/db/repositories/roles/drizzle-role-repository';
import { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import { DrizzleDynamicTableRepository } from '@/ddd/infrastructure/db/repositories/tables/drizzle-dynamic-table-repository';
import { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import { DrizzleFieldRepository } from '@/ddd/infrastructure/db/repositories/fields/drizzle-field-repository';
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
import { AgentTaskApplicationService } from '@/ddd/application/use-cases/agents/agent-task-application-service';
import { AgentApplicationService } from '@/ddd/application/use-cases/agents/agent-application-service';
import { TeamApplicationService } from '@/ddd/application/use-cases/teams/team-application-service';
import { DatabaseApplicationService } from '@/ddd/application/use-cases/database/database-application-service';
import { PermissionApplicationService } from '@/ddd/application/use-cases/permissions/permission-application-service';
import { UserOrganizationApplicationService } from '@/ddd/application/use-cases/user-organizations/user-organization-application-service';
import { InvitationApplicationService } from '@/ddd/application/use-cases/invitations/invitation-application-service';

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
import { TableApplicationService } from '@/ddd/application/use-cases/tables/table-application-service';
import { FieldApplicationService } from '@/ddd/application/use-cases/fields/field-application-service';
import { RowApplicationService } from '@/ddd/application/use-cases/rows/row-application-service';
import { FileApplicationService } from '@/ddd/application/use-cases/files/file-application-service';
import { ChatApplicationService } from '@/ddd/application/use-cases/chat/chat-application-service';

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
  IFieldRepository: IFieldRepository;
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

    // Register service layer (depends on repositories)
    const fieldRepository = new DrizzleFieldRepository(db, rawClient);
    const fileFieldService = new FileFieldService(fieldRepository, fileStorageRepository);
    this.repositories.set('FileFieldService', fileFieldService);

    // Update field repository with file field service
    const fieldRepositoryWithService = new DrizzleFieldRepository(db, rawClient, fileFieldService);
    this.repositories.set('IFieldRepository', fieldRepositoryWithService);

    // Register other repository implementations
    this.repositories.set('IOrganizationRepository', 
      new DrizzleOrganizationRepository(db, rawClient));
    this.repositories.set('IUserRepository', 
      new DrizzleUserRepository(db, rawClient));
    this.repositories.set('IRoleRepository', 
      new DrizzleRoleRepository(db, rawClient));
    this.repositories.set('IDynamicTableRepository', 
      new DrizzleDynamicTableRepository(db, rawClient));

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
    const databaseApplicationService = new DatabaseApplicationService(
      this.repositories.get('IDynamicTableRepository'),
      this.repositories.get('IFieldRepository')
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
    
    // Register new application services for data management
    const tableApplicationService = new TableApplicationService(
      this.repositories.get('IDynamicTableRepository'),
      this.repositories.get('IFieldRepository'),
      this.repositories.get('IDatabaseRepository'),
      this.repositories.get('IOrganizationRepository')
    );
    const fieldApplicationService = new FieldApplicationService(
      this.repositories.get('IFieldRepository'),
      this.repositories.get('IDynamicTableRepository')
    );
    const rowApplicationService = new RowApplicationService(
      this.repositories.get('IDynamicTableRepository'),
      this.repositories.get('IFieldRepository'),
      this.repositories.get('IFileStorageRepository'),
      this.repositories.get('FileFieldService')
    );
    const fileApplicationService = new FileApplicationService(
      this.repositories.get('FileFieldService'),
      this.repositories.get('IFileStorageRepository'),
      this.repositories.get('IFieldRepository'),
      this.repositories.get('IDynamicTableRepository')
    );
    
    // Register chat repositories
    const chatRepository = new DrizzleChatRepository(db);
    const chatMessageRepository = new DrizzleChatMessageRepository(db);
    this.repositories.set('IChatRepository', chatRepository);
    this.repositories.set('IChatMessageRepository', chatMessageRepository);
    
    const chatApplicationService = new ChatApplicationService(
      chatRepository,
      chatMessageRepository,
      this.repositories.get('IDynamicTableRepository'),
      this.repositories.get('IAgentRepository') // Add agent repository for domain support
    );
    
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

// Convenience functions for common usage patterns

/**
 * Get the organization repository
 */
export function getOrganizationRepository(): IOrganizationRepository {
  return DIContainer.getInstance().get('IOrganizationRepository');
}

/**
 * Get the user repository
 */
export function getUserRepository(): IUserRepository {
  return DIContainer.getInstance().get('IUserRepository');
}

/**
 * Get the role repository
 */
export function getRoleRepository(): IRoleRepository {
  return DIContainer.getInstance().get('IRoleRepository');
}

/**
 * Get the dynamic table repository
 */
export function getDynamicTableRepository(): IDynamicTableRepository {
  return DIContainer.getInstance().get('IDynamicTableRepository');
}

/**
 * Get the field repository
 */
export function getFieldRepository(): IFieldRepository {
  return DIContainer.getInstance().get('IFieldRepository');
}

/**
 * Get the file storage repository
 */
export function getFileStorageRepository(): IFileStorageRepository {
  return DIContainer.getInstance().get('IFileStorageRepository');
}

/**
 * Get the file field service
 */
export function getFileFieldService(): FileFieldService {
  return DIContainer.getInstance().get('FileFieldService');
}

/**
 * Get the agent repository
 */
export function getAgentRepository(): IAgentRepository {
  return DIContainer.getInstance().get('IAgentRepository');
}

/**
 * Get the task repository
 */
export function getTaskRepository(): ITaskRepository {
  return DIContainer.getInstance().get('ITaskRepository');
}

/**
 * Get the agent execution repository
 */
export function getAgentExecutionRepository(): IAgentExecutionRepository {
  return DIContainer.getInstance().get('IAgentExecutionRepository');
}

/**
 * Get the agent task application service
 */
export function getAgentTaskApplicationService(): AgentTaskApplicationService {
  return DIContainer.getInstance().get('AgentTaskApplicationService');
}

/**
 * Get the agent application service
 */
export function getAgentApplicationService(): AgentApplicationService {
  return DIContainer.getInstance().get('AgentApplicationService');
}

/**
 * Get the team application service
 */
export function getTeamApplicationService(): TeamApplicationService {
  return DIContainer.getInstance().get('TeamApplicationService');
}

/**
 * Get the database application service
 */
export function getDatabaseApplicationService(): DatabaseApplicationService {
  return DIContainer.getInstance().get('DatabaseApplicationService');
}

/**
 * Get the permission application service
 */
export function getPermissionApplicationService(): PermissionApplicationService {
  return DIContainer.getInstance().get('PermissionApplicationService');
}

/**
 * Get the user organization application service
 */
export function getUserOrganizationApplicationService(): UserOrganizationApplicationService {
  return DIContainer.getInstance().get('UserOrganizationApplicationService');
}

/**
 * Get the invitation application service
 */
export function getInvitationApplicationService(): InvitationApplicationService {
  return DIContainer.getInstance().get('InvitationApplicationService');
}

/**
 * Get the table application service
 */
export function getTableApplicationService(): TableApplicationService {
  return DIContainer.getInstance().get('TableApplicationService');
}

/**
 * Get the field application service
 */
export function getFieldApplicationService(): FieldApplicationService {
  return DIContainer.getInstance().get('FieldApplicationService');
}

/**
 * Get the row application service
 */
export function getRowApplicationService(): RowApplicationService {
  return DIContainer.getInstance().get('RowApplicationService');
}

/**
 * Get the file application service
 */
export function getFileApplicationService(): FileApplicationService {
  return DIContainer.getInstance().get('FileApplicationService');
}

/**
 * Get the chat repository
 */
export function getChatRepository(): IChatRepository {
  return DIContainer.getInstance().get('IChatRepository');
}

/**
 * Get the chat message repository
 */
export function getChatMessageRepository(): IChatMessageRepository {
  return DIContainer.getInstance().get('IChatMessageRepository');
}

/**
 * Get the chat application service
 */
export function getChatApplicationService(): ChatApplicationService {
  return DIContainer.getInstance().get('ChatApplicationService');
}

/**
 * Get the database repository
 */
export function getDatabaseRepository(): IDatabaseRepository {
  return DIContainer.getInstance().get('IDatabaseRepository');
}

// Helper to initialize container from existing clients
export function initializeDI(db: DbClient, rawClient: postgres.Sql): void {
  DIContainer.getInstance().initialize(db, rawClient);
}

// Export container instance for direct access if needed
export const container = DIContainer.getInstance();