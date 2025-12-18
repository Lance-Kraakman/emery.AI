// AIDEV-NOTE: Template Application Service - orchestrates template operations
// Handles business logic, validation, and coordination between domain and infrastructure
// Manages both organization-wide templates and app-specific templates

import type { ITemplateRepository } from '@/ddd/domain/puck/repositories/template-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { Template } from '@/ddd/domain/puck/entities/template';
import { TemplateId } from '@/ddd/domain/puck/value-objects/template-id';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('TemplateApplicationService');

// Command DTOs
export interface CreateTemplateCommand {
  name: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  data: any[];
  variants?: any[];
  organizationId: OrganizationId;
  appId?: AppId | null;
  createdBy: UserId;
}

export interface UpdateTemplateCommand {
  id: TemplateId;
  name?: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  data?: any[];
  variants?: any[];
  updatedBy: UserId;
}

// Response DTOs
export interface TemplateWithAppDTO {
  template: Template;
  appName?: string;
}

export class TemplateApplicationService {
  constructor(
    private readonly templateRepository: ITemplateRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  /**
   * Get all templates for an organization
   * Includes both org-wide templates and global system templates
   */
  async getTemplatesForOrganization(organizationId: OrganizationId): Promise<Result<Template[]>> {
    try {
      // Verify organization exists
      const org = await this.organizationRepository.findById(organizationId);
      if (!org) {
        return ResultHelpers.failure('Organization not found');
      }

      const templates = await this.templateRepository.findByOrganization(organizationId);
      
      logger.summary('Retrieved templates for organization', { 
        organizationId: organizationId.value, 
        count: templates.length 
      });

      return ResultHelpers.success(templates);
    } catch (error) {
      logger.error('Failed to get templates for organization', { 
        organizationId: organizationId.value, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to retrieve templates');
    }
  }

  /**
   * Get templates for a specific app
   * Includes app-specific templates, org-wide templates, and global system templates
   */
  async getTemplatesForApp(organizationId: OrganizationId, appId: AppId): Promise<Result<Template[]>> {
    try {
      // Verify organization exists
      const org = await this.organizationRepository.findById(organizationId);
      if (!org) {
        return ResultHelpers.failure('Organization not found');
      }

      const templates = await this.templateRepository.findByApp(organizationId, appId);
      
      logger.summary('Retrieved templates for app', { 
        organizationId: organizationId.value, 
        appId: appId.value,
        count: templates.length 
      });

      return ResultHelpers.success(templates);
    } catch (error) {
      logger.error('Failed to get templates for app', { 
        organizationId: organizationId.value, 
        appId: appId.value,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to retrieve templates');
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: TemplateId): Promise<Result<Template>> {
    try {
      const template = await this.templateRepository.findById(templateId);
      
      if (!template) {
        return ResultHelpers.failure('Template not found');
      }

      logger.summary('Retrieved template', { 
        templateId: templateId.value,
        isSystem: template.isSystem,
        name: template.name
      });

      return ResultHelpers.success(template);
    } catch (error) {
      logger.error('Failed to get template', { 
        templateId: templateId.value,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to retrieve template');
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(organizationId: OrganizationId, category: string): Promise<Result<Template[]>> {
    try {
      // Verify organization exists
      const org = await this.organizationRepository.findById(organizationId);
      if (!org) {
        return ResultHelpers.failure('Organization not found');
      }

      if (!category || category.trim() === '') {
        return ResultHelpers.failure('Category is required');
      }

      const templates = await this.templateRepository.findByCategory(organizationId, category);
      
      logger.summary('Retrieved templates by category', { 
        organizationId: organizationId.value, 
        category,
        count: templates.length 
      });

      return ResultHelpers.success(templates);
    } catch (error) {
      logger.error('Failed to get templates by category', { 
        organizationId: organizationId.value, 
        category,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to retrieve templates by category');
    }
  }

  /**
   * Create a new template
   * System templates cannot be created through this method
   */
  async createTemplate(command: CreateTemplateCommand): Promise<Result<Template>> {
    try {
      // Verify organization exists
      const org = await this.organizationRepository.findById(command.organizationId);
      if (!org) {
        return ResultHelpers.failure('Organization not found');
      }

      // Validation
      if (!command.name || command.name.trim() === '') {
        return ResultHelpers.failure('Template name is required');
      }

      if (!command.data) {
        return ResultHelpers.failure('Template data is required');
      }

      // Create template entity (always non-system for user-created templates)
      const template = Template.create({
        name: command.name,
        description: command.description,
        category: command.category,
        thumbnailUrl: command.thumbnailUrl,
        data: command.data,
        variants: command.variants || [],
        organizationId: command.organizationId,
        appId: command.appId,
        createdBy: command.createdBy
      });

      const created = await this.templateRepository.create(template);

      logger.summary('Created template', { 
        templateId: created.id.value,
        name: created.name,
        organizationId: command.organizationId.value,
        appId: command.appId?.value
      });

      return ResultHelpers.success(created);
    } catch (error) {
      logger.error('Failed to create template', { 
        command,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to create template');
    }
  }

  /**
   * Update an existing template
   * System templates cannot be updated
   */
  async updateTemplate(command: UpdateTemplateCommand): Promise<Result<Template>> {
    try {
      // Get existing template
      const existing = await this.templateRepository.findById(command.id);
      if (!existing) {
        return ResultHelpers.failure('Template not found');
      }

      // Prevent updating system templates
      if (existing.isSystem) {
        return ResultHelpers.failure('System templates cannot be updated');
      }

      // Update fields
      if (command.name !== undefined) {
        if (command.name.trim() === '') {
          return ResultHelpers.failure('Template name cannot be empty');
        }
        existing.updateName(command.name);
      }

      if (command.description !== undefined) {
        existing.updateDescription(command.description);
      }

      if (command.category !== undefined) {
        existing.updateCategory(command.category);
      }

      if (command.thumbnailUrl !== undefined) {
        existing.updateThumbnailUrl(command.thumbnailUrl);
      }

      if (command.data !== undefined) {
        if (!command.data) {
          return ResultHelpers.failure('Template data cannot be empty');
        }
        existing.updateData(command.data);
      }

      if (command.variants !== undefined) {
        existing.updateVariants(command.variants);
      }

      const updated = await this.templateRepository.update(existing);

      logger.summary('Updated template', { 
        templateId: updated.id.value,
        name: updated.name,
        updatedBy: command.updatedBy.value
      });

      return ResultHelpers.success(updated);
    } catch (error) {
      logger.error('Failed to update template', { 
        templateId: command.id.value,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to update template');
    }
  }

  /**
   * Delete a template
   * System templates cannot be deleted
   */
  async deleteTemplate(templateId: TemplateId): Promise<Result<void>> {
    try {
      // Get template for validation
      const existing = await this.templateRepository.findById(templateId);
      if (!existing) {
        return ResultHelpers.failure('Template not found');
      }

      // Prevent deleting system templates
      if (existing.isSystem) {
        return ResultHelpers.failure('System templates cannot be deleted');
      }

      await this.templateRepository.delete(templateId);

      logger.summary('Deleted template', { 
        templateId: templateId.value,
        name: existing.name
      });

      return ResultHelpers.success(undefined);
    } catch (error) {
      logger.error('Failed to delete template', { 
        templateId: templateId.value,
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to delete template');
    }
  }

  /**
   * Get organization-wide templates (not app-specific)
   */
  async getOrgWideTemplates(organizationId: OrganizationId): Promise<Result<Template[]>> {
    try {
      // Verify organization exists
      const org = await this.organizationRepository.findById(organizationId);
      if (!org) {
        return ResultHelpers.failure('Organization not found');
      }

      const templates = await this.templateRepository.findOrgWide(organizationId);
      
      logger.summary('Retrieved org-wide templates', { 
        organizationId: organizationId.value, 
        count: templates.length 
      });

      return ResultHelpers.success(templates);
    } catch (error) {
      logger.error('Failed to get org-wide templates', { 
        organizationId: organizationId.value, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to retrieve org-wide templates');
    }
  }

  /**
   * Count templates for an organization
   */
  async countTemplates(organizationId: OrganizationId): Promise<Result<number>> {
    try {
      const count = await this.templateRepository.countByOrganization(organizationId);
      
      logger.summary('Counted templates for organization', { 
        organizationId: organizationId.value, 
        count 
      });

      return ResultHelpers.success(count);
    } catch (error) {
      logger.error('Failed to count templates', { 
        organizationId: organizationId.value, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return ResultHelpers.failure('Failed to count templates');
    }
  }
}