// AIDEV-NOTE: Template repository interface
// Defines the contract for template persistence operations

import type { Template } from '../entities/template';
import type { TemplateId } from '../value-objects/template-id';
import type { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { TemplateEntityType, CreateTemplateCommand, UpdateTemplateCommand } from '../types';

/**
 * Query options for listing templates
 */
export interface ListTemplatesOptions {
  organizationId: number;
  entityType?: TemplateEntityType;
  category?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Template Repository Interface
 *
 * Defines persistence operations for stored templates.
 * Builtin templates are handled separately via the builtin loader.
 */
export interface ITemplateRepository {
  /**
   * Find a template by ID
   */
  findById(id: TemplateId): Promise<Template | null>;

  /**
   * Find templates by organization
   */
  findByOrganization(organizationId: OrganizationId): Promise<Template[]>;

  /**
   * Find templates by organization and entity type
   */
  findByType(organizationId: OrganizationId, entityType: TemplateEntityType): Promise<Template[]>;

  /**
   * Find templates by organization and category
   */
  findByCategory(organizationId: OrganizationId, category: string): Promise<Template[]>;

  /**
   * Find a template by name and type within an organization
   */
  findByNameAndType(
    organizationId: OrganizationId,
    name: string,
    entityType: TemplateEntityType
  ): Promise<Template | null>;

  /**
   * List templates with filtering options
   */
  list(options: ListTemplatesOptions): Promise<Template[]>;

  /**
   * Count templates matching options
   */
  count(options: Omit<ListTemplatesOptions, 'limit' | 'offset'>): Promise<number>;

  /**
   * Create a new template
   */
  create(command: CreateTemplateCommand): Promise<Template>;

  /**
   * Update an existing template
   */
  update(id: TemplateId, updates: UpdateTemplateCommand): Promise<Template>;

  /**
   * Delete a template
   */
  delete(id: TemplateId): Promise<void>;

  /**
   * Check if a template exists
   */
  exists(id: TemplateId): Promise<boolean>;

  /**
   * Check if a template name is unique within an organization for a given type
   */
  isNameUnique(
    organizationId: OrganizationId,
    name: string,
    entityType: TemplateEntityType,
    excludeId?: TemplateId
  ): Promise<boolean>;
}
