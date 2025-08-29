// AIDEV-NOTE: Database repository interface
// Defines data access operations for Database entities

import type { Database } from '../entities/database';
import type { DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface IDatabaseRepository {
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
   * Save database
   */
  save(database: Database): Promise<Database>;

  /**
   * Delete database
   */
  delete(id: DatabaseId): Promise<void>;

  /**
   * Count databases by organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}