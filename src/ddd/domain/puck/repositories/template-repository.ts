// AIDEV-NOTE: Template repository interface - defines data access contract
// Implementation will be in infrastructure layer using Drizzle

import type { Template } from '../entities/template';
import type { TemplateId } from '../value-objects/template-id';
import type { AppId } from '../value-objects/app-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface ITemplateRepository {
  /**
   * Find a template by its ID
   */
  findById(id: TemplateId): Promise<Template | null>;

  /**
   * Find all templates for an organization (org-wide + app-specific for accessible apps)
   */
  findByOrganization(organizationId: OrganizationId): Promise<Template[]>;

  /**
   * Find org-wide templates only (no app-specific)
   */
  findOrgWide(organizationId: OrganizationId): Promise<Template[]>;

  /**
   * Find templates for a specific app (includes org-wide templates)
   */
  findByApp(organizationId: OrganizationId, appId: AppId): Promise<Template[]>;

  /**
   * Find templates by category
   */
  findByCategory(organizationId: OrganizationId, category: string): Promise<Template[]>;

  /**
   * Create a new template
   */
  create(template: Template): Promise<Template>;

  /**
   * Update an existing template
   */
  update(template: Template): Promise<Template>;

  /**
   * Delete a template
   */
  delete(id: TemplateId): Promise<void>;

  /**
   * Count templates for an organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}
