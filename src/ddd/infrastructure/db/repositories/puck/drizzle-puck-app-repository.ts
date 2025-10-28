// AIDEV-NOTE: Drizzle implementation of IPuckAppRepository
// Handles data access for PuckApp entities using PostgreSQL

import type { DbClient } from '@/lib/db/client';
import { puckApps } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { IPuckAppRepository } from '@/ddd/domain/puck/repositories/puck-app-repository';
import { PuckApp } from '@/ddd/domain/puck/entities/puck-app';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { AppSlug } from '@/ddd/domain/puck/value-objects/app-slug';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

export class DrizzlePuckAppRepository implements IPuckAppRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: AppId): Promise<PuckApp | null> {
    try {
      const record = await this.db.query.puckApps.findFirst({
        where: eq(puckApps.id, id.value)
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error finding app by ID:', error);
      throw error;
    }
  }

  async findByOrganization(organizationId: OrganizationId): Promise<PuckApp[]> {
    try {
      const records = await this.db.query.puckApps.findMany({
        where: eq(puckApps.organizationId, organizationId.value)
      });

      // Sort by name on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: PuckApp, b: PuckApp) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error finding apps by organization:', error);
      throw error;
    }
  }

  async findBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<PuckApp | null> {
    try {
      const record = await this.db.query.puckApps.findFirst({
        where: and(
          eq(puckApps.organizationId, organizationId.value),
          eq(puckApps.slug, slug.value)
        )
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error finding app by slug:', error);
      throw error;
    }
  }

  async existsBySlug(organizationId: OrganizationId, slug: AppSlug): Promise<boolean> {
    try {
      const record = await this.db.query.puckApps.findFirst({
        where: and(
          eq(puckApps.organizationId, organizationId.value),
          eq(puckApps.slug, slug.value)
        )
      });

      return !!record;
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error checking slug existence:', error);
      throw error;
    }
  }

  async create(app: PuckApp): Promise<PuckApp> {
    try {
      const persistence = app.toPersistence();

      const [record] = await this.db.insert(puckApps).values({
        organizationId: persistence.organizationId,
        name: persistence.name,
        slug: persistence.slug,
        description: persistence.description,
        createdBy: persistence.createdBy,
        createdAt: persistence.createdAt,
        updatedAt: persistence.updatedAt
      }).returning();

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error creating app:', error);
      throw error;
    }
  }

  async update(app: PuckApp): Promise<PuckApp> {
    try {
      const persistence = app.toPersistence();

      const [record] = await this.db
        .update(puckApps)
        .set({
          name: persistence.name,
          slug: persistence.slug,
          description: persistence.description,
          updatedAt: new Date()
        })
        .where(eq(puckApps.id, persistence.id))
        .returning();

      if (!record) {
        throw new Error(`App ${persistence.id} not found`);
      }

      return this.toDomain(record);
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error updating app:', error);
      throw error;
    }
  }

  async delete(id: AppId): Promise<void> {
    try {
      await this.db
        .delete(puckApps)
        .where(eq(puckApps.id, id.value));

      console.log(`[DrizzlePuckAppRepository] Deleted app ID: ${id.value}`);
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error deleting app:', error);
      throw error;
    }
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    try {
      const records = await this.db.query.puckApps.findMany({
        where: eq(puckApps.organizationId, organizationId.value)
      });

      return records.length;
    } catch (error) {
      console.error('[DrizzlePuckAppRepository] Error counting apps:', error);
      throw error;
    }
  }

  // Helper method to convert database record to domain entity
  private toDomain(record: any): PuckApp {
    return PuckApp.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }
}
