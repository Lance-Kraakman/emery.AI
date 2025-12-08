// AIDEV-NOTE: Drizzle implementation of ITemplateRepository
// Handles data access for Template entities using PostgreSQL

import type { DbClient } from '@/lib/db/client';
import { templates } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import type { ITemplateRepository } from '@/ddd/domain/puck/repositories/template-repository';
import { Template } from '@/ddd/domain/puck/entities/template';
import { TemplateId } from '@/ddd/domain/puck/value-objects/template-id';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export class DrizzleTemplateRepository implements ITemplateRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: TemplateId): Promise<Template | null> {
    try {
      const record = await this.db.query.templates.findFirst({
        where: eq(templates.id, id.value)
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error finding template by ID:', error);
      throw error;
    }
  }

  async findByOrganization(organizationId: OrganizationId): Promise<Template[]> {
    try {
      const records = await this.db.query.templates.findMany({
        where: eq(templates.organizationId, organizationId.value)
      });

      // Sort by name on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: Template, b: Template) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error finding templates by organization:', error);
      throw error;
    }
  }

  async findOrgWide(organizationId: OrganizationId): Promise<Template[]> {
    try {
      const records = await this.db.query.templates.findMany({
        where: and(
          eq(templates.organizationId, organizationId.value),
          isNull(templates.appId)
        )
      });

      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: Template, b: Template) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error finding org-wide templates:', error);
      throw error;
    }
  }

  async findByApp(organizationId: OrganizationId, appId: AppId): Promise<Template[]> {
    try {
      // Find both org-wide templates AND app-specific templates for this app
      const records = await this.db.query.templates.findMany({
        where: and(
          eq(templates.organizationId, organizationId.value),
          or(
            isNull(templates.appId),
            eq(templates.appId, appId.value)
          )
        )
      });

      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: Template, b: Template) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error finding templates by app:', error);
      throw error;
    }
  }

  async findByCategory(organizationId: OrganizationId, category: string): Promise<Template[]> {
    try {
      const records = await this.db.query.templates.findMany({
        where: and(
          eq(templates.organizationId, organizationId.value),
          eq(templates.category, category)
        )
      });

      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: Template, b: Template) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error finding templates by category:', error);
      throw error;
    }
  }

  async create(template: Template): Promise<Template> {
    try {
      const persistence = template.toPersistence();

      const [record] = await this.db.insert(templates).values({
        organizationId: persistence.organizationId,
        appId: persistence.appId,
        name: persistence.name,
        description: persistence.description,
        category: persistence.category,
        thumbnailUrl: persistence.thumbnailUrl,
        data: persistence.data,
        variants: persistence.variants,
        createdBy: persistence.createdBy,
        createdAt: persistence.createdAt,
        updatedAt: persistence.updatedAt
      }).returning();

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error creating template:', error);
      throw error;
    }
  }

  async update(template: Template): Promise<Template> {
    try {
      const persistence = template.toPersistence();

      const [record] = await this.db
        .update(templates)
        .set({
          name: persistence.name,
          description: persistence.description,
          category: persistence.category,
          thumbnailUrl: persistence.thumbnailUrl,
          data: persistence.data,
          variants: persistence.variants,
          updatedAt: new Date()
        })
        .where(eq(templates.id, persistence.id))
        .returning();

      if (!record) {
        throw new Error(`Template ${persistence.id} not found`);
      }

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error updating template:', error);
      throw error;
    }
  }

  async delete(id: TemplateId): Promise<void> {
    try {
      await this.db
        .delete(templates)
        .where(eq(templates.id, id.value));

      console.log(`[DrizzleTemplateRepository] Deleted template ID: ${id.value}`);
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error deleting template:', error);
      throw error;
    }
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    try {
      const records = await this.db.query.templates.findMany({
        where: eq(templates.organizationId, organizationId.value)
      });

      return records.length;
    } catch (error) {
      console.error('[DrizzleTemplateRepository] Error counting templates:', error);
      throw error;
    }
  }

  // Helper method to convert database record to domain entity
  private toDomain(record: any): Template {
    return Template.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      appId: record.appId,
      name: record.name,
      description: record.description,
      category: record.category,
      thumbnailUrl: record.thumbnailUrl,
      data: record.data,
      variants: record.variants,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }
}
