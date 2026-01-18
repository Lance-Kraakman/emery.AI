// AIDEV-NOTE: Template Application Service
// Orchestrates template-related use cases including CRUD, export, import, and apply operations

import type { ITemplateRepository, ListTemplatesOptions } from '@/ddd/domain/templates/repositories/template-repository';
import type { Template } from '@/ddd/domain/templates/entities/template';
import { TemplateId } from '@/ddd/domain/templates/value-objects/template-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import type { Result } from '@/ddd/domain/shared/result';
import type {
  BrainTemplate,
  TemplateEntityType,
  TemplateDTO,
  CreateTemplateCommand,
  UpdateTemplateCommand,
  BuiltinTemplateInfo,
  SkillTemplateData,
  TemplateContent
} from '@/ddd/domain/templates/types';
import {
  getBuiltinTemplate,
  getBuiltinTemplatesByType,
  getBuiltinTemplateInfo,
  getBuiltinTemplateInfoByType,
  builtinTemplateExists
} from '@/lib/templates/builtin';
import { isBrainTemplate, isSkillTemplateData } from '@/ddd/domain/templates/types';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('TemplateService');

/**
 * Template Application Service
 *
 * Handles template operations including:
 * - CRUD operations for stored templates
 * - Loading builtin templates
 * - Exporting entities as templates
 * - Importing .brain files
 * - Applying templates to create entities
 */
export class TemplateApplicationService {
  constructor(
    private templateRepository: ITemplateRepository
  ) {
    logger.debug('[TemplateApplicationService] initialized');
  }

  // ==========================================================================
  // BUILTIN TEMPLATES
  // ==========================================================================

  /**
   * Get all builtin templates
   */
  getBuiltinTemplates(): BrainTemplate[] {
    return getBuiltinTemplatesByType('skill')
      .concat(getBuiltinTemplatesByType('database'))
      .concat(getBuiltinTemplatesByType('agent'))
      .concat(getBuiltinTemplatesByType('table'))
      .concat(getBuiltinTemplatesByType('app'))
      .concat(getBuiltinTemplatesByType('organization'))
      .concat(getBuiltinTemplatesByType('org_section'));
  }

  /**
   * Get builtin templates by entity type
   */
  getBuiltinTemplatesByType(entityType: TemplateEntityType): BrainTemplate[] {
    return getBuiltinTemplatesByType(entityType);
  }

  /**
   * Get builtin template by ID
   */
  getBuiltinTemplate(builtinId: string): BrainTemplate | null {
    return getBuiltinTemplate(builtinId);
  }

  /**
   * Get all builtin template info (metadata only)
   */
  getBuiltinTemplateInfo(): BuiltinTemplateInfo[] {
    return getBuiltinTemplateInfo();
  }

  /**
   * Get builtin template info by type
   */
  getBuiltinTemplateInfoByType(entityType: TemplateEntityType): BuiltinTemplateInfo[] {
    return getBuiltinTemplateInfoByType(entityType);
  }

  // ==========================================================================
  // STORED TEMPLATES CRUD
  // ==========================================================================

  /**
   * Create a new template
   */
  async createTemplate(command: CreateTemplateCommand): Promise<Result<Template>> {
    try {
      logger.debug('[TemplateApplicationService] createTemplate', {
        organizationId: command.organizationId,
        name: command.name,
        entityType: command.entityType
      });

      const template = await this.templateRepository.create(command);

      logger.debug('[TemplateApplicationService] template created', {
        templateId: template.id.value
      });

      return { success: true, data: template };
    } catch (error) {
      logger.error('[TemplateApplicationService] createTemplate error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create template' };
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: number,
    updates: UpdateTemplateCommand
  ): Promise<Result<Template>> {
    try {
      logger.debug('[TemplateApplicationService] updateTemplate', {
        templateId,
        updates
      });

      const id = TemplateId.fromNumber(templateId);
      const template = await this.templateRepository.update(id, updates);

      logger.debug('[TemplateApplicationService] template updated', { templateId });

      return { success: true, data: template };
    } catch (error) {
      logger.error('[TemplateApplicationService] updateTemplate error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update template' };
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: number): Promise<Result<void>> {
    try {
      logger.debug('[TemplateApplicationService] deleteTemplate', { templateId });

      const id = TemplateId.fromNumber(templateId);
      await this.templateRepository.delete(id);

      logger.debug('[TemplateApplicationService] template deleted', { templateId });

      return { success: true };
    } catch (error) {
      logger.error('[TemplateApplicationService] deleteTemplate error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete template' };
    }
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: number): Promise<Result<Template>> {
    try {
      const id = TemplateId.fromNumber(templateId);
      const template = await this.templateRepository.findById(id);

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      return { success: true, data: template };
    } catch (error) {
      logger.error('[TemplateApplicationService] getTemplate error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get template' };
    }
  }

  /**
   * List templates with filtering
   */
  async listTemplates(options: ListTemplatesOptions): Promise<Result<Template[]>> {
    try {
      const templates = await this.templateRepository.list(options);
      return { success: true, data: templates };
    } catch (error) {
      logger.error('[TemplateApplicationService] listTemplates error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list templates' };
    }
  }

  /**
   * Get templates by organization
   */
  async getTemplatesByOrganization(organizationId: number): Promise<Result<Template[]>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const templates = await this.templateRepository.findByOrganization(orgId);
      return { success: true, data: templates };
    } catch (error) {
      logger.error('[TemplateApplicationService] getTemplatesByOrganization error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get templates' };
    }
  }

  /**
   * Get templates by type
   */
  async getTemplatesByType(
    organizationId: number,
    entityType: TemplateEntityType
  ): Promise<Result<Template[]>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const templates = await this.templateRepository.findByType(orgId, entityType);
      return { success: true, data: templates };
    } catch (error) {
      logger.error('[TemplateApplicationService] getTemplatesByType error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get templates' };
    }
  }

  // ==========================================================================
  // IMPORT / EXPORT
  // ==========================================================================

  /**
   * Import a template from a .brain file content
   */
  async importTemplate(
    organizationId: number,
    ownerId: string,
    brainFileContent: string
  ): Promise<Result<Template>> {
    try {
      logger.debug('[TemplateApplicationService] importTemplate', {
        organizationId,
        contentLength: brainFileContent.length
      });

      // Parse the JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(brainFileContent);
      } catch {
        return { success: false, error: 'Invalid JSON format' };
      }

      // Validate it's a BrainTemplate
      if (!isBrainTemplate(parsed)) {
        return { success: false, error: 'Invalid template format. Expected $format: "brain-template" and $version: 1' };
      }

      const brainTemplate = parsed as BrainTemplate;

      // Create the template
      const template = await this.templateRepository.create({
        organizationId,
        ownerId,
        name: brainTemplate.metadata.name,
        description: brainTemplate.metadata.description,
        category: brainTemplate.metadata.category,
        tags: brainTemplate.metadata.tags,
        entityType: brainTemplate.template.type,
        templateData: brainTemplate.template,
        version: brainTemplate.metadata.version,
        isBuiltin: false,
        sourceBuiltinId: undefined
      });

      logger.debug('[TemplateApplicationService] template imported', {
        templateId: template.id.value
      });

      return { success: true, data: template };
    } catch (error) {
      logger.error('[TemplateApplicationService] importTemplate error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to import template' };
    }
  }

  /**
   * Export a stored template as a BrainTemplate JSON
   */
  async exportTemplate(templateId: number): Promise<Result<BrainTemplate>> {
    try {
      const id = TemplateId.fromNumber(templateId);
      const template = await this.templateRepository.findById(id);

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const brainTemplate: BrainTemplate = {
        $format: 'brain-template',
        $version: 1,
        metadata: {
          name: template.name,
          description: template.description,
          category: template.category || undefined,
          tags: template.tags,
          version: template.version
        },
        template: template.templateData,
        exportedAt: new Date().toISOString(),
        exportedFrom: {
          appVersion: process.env.npm_package_version
        }
      };

      return { success: true, data: brainTemplate };
    } catch (error) {
      logger.error('[TemplateApplicationService] exportTemplate error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to export template' };
    }
  }

  /**
   * Export a builtin template as BrainTemplate
   */
  exportBuiltinTemplate(builtinId: string): Result<BrainTemplate> {
    const template = getBuiltinTemplate(builtinId);
    if (!template) {
      return { success: false, error: `Builtin template not found: ${builtinId}` };
    }

    return {
      success: true,
      data: {
        ...template,
        exportedAt: new Date().toISOString(),
        exportedFrom: {
          appVersion: process.env.npm_package_version
        }
      }
    };
  }

  // ==========================================================================
  // APPLY TEMPLATES
  // ==========================================================================

  /**
   * Get skill template data from a stored template or builtin
   * Returns the SkillTemplateData that can be used to create a skill
   */
  async getSkillTemplateData(
    templateIdOrBuiltinId: number | string
  ): Promise<Result<SkillTemplateData>> {
    try {
      let templateContent: TemplateContent;

      if (typeof templateIdOrBuiltinId === 'string') {
        // It's a builtin ID
        const builtin = getBuiltinTemplate(templateIdOrBuiltinId);
        if (!builtin) {
          return { success: false, error: `Builtin template not found: ${templateIdOrBuiltinId}` };
        }
        templateContent = builtin.template;
      } else {
        // It's a stored template ID
        const id = TemplateId.fromNumber(templateIdOrBuiltinId);
        const template = await this.templateRepository.findById(id);
        if (!template) {
          return { success: false, error: 'Template not found' };
        }
        templateContent = template.templateData;
      }

      // Validate it's a skill template
      if (templateContent.type !== 'skill') {
        return { success: false, error: `Expected skill template, got ${templateContent.type}` };
      }

      if (!isSkillTemplateData(templateContent.data)) {
        return { success: false, error: 'Invalid skill template data' };
      }

      return { success: true, data: templateContent.data };
    } catch (error) {
      logger.error('[TemplateApplicationService] getSkillTemplateData error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get skill template data' };
    }
  }

  /**
   * Save a builtin template to the organization's template library
   */
  async saveBuiltinToLibrary(
    builtinId: string,
    organizationId: number,
    ownerId: string
  ): Promise<Result<Template>> {
    try {
      if (!builtinTemplateExists(builtinId)) {
        return { success: false, error: `Builtin template not found: ${builtinId}` };
      }

      const builtin = getBuiltinTemplate(builtinId)!;

      const template = await this.templateRepository.create({
        organizationId,
        ownerId,
        name: builtin.metadata.name,
        description: builtin.metadata.description,
        category: builtin.metadata.category,
        tags: builtin.metadata.tags,
        entityType: builtin.template.type,
        templateData: builtin.template,
        version: builtin.metadata.version,
        isBuiltin: true,
        sourceBuiltinId: builtinId
      });

      return { success: true, data: template };
    } catch (error) {
      logger.error('[TemplateApplicationService] saveBuiltinToLibrary error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save builtin template' };
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Convert a Template entity to a DTO
   */
  templateToDTO(template: Template): TemplateDTO {
    return {
      id: template.id.value,
      organizationId: template.organizationId.value,
      ownerId: template.ownerId?.value || null,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      entityType: template.entityType,
      templateData: template.templateData,
      version: template.version,
      isBuiltin: template.isBuiltin,
      sourceBuiltinId: template.sourceBuiltinId,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };
  }

  /**
   * Convert multiple templates to DTOs
   */
  templatesToDTOs(templates: Template[]): TemplateDTO[] {
    return templates.map(t => this.templateToDTO(t));
  }
}
