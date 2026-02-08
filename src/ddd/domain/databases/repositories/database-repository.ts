// AIDEV-NOTE: Database repository interface
// Defines data access operations for Database entities

import type { Database } from '../entities/database';
import type { DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';

// Data transfer objects for repository operations
export interface CreateDatabaseData {
  name: string;
  slug: string;
  metadata?: Record<string, any> | null;
  organizationId: number;
  ownerId: string;
  agentId?: number | null; // null = org-scoped, set = agent-scoped
}

export interface UpdateDatabaseData {
  name?: string;
  slug?: string;
  metadata?: Record<string, any> | null;
}

export interface IDatabaseRepository {
  /**
   * Create a new database
   */
  create(data: CreateDatabaseData): Promise<Database>;

  /**
   * Update an existing database
   */
  update(id: DatabaseId, data: UpdateDatabaseData): Promise<Database>;

  /**
   * Find databases by organization ID
   */
  findByOrganization(organizationId: OrganizationId): Promise<Database[]>;

  /**
   * Find database by ID
   */
  findById(id: DatabaseId): Promise<Database | null>;

  /**
   * Find database by slug
   */
  findBySlug(slug: string): Promise<Database | null>;

  /**
   * Check if slug is unique within organization
   */
  isSlugUnique(organizationId: OrganizationId, slug: string, excludeId?: DatabaseId): Promise<boolean>;

  /**
   * Delete database
   */
  delete(id: DatabaseId): Promise<void>;

  /**
   * Count databases by organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;

  /**
   * Update the agent that owns this database
   * @param id - Database ID
   * @param agentId - Agent ID to assign, or null for org-level
   */
  updateAgent(id: DatabaseId, agentId: number | null): Promise<Database>;
}