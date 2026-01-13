/**
 * Base Repository Interfaces
 *
 * Provides common CRUD interfaces that can be extended by domain-specific repositories.
 * This reduces duplication across 23+ repository interfaces while maintaining type safety.
 *
 * AIDEV-NOTE: These interfaces use generics to allow each repository to specify its own:
 * - Entity type (T)
 * - ID type (ID)
 * - CreateData type
 * - UpdateData type
 *
 * Repositories should extend the appropriate base interface and add domain-specific methods.
 */

import type { OrganizationId, UserId } from '../value-objects';

/**
 * Base CRUD repository interface
 *
 * Provides the foundational methods that all repositories need:
 * - findById: Retrieve a single entity
 * - create: Create a new entity
 * - update: Update an existing entity
 * - delete: Remove an entity
 * - exists: Check if an entity exists
 *
 * @typeParam T - The entity type
 * @typeParam ID - The ID value object type
 * @typeParam CreateData - The data type for creating entities
 * @typeParam UpdateData - The data type for updating entities
 *
 * @example
 * ```ts
 * interface IAgentRepository extends IBaseCRUDRepository<Agent, AgentId, CreateAgentData, UpdateAgentData> {
 *   // Domain-specific methods
 *   findActiveByOrganization(orgId: OrganizationId): Promise<Agent[]>;
 * }
 * ```
 */
export interface IBaseCRUDRepository<T, ID, CreateData, UpdateData> {
  /**
   * Find an entity by its ID
   * @param id - The entity ID
   * @returns The entity or null if not found
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Create a new entity
   * @param data - The data for creating the entity
   * @returns The created entity
   */
  create(data: CreateData): Promise<T>;

  /**
   * Update an existing entity
   * @param id - The entity ID
   * @param data - The data for updating the entity
   * @returns The updated entity
   */
  update(id: ID, data: UpdateData): Promise<T>;

  /**
   * Delete an entity by its ID
   * @param id - The entity ID
   */
  delete(id: ID): Promise<void>;

  /**
   * Check if an entity exists
   * @param id - The entity ID
   * @returns True if the entity exists
   */
  exists(id: ID): Promise<boolean>;
}

/**
 * Organization-scoped repository interface
 *
 * Extends base CRUD with organization-based querying.
 * Use this for entities that belong to an organization (most entities).
 *
 * @typeParam T - The entity type
 * @typeParam ID - The ID value object type
 * @typeParam CreateData - The data type for creating entities
 * @typeParam UpdateData - The data type for updating entities
 *
 * @example
 * ```ts
 * interface IDatabaseRepository extends IOrganizationScopedRepository<Database, DatabaseId, CreateDatabaseData, UpdateDatabaseData> {
 *   findBySlug(slug: string): Promise<Database | null>;
 * }
 * ```
 */
export interface IOrganizationScopedRepository<T, ID, CreateData, UpdateData>
  extends IBaseCRUDRepository<T, ID, CreateData, UpdateData> {
  /**
   * Find all entities for an organization
   * @param organizationId - The organization ID
   * @returns Array of entities belonging to the organization
   */
  findByOrganizationId(organizationId: OrganizationId): Promise<T[]>;

  /**
   * Count entities for an organization
   * @param organizationId - The organization ID
   * @returns Count of entities
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}

/**
 * Owner-scoped repository interface
 *
 * Extends organization-scoped with user/owner-based querying.
 * Use this for entities that have an owner within an organization (e.g., agents, skills).
 *
 * @typeParam T - The entity type
 * @typeParam ID - The ID value object type
 * @typeParam CreateData - The data type for creating entities
 * @typeParam UpdateData - The data type for updating entities
 *
 * @example
 * ```ts
 * interface IAgentRepository extends IOwnerScopedRepository<Agent, AgentId, CreateAgentData, UpdateAgentData> {
 *   findActiveByOrganization(orgId: OrganizationId): Promise<Agent[]>;
 *   isNameUnique(orgId: OrganizationId, name: string): Promise<boolean>;
 * }
 * ```
 */
export interface IOwnerScopedRepository<T, ID, CreateData, UpdateData>
  extends IOrganizationScopedRepository<T, ID, CreateData, UpdateData> {
  /**
   * Find all entities owned by a user
   * @param ownerId - The owner's user ID
   * @param organizationId - Optional organization filter
   * @returns Array of entities owned by the user
   */
  findByOwnerId(ownerId: UserId, organizationId?: OrganizationId): Promise<T[]>;
}

/**
 * Agent-scoped repository interface
 *
 * Extends organization-scoped with agent-based querying.
 * Use this for entities that can belong to either an organization or specific agent.
 *
 * @typeParam T - The entity type
 * @typeParam ID - The ID value object type
 * @typeParam CreateData - The data type for creating entities
 * @typeParam UpdateData - The data type for updating entities
 */
export interface IAgentScopedRepository<T, ID, CreateData, UpdateData>
  extends IOrganizationScopedRepository<T, ID, CreateData, UpdateData> {
  /**
   * Find all entities for a specific agent
   * @param agentId - The agent ID
   * @returns Array of entities belonging to the agent
   */
  findByAgentId(agentId: import('../value-objects').AgentId): Promise<T[]>;

  /**
   * Delete all entities for an agent
   * @param agentId - The agent ID
   */
  deleteByAgentId(agentId: import('../value-objects').AgentId): Promise<void>;

  /**
   * Count entities for an agent
   * @param agentId - The agent ID
   * @returns Count of entities
   */
  countByAgentId(agentId: import('../value-objects').AgentId): Promise<number>;
}

/**
 * Read-only repository interface
 *
 * For repositories that don't support mutations (e.g., audit logs, analytics).
 *
 * @typeParam T - The entity type
 * @typeParam ID - The ID value object type
 */
export interface IReadOnlyRepository<T, ID> {
  /**
   * Find an entity by its ID
   * @param id - The entity ID
   * @returns The entity or null if not found
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Check if an entity exists
   * @param id - The entity ID
   * @returns True if the entity exists
   */
  exists(id: ID): Promise<boolean>;
}
