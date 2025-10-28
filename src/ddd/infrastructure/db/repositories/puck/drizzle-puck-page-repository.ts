// AIDEV-NOTE: Drizzle implementation of IPuckPageRepository
// Handles data access for PuckPage entities using PostgreSQL

import type { DbClient } from '@/lib/db/client';
import { puckPages } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { IPuckPageRepository } from '@/ddd/domain/puck/repositories/puck-page-repository';
import { PuckPage } from '@/ddd/domain/puck/entities/puck-page';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { PageSlug } from '@/ddd/domain/puck/value-objects/page-slug';
import { PageOrder } from '@/ddd/domain/puck/value-objects/page-order';

export class DrizzlePuckPageRepository implements IPuckPageRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: PageId): Promise<PuckPage | null> {
    try {
      const record = await this.db.query.puckPages.findFirst({
        where: eq(puckPages.id, id.value)
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error finding page by ID:', error);
      throw error;
    }
  }

  async findByApp(appId: AppId): Promise<PuckPage[]> {
    try {
      const records = await this.db.query.puckPages.findMany({
        where: eq(puckPages.appId, appId.value)
      });

      // Sort by order on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: PuckPage, b: PuckPage) => a.order.value - b.order.value);
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error finding pages by app:', error);
      throw error;
    }
  }

  async findBySlug(appId: AppId, slug: PageSlug): Promise<PuckPage | null> {
    try {
      const record = await this.db.query.puckPages.findFirst({
        where: and(
          eq(puckPages.appId, appId.value),
          eq(puckPages.slug, slug.value)
        )
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error finding page by slug:', error);
      throw error;
    }
  }

  async existsBySlug(appId: AppId, slug: PageSlug): Promise<boolean> {
    try {
      const record = await this.db.query.puckPages.findFirst({
        where: and(
          eq(puckPages.appId, appId.value),
          eq(puckPages.slug, slug.value)
        )
      });

      return !!record;
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error checking slug existence:', error);
      throw error;
    }
  }

  async create(page: PuckPage): Promise<PuckPage> {
    try {
      const persistence = page.toPersistence();

      const [record] = await this.db.insert(puckPages).values({
        appId: persistence.appId,
        name: persistence.name,
        slug: persistence.slug,
        description: persistence.description,
        order: persistence.order,
        templateData: persistence.templateData,
        isPublished: persistence.isPublished,
        createdBy: persistence.createdBy,
        createdAt: persistence.createdAt,
        updatedAt: persistence.updatedAt
      }).returning();

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error creating page:', error);
      throw error;
    }
  }

  async update(page: PuckPage): Promise<PuckPage> {
    try {
      const persistence = page.toPersistence();

      const [record] = await this.db
        .update(puckPages)
        .set({
          name: persistence.name,
          slug: persistence.slug,
          description: persistence.description,
          order: persistence.order,
          templateData: persistence.templateData,
          isPublished: persistence.isPublished,
          updatedAt: new Date()
        })
        .where(eq(puckPages.id, persistence.id))
        .returning();

      if (!record) {
        throw new Error(`Page ${persistence.id} not found`);
      }

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error updating page:', error);
      throw error;
    }
  }

  async delete(id: PageId): Promise<void> {
    try {
      await this.db
        .delete(puckPages)
        .where(eq(puckPages.id, id.value));

      console.log(`[DrizzlePuckPageRepository] Deleted page ID: ${id.value}`);
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error deleting page:', error);
      throw error;
    }
  }

  async reorderPages(appId: AppId, pageOrders: Map<PageId, PageOrder>): Promise<void> {
    try {
      // Update each page's order in a transaction
      // Note: Drizzle doesn't have explicit transaction methods in the query builder,
      // but we can use the transaction method on the db instance
      await this.db.transaction(async (tx: any) => {
        for (const [pageId, newOrder] of pageOrders.entries()) {
          await tx
            .update(puckPages)
            .set({
              order: newOrder.value,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(puckPages.id, pageId.value),
                eq(puckPages.appId, appId.value)
              )
            );
        }
      });

      console.log(`[DrizzlePuckPageRepository] Reordered ${pageOrders.size} pages for app ${appId.value}`);
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error reordering pages:', error);
      throw error;
    }
  }

  async countByApp(appId: AppId): Promise<number> {
    try {
      const records = await this.db.query.puckPages.findMany({
        where: eq(puckPages.appId, appId.value)
      });

      return records.length;
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error counting pages:', error);
      throw error;
    }
  }

  async getMaxOrder(appId: AppId): Promise<number> {
    try {
      const records = await this.db.query.puckPages.findMany({
        where: eq(puckPages.appId, appId.value)
      });

      if (records.length === 0) return 0;

      // Find max order on the application side
      return Math.max(...records.map((r: any) => r.order));
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error getting max order:', error);
      throw error;
    }
  }

  async findPublishedByApp(appId: AppId): Promise<PuckPage[]> {
    try {
      const records = await this.db.query.puckPages.findMany({
        where: and(
          eq(puckPages.appId, appId.value),
          eq(puckPages.isPublished, true)
        )
      });

      // Sort by order on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: PuckPage, b: PuckPage) => a.order.value - b.order.value);
    } catch (error) {
      console.error('[DrizzlePuckPageRepository] Error finding published pages:', error);
      throw error;
    }
  }

  // Helper method to convert database record to domain entity
  private toDomain(record: any): PuckPage {
    return PuckPage.fromPersistence({
      id: record.id,
      appId: record.appId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      order: record.order,
      templateData: record.templateData,
      isPublished: record.isPublished,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }
}
