// AIDEV-NOTE: Drizzle implementation of Database repository
// Handles data persistence for Database domain entities

import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import { Database } from '@/ddd/domain/databases/entities/database';
import type { DbClient } from '@/lib/db/client';
import { databases } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';

export class DrizzleDatabaseRepository implements IDatabaseRepository {
  constructor(private readonly db: DbClient) {}

  async findByOrganization(organizationId: number): Promise<Database[]> {
    const results = await this.db
      .select()
      .from(databases)
      .where(eq(databases.organizationId, organizationId));

    return results.map(result => Database.fromPersistence({
      id: result.id,
      name: result.name,
      slug: result.slug,
      metadata: result.metadata as Record<string, any> | null,
      organizationId: result.organizationId,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }));
  }

  async findById(id: number): Promise<Database | null> {
    const results = await this.db
      .select()
      .from(databases)
      .where(eq(databases.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return Database.fromPersistence({
      id: result.id,
      name: result.name,
      slug: result.slug,
      metadata: result.metadata as Record<string, any> | null,
      organizationId: result.organizationId,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    });
  }

  async findBySlug(slug: string): Promise<Database | null> {
    const results = await this.db
      .select()
      .from(databases)
      .where(eq(databases.slug, slug))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return Database.fromPersistence({
      id: result.id,
      name: result.name,
      slug: result.slug,
      metadata: result.metadata as Record<string, any> | null,
      organizationId: result.organizationId,
      createdBy: result.createdBy,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    });
  }

  async isSlugUnique(organizationId: number, slug: string, excludeId?: number): Promise<boolean> {
    const conditions = [
      eq(databases.organizationId, organizationId),
      eq(databases.slug, slug)
    ];

    if (excludeId) {
      conditions.push(ne(databases.id, excludeId));
    }

    const results = await this.db
      .select({ id: databases.id })
      .from(databases)
      .where(and(...conditions))
      .limit(1);

    return results.length === 0;
  }

  async save(database: Database): Promise<void> {
    if (database.id === 0) {
      // Insert new database
      await this.db.insert(databases).values({
        name: database.name,
        slug: database.slug,
        metadata: database.metadata,
        organizationId: database.organizationId,
        createdBy: database.createdBy
      });
    } else {
      // Update existing database
      await this.db
        .update(databases)
        .set({
          name: database.name,
          slug: database.slug,
          metadata: database.metadata,
          organizationId: database.organizationId,
          createdBy: database.createdBy,
          updatedAt: new Date()
        })
        .where(eq(databases.id, database.id));
    }
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(databases).where(eq(databases.id, id));
  }

  async countByOrganization(organizationId: number): Promise<number> {
    const result = await this.db
      .select({ count: databases.id })
      .from(databases)
      .where(eq(databases.organizationId, organizationId));

    return result.length;
  }
}