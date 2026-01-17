// AIDEV-NOTE: Drizzle implementation of Template repository
// Handles data persistence for Template domain entities

import type { ITemplateRepository, ListTemplatesOptions } from '@/ddd/domain/templates/repositories/template-repository';
import { Template, TemplateFactory } from '@/ddd/domain/templates/entities/template';
import { TemplateId } from '@/ddd/domain/templates/value-objects/template-id';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import type { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { entityTemplates } from '@/ddd/infrastructure/db/schema';
import { eq, and, ne, ilike, sql } from 'drizzle-orm';
import type { TemplateEntityType, CreateTemplateCommand, UpdateTemplateCommand, TemplateContent } from '@/ddd/domain/templates/types';

type EntityTemplateRecord = typeof entityTemplates.$inferSelect;

export class DrizzleTemplateRepository
  extends DrizzleBaseRepository<Template, TemplateId, CreateTemplateCommand, UpdateTemplateCommand, any>
  implements ITemplateRepository {

  protected readonly table = entityTemplates;
  protected readonly idColumn = entityTemplates.id;
  protected readonly organizationColumn = entityTemplates.organizationId;

  async findById(id: TemplateId): Promise<Template | null> {
    const [record] = await this.db
      .select()
      .from(entityTemplates)
      .where(eq(entityTemplates.id, id.value))
      .limit(1);

    return record ? this.fromPersistence(record) : null;
  }

  async findByOrganization(organizationId: OrganizationId): Promise<Template[]> {
    const records = await this.db
      .select()
      .from(entityTemplates)
      .where(eq(entityTemplates.organizationId, organizationId.value))
      .orderBy(entityTemplates.name);

    return records.map((r: EntityTemplateRecord) => this.fromPersistence(r));
  }

  async findByType(organizationId: OrganizationId, entityType: TemplateEntityType): Promise<Template[]> {
    const records = await this.db
      .select()
      .from(entityTemplates)
      .where(and(
        eq(entityTemplates.organizationId, organizationId.value),
        eq(entityTemplates.entityType, entityType)
      ))
      .orderBy(entityTemplates.name);

    return records.map((r: EntityTemplateRecord) => this.fromPersistence(r));
  }

  async findByCategory(organizationId: OrganizationId, category: string): Promise<Template[]> {
    const records = await this.db
      .select()
      .from(entityTemplates)
      .where(and(
        eq(entityTemplates.organizationId, organizationId.value),
        eq(entityTemplates.category, category)
      ))
      .orderBy(entityTemplates.name);

    return records.map((r: EntityTemplateRecord) => this.fromPersistence(r));
  }

  async findByNameAndType(
    organizationId: OrganizationId,
    name: string,
    entityType: TemplateEntityType
  ): Promise<Template | null> {
    const [record] = await this.db
      .select()
      .from(entityTemplates)
      .where(and(
        eq(entityTemplates.organizationId, organizationId.value),
        eq(entityTemplates.name, name),
        eq(entityTemplates.entityType, entityType)
      ))
      .limit(1);

    return record ? this.fromPersistence(record) : null;
  }

  async list(options: ListTemplatesOptions): Promise<Template[]> {
    const conditions = [eq(entityTemplates.organizationId, options.organizationId)];

    if (options.entityType) {
      conditions.push(eq(entityTemplates.entityType, options.entityType));
    }

    if (options.category) {
      conditions.push(eq(entityTemplates.category, options.category));
    }

    if (options.search) {
      conditions.push(ilike(entityTemplates.name, `%${options.search}%`));
    }

    if (options.tags && options.tags.length > 0) {
      // Check if tags array contains any of the specified tags
      conditions.push(sql`${entityTemplates.tags} ?| array[${sql.join(options.tags.map(t => sql`${t}`), sql`, `)}]`);
    }

    let query = this.db
      .select()
      .from(entityTemplates)
      .where(and(...conditions))
      .orderBy(entityTemplates.name);

    if (options.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    const records = await query;
    return records.map((r: EntityTemplateRecord) => this.fromPersistence(r));
  }

  async count(options: Omit<ListTemplatesOptions, 'limit' | 'offset'>): Promise<number> {
    const conditions = [eq(entityTemplates.organizationId, options.organizationId)];

    if (options.entityType) {
      conditions.push(eq(entityTemplates.entityType, options.entityType));
    }

    if (options.category) {
      conditions.push(eq(entityTemplates.category, options.category));
    }

    if (options.search) {
      conditions.push(ilike(entityTemplates.name, `%${options.search}%`));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(entityTemplates)
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  }

  async create(command: CreateTemplateCommand): Promise<Template> {
    const templateData = TemplateFactory.create(command);

    const [record] = await this.db
      .insert(entityTemplates)
      .values({
        organizationId: templateData.organizationId.value,
        ownerId: templateData.ownerId?.value || null,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        tags: templateData.tags,
        entityType: templateData.entityType,
        templateData: templateData.templateData,
        version: templateData.version,
        isBuiltin: templateData.isBuiltin,
        sourceBuiltinId: templateData.sourceBuiltinId,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return this.fromPersistence(record);
  }

  async update(id: TemplateId, updates: UpdateTemplateCommand): Promise<Template> {
    // First get the existing template
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Template with id ${id.value} not found`);
    }

    // Apply updates using factory
    const updated = TemplateFactory.update(existing, updates);

    const [record] = await this.db
      .update(entityTemplates)
      .set({
        name: updated.name,
        description: updated.description,
        category: updated.category,
        tags: updated.tags,
        templateData: updated.templateData,
        version: updated.version,
        updatedAt: new Date()
      })
      .where(eq(entityTemplates.id, id.value))
      .returning();

    if (!record) {
      throw new Error(`Template with id ${id.value} not found`);
    }

    return this.fromPersistence(record);
  }

  async delete(id: TemplateId): Promise<void> {
    await this.db
      .delete(entityTemplates)
      .where(eq(entityTemplates.id, id.value));
  }

  async exists(id: TemplateId): Promise<boolean> {
    const [record] = await this.db
      .select({ id: entityTemplates.id })
      .from(entityTemplates)
      .where(eq(entityTemplates.id, id.value))
      .limit(1);

    return !!record;
  }

  async isNameUnique(
    organizationId: OrganizationId,
    name: string,
    entityType: TemplateEntityType,
    excludeId?: TemplateId
  ): Promise<boolean> {
    const conditions = [
      eq(entityTemplates.organizationId, organizationId.value),
      eq(entityTemplates.name, name),
      eq(entityTemplates.entityType, entityType)
    ];

    if (excludeId) {
      conditions.push(ne(entityTemplates.id, excludeId.value));
    }

    const [record] = await this.db
      .select({ id: entityTemplates.id })
      .from(entityTemplates)
      .where(and(...conditions))
      .limit(1);

    return !record;
  }

  protected fromPersistence(record: EntityTemplateRecord): Template {
    return TemplateFactory.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      ownerId: record.ownerId,
      name: record.name,
      description: record.description || '',
      category: record.category,
      tags: record.tags || [],
      entityType: record.entityType as TemplateEntityType,
      templateData: record.templateData as TemplateContent,
      version: record.version || '1.0.0',
      isBuiltin: record.isBuiltin || false,
      sourceBuiltinId: record.sourceBuiltinId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }

  protected toPersistence(template: Template): any {
    return TemplateFactory.toPersistence(template);
  }
}
