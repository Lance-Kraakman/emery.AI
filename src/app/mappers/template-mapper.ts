// AIDEV-NOTE: Template DTO mapper
// Converts between Template domain entities and TemplateDTO for API responses

import type { Template } from '@/ddd/domain/templates/entities/template';
import type { TemplateDTO, TemplateContent, TemplateEntityType } from '@/ddd/domain/templates/types';

/**
 * Template Mapper
 *
 * Provides conversion between Template domain entities and TemplateDTO.
 */
export class TemplateMapper {
  /**
   * Convert a Template entity to a TemplateDTO
   */
  static toDTO(template: Template): TemplateDTO {
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
   * Convert multiple Templates to DTOs
   */
  static toDTOList(templates: Template[]): TemplateDTO[] {
    return templates.map(t => this.toDTO(t));
  }

  /**
   * Extract the template content data from a DTO
   */
  static extractContent(dto: TemplateDTO): TemplateContent {
    return dto.templateData;
  }

  /**
   * Get display-friendly entity type label
   */
  static getEntityTypeLabel(entityType: TemplateEntityType): string {
    const labels: Record<TemplateEntityType, string> = {
      skill: 'Skill',
      database: 'Database',
      table: 'Table',
      agent: 'Agent',
      app: 'App',
      organization: 'Organization',
      org_section: 'Org Section'
    };
    return labels[entityType] || entityType;
  }

  /**
   * Get template summary for display
   */
  static getSummary(dto: TemplateDTO): string {
    const parts: string[] = [];
    parts.push(this.getEntityTypeLabel(dto.entityType));
    if (dto.category) {
      parts.push(dto.category);
    }
    if (dto.tags && dto.tags.length > 0) {
      parts.push(`${dto.tags.length} tag${dto.tags.length !== 1 ? 's' : ''}`);
    }
    return parts.join(' • ');
  }
}
