// AIDEV-NOTE: App repository interface - defines data access contract
// Implementation will be in infrastructure layer using Drizzle
// Puck is just the visual page builder implementation detail

import type { App } from '../entities/app';
import type { AppId } from '../value-objects/app-id';
import type { AppSlug } from '../value-objects/app-slug';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

// DTO for apps with their pages (for sidebar - lightweight)
export interface SidebarAppDTO {
  id: number;
  name: string;
  slug: string;
  pages: {
    id: number;
    name: string;
    slug: string;
    order: number;
  }[];
}

export interface IAppRepository {
  /**
   * Find an app by its ID
   */
  findById(id: AppId): Promise<App | null>;

  /**
   * Find all apps for an organization
   */
  findByOrganization(organizationId: OrganizationId): Promise<App[]>;

  /**
   * Find an app by slug within an organization
   */
  findBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<App | null>;

  /**
   * Check if a slug exists within an organization
   */
  existsBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<boolean>;

  /**
   * Create a new app
   */
  create(app: App): Promise<App>;

  /**
   * Update an existing app
   */
  update(app: App): Promise<App>;

  /**
   * Delete an app (cascade deletes pages)
   */
  delete(id: AppId): Promise<void>;

  /**
   * Count apps for an organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;

  /**
   * Find all apps for an organization with their pages (for sidebar)
   * Single query with JOIN - avoids N+1 problem
   */
  findByOrganizationWithPages(organizationId: OrganizationId): Promise<SidebarAppDTO[]>;
}
