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

// Registry of all available repository interfaces and services
interface RepositoryRegistry {
  IOrganizationRepository: IOrganizationRepository;
  IUserRepository: IUserRepository;
  IRoleRepository: IRoleRepository;
  IDynamicTableRepository: IDynamicTableRepository;
  IFieldRepository: IFieldRepository;
  IFileStorageRepository: IFileStorageRepository;
  FileFieldService: FileFieldService;
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

    this.isInitialized = true;
    console.log('✅ DIContainer initialized with repositories and file storage services');
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

// Helper to initialize container from existing clients
export function initializeDI(db: DbClient, rawClient: postgres.Sql): void {
  DIContainer.getInstance().initialize(db, rawClient);
}

// Export container instance for direct access if needed
export const container = DIContainer.getInstance();