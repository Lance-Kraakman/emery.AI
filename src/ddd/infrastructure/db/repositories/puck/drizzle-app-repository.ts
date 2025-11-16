// AIDEV-NOTE: Drizzle implementation of IAppRepository
// Handles data access for App entities using PostgreSQL
// Uses Puck schema but that's just an implementation detail

import type { DbClient } from '@/lib/db/client';
import { apps } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { IAppRepository } from '@/ddd/domain/puck/repositories/app-repository';
import { App } from '@/ddd/domain/puck/entities/app';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { AppSlug } from '@/ddd/domain/puck/value-objects/app-slug';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export class DrizzleAppRepository implements IAppRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: AppId): Promise<App | null> {
    try {
      const record = await this.db.query.apps.findFirst({
        where: eq(apps.id, id.value)
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzleAppRepository] Error finding app by ID:', error);
      throw error;
    }
  }

  async findByOrganization(organizationId: OrganizationId): Promise<App[]> {
    try {
      const records = await this.db.query.apps.findMany({
        where: eq(apps.organizationId, organizationId.value)
      });

      // Sort by name on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: App, b: App) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[DrizzleAppRepository] Error finding apps by organization:', error);
      throw error;
    }
  }

  async findBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<App | null> {
    try {
      const record = await this.db.query.apps.findFirst({
        where: and(
          eq(apps.organizationId, organizationId.value),
          eq(apps.slug, slug.value)
        )
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzleAppRepository] Error finding app by slug:', error);
      throw error;
    }
  }

  async existsBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<boolean> {
    try {
      const record = await this.db.query.apps.findFirst({
        where: and(
          eq(apps.organizationId, organizationId.value),
          eq(apps.slug, slug.value)
        )
      });

      return !!record;
    } catch (error) {
      console.error('[DrizzleAppRepository] Error checking slug existence:', error);
      throw error;
    }
  }

  async create(app: App): Promise<App> {
    try {
      const persistence = app.toPersistence();

      const [record] = await this.db.insert(apps).values({
        organizationId: persistence.organizationId,
        name: persistence.name,
        slug: persistence.slug,
        description: persistence.description,
        themeConfig: persistence.themeConfig,
        homePageId: persistence.homePageId,
        ownerId: persistence.ownerId,
        createdAt: persistence.createdAt,
        updatedAt: persistence.updatedAt
      }).returning();

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzleAppRepository] Error creating app:', error);
      throw error;
    }
  }

  async update(app: App): Promise<App> {
    try {
      const persistence = app.toPersistence();

      const [record] = await this.db
        .update(apps)
        .set({
          name: persistence.name,
          slug: persistence.slug,
          description: persistence.description,
          themeConfig: persistence.themeConfig,
          homePageId: persistence.homePageId,
          updatedAt: new Date()
        })
        .where(eq(apps.id, persistence.id))
        .returning();

      if (!record) {
        throw new Error(`App ${persistence.id} not found`);
      }

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzleAppRepository] Error updating app:', error);
      throw error;
    }
  }

  async delete(id: AppId): Promise<void> {
    try {
      await this.db
        .delete(apps)
        .where(eq(apps.id, id.value));

      console.log(`[DrizzleAppRepository] Deleted app ID: ${id.value}`);
    } catch (error) {
      console.error('[DrizzleAppRepository] Error deleting app:', error);
      throw error;
    }
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    try {
      const records = await this.db.query.apps.findMany({
        where: eq(apps.organizationId, organizationId.value)
      });

      return records.length;
    } catch (error) {
      console.error('[DrizzleAppRepository] Error counting apps:', error);
      throw error;
    }
  }

  // Helper method to convert database record to domain entity
  private toDomain(record: any): App {
    return App.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      themeConfig: record.themeConfig,
      homePageId: record.homePageId ?? undefined,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }
}
