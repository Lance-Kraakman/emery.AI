// AIDEV-NOTE: PuckApp repository interface - defines data access contract
// Implementation will be in infrastructure layer using Drizzle

import type { PuckApp } from '../entities/puck-app';
import type { AppId } from '../value-objects/app-id';
import type { AppSlug } from '../value-objects/app-slug';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface IPuckAppRepository {
  /**
   * Find an app by its ID
   */
  findById(id: AppId): Promise<PuckApp | null>;

  /**
   * Find all apps for an organization
   */
  findByOrganization(organizationId: OrganizationId): Promise<PuckApp[]>;

  /**
   * Find an app by slug within an organization
   */
  findBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<PuckApp | null>;

  /**
   * Check if a slug exists within an organization
   */
  existsBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<boolean>;

  /**
   * Create a new app
   */
  create(app: PuckApp): Promise<PuckApp>;

  /**
   * Update an existing app
   */
  update(app: PuckApp): Promise<PuckApp>;

  /**
   * Delete an app (cascade deletes pages)
   */
  delete(id: AppId): Promise<void>;

  /**
   * Count apps for an organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}
