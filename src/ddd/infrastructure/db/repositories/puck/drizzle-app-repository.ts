// AIDEV-NOTE: Drizzle implementation of IAppRepository
// Handles data access for App entities using PostgreSQL
// Uses Puck schema but that's just an implementation detail

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { apps, pages } from '@/ddd/infrastructure/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { IAppRepository, SidebarAppDTO } from '@/ddd/domain/puck/repositories/app-repository';
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

  async findByOrganizationWithPages(organizationId: OrganizationId): Promise<SidebarAppDTO[]> {
    try {
      // Fetch apps and pages in parallel (2 queries instead of N+1)
      const [appRecords, pageRecords] = await Promise.all([
        this.db.query.apps.findMany({
          where: eq(apps.organizationId, organizationId.value),
          orderBy: [asc(apps.name)]
        }),
        this.db.select({
          id: pages.id,
          appId: pages.appId,
          name: pages.name,
          slug: pages.slug,
          order: pages.order
        })
        .from(pages)
        .innerJoin(apps, eq(pages.appId, apps.id))
        .where(eq(apps.organizationId, organizationId.value))
        .orderBy(asc(pages.order))
      ]);

      // Group pages by appId
      const pagesByApp = new Map<number, SidebarAppDTO['pages']>();
      for (const page of pageRecords) {
        const existing = pagesByApp.get(page.appId) || [];
        existing.push({
          id: page.id,
          name: page.name,
          slug: page.slug,
          order: page.order
        });
        pagesByApp.set(page.appId, existing);
      }

      // Combine apps with their pages
      return appRecords.map((app: { id: number; name: string; slug: string }) => ({
        id: app.id,
        name: app.name,
        slug: app.slug,
        pages: pagesByApp.get(app.id) || []
      }));
    } catch (error) {
      console.error('[DrizzleAppRepository] Error finding apps with pages:', error);
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
