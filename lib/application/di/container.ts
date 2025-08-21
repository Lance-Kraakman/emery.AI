import type { DbClient } from '../../db/client';
import type postgres from 'postgres';

import { IOrganizationRepository } from '../../domain/repositories/organization-repository';
import { DrizzleOrganizationRepository } from '../../infrastructure/db/repositories/drizzle-organization-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { DrizzleUserRepository } from '../../infrastructure/db/repositories/drizzle-user-repository';
import { IRoleRepository } from '../../domain/repositories/role-repository';
import { DrizzleRoleRepository } from '../../infrastructure/db/repositories/drizzle-role-repository';
import { IDynamicTableRepository } from '../../domain/repositories/dynamic-table-repository';
import { DrizzleDynamicTableRepository } from '../../infrastructure/db/repositories/drizzle-dynamic-table-repository';
import { IFieldRepository } from '../../domain/repositories/field-repository';
import { DrizzleFieldRepository } from '../../infrastructure/db/repositories/drizzle-field-repository';

// Registry of all available repository interfaces
interface RepositoryRegistry {
  IOrganizationRepository: IOrganizationRepository;
  IUserRepository: IUserRepository;
  IRoleRepository: IRoleRepository;
  IDynamicTableRepository: IDynamicTableRepository;
  IFieldRepository: IFieldRepository;
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

    // Register repository implementations
    this.repositories.set('IOrganizationRepository', 
      new DrizzleOrganizationRepository(db, rawClient));
    this.repositories.set('IUserRepository', 
      new DrizzleUserRepository(db, rawClient));
    this.repositories.set('IRoleRepository', 
      new DrizzleRoleRepository(db, rawClient));
    this.repositories.set('IDynamicTableRepository', 
      new DrizzleDynamicTableRepository(db, rawClient));
    this.repositories.set('IFieldRepository', 
      new DrizzleFieldRepository(db, rawClient));

    this.isInitialized = true;
    console.log('✅ DIContainer initialized with repositories');
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

// Helper to initialize container from existing clients
export function initializeDI(db: DbClient, rawClient: postgres.Sql): void {
  DIContainer.getInstance().initialize(db, rawClient);
}

// Export container instance for direct access if needed
export const container = DIContainer.getInstance();