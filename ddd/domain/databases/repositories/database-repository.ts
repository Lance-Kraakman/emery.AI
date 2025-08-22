// AIDEV-NOTE: Database repository interface
// Defines data access operations for Database entities

import type { Database } from '../entities/database';

export interface IDatabaseRepository {
  /**
   * Find databases by organization ID
   */
  findByOrganization(organizationId: number): Promise<Database[]>;

  /**
   * Find database by ID
   */
  findById(id: number): Promise<Database | null>;

  /**
   * Find database by slug
   */
  findBySlug(slug: string): Promise<Database | null>;

  /**
   * Check if slug is unique within organization
   */
  isSlugUnique(organizationId: number, slug: string, excludeId?: number): Promise<boolean>;

  /**
   * Save database
   */
  save(database: Database): Promise<void>;

  /**
   * Delete database
   */
  delete(id: number): Promise<void>;

  /**
   * Count databases by organization
   */
  countByOrganization(organizationId: number): Promise<number>;
}