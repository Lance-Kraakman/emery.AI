// AIDEV-NOTE: Template domain entity
// Represents a stored template in the database
// Builtin templates are loaded from JSON files, not stored as entities

import { TemplateId } from '../value-objects/template-id';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type {
  TemplateEntityType,
  TemplateContent,
  CreateTemplateCommand,
  UpdateTemplateCommand
} from '../types';

/**
 * Template Entity
 *
 * Stored templates in the database. These can be:
 * - User-created templates (exported from entities)
 * - Imported templates (from .brain files)
 * - Applied builtin templates (copies of builtin templates)
 */
export interface Template {
  readonly id: TemplateId;
  readonly organizationId: OrganizationId;
  readonly ownerId: UserId | null;
  readonly name: string;
  readonly description: string;
  readonly category: string | null;
  readonly tags: string[];
  readonly entityType: TemplateEntityType;
  readonly templateData: TemplateContent;
  readonly version: string;
  readonly isBuiltin: boolean;
  readonly sourceBuiltinId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Persistence record type for database operations
 */
export interface TemplatePersistenceRecord {
  id: number;
  organizationId: number;
  ownerId: string | null;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  entityType: TemplateEntityType;
  templateData: TemplateContent;
  version: string;
  isBuiltin: boolean;
  sourceBuiltinId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template Entity Factory
 */
export class TemplateFactory {
  /**
   * Create a new template (without ID and timestamps)
   * Used before persisting to database
   */
  static create(command: CreateTemplateCommand): Omit<Template, 'id' | 'createdAt' | 'updatedAt'> {
    // Validation
    if (!command.name?.trim()) {
      throw new Error('Template name is required and cannot be empty');
    }
    if (command.name.length > 255) {
      throw new Error('Template name must be 255 characters or less');
    }

    const validEntityTypes: TemplateEntityType[] = [
      'skill', 'database', 'table', 'agent', 'app', 'organization', 'org_section'
    ];
    if (!validEntityTypes.includes(command.entityType)) {
      throw new Error(`Invalid entity type: ${command.entityType}`);
    }

    // Ensure template data type matches entity type
    if (command.templateData.type !== command.entityType) {
      throw new Error(`Template data type (${command.templateData.type}) must match entity type (${command.entityType})`);
    }

    return {
      organizationId: OrganizationId.fromNumber(command.organizationId),
      ownerId: command.ownerId ? UserId.fromString(command.ownerId) : null,
      name: command.name.trim(),
      description: command.description?.trim() || '',
      category: command.category?.trim() || null,
      tags: command.tags || [],
      entityType: command.entityType,
      templateData: command.templateData,
      version: command.version || '1.0.0',
      isBuiltin: command.isBuiltin || false,
      sourceBuiltinId: command.sourceBuiltinId || null
    };
  }

  /**
   * Create a Template from persistence record
   */
  static fromPersistence(record: TemplatePersistenceRecord): Template {
    return {
      id: TemplateId.fromNumber(record.id),
      organizationId: OrganizationId.fromNumber(record.organizationId),
      ownerId: record.ownerId ? UserId.fromString(record.ownerId) : null,
      name: record.name,
      description: record.description,
      category: record.category,
      tags: record.tags || [],
      entityType: record.entityType,
      templateData: record.templateData,
      version: record.version,
      isBuiltin: record.isBuiltin,
      sourceBuiltinId: record.sourceBuiltinId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  /**
   * Convert Template to persistence record
   */
  static toPersistence(template: Template): TemplatePersistenceRecord {
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
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };
  }

  /**
   * Update a template
   */
  static update(template: Template, updates: UpdateTemplateCommand): Template {
    // Validation
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Template name cannot be empty');
      }
      if (trimmed.length > 255) {
        throw new Error('Template name must be 255 characters or less');
      }
    }

    // If templateData is being updated, ensure type matches
    if (updates.templateData && updates.templateData.type !== template.entityType) {
      throw new Error(`Template data type (${updates.templateData.type}) must match entity type (${template.entityType})`);
    }

    return {
      ...template,
      name: updates.name !== undefined ? updates.name.trim() : template.name,
      description: updates.description !== undefined ? updates.description.trim() : template.description,
      category: updates.category !== undefined ? (updates.category?.trim() || null) : template.category,
      tags: updates.tags !== undefined ? updates.tags : template.tags,
      templateData: updates.templateData !== undefined ? updates.templateData : template.templateData,
      version: updates.version !== undefined ? updates.version : template.version,
      updatedAt: new Date()
    };
  }
}
