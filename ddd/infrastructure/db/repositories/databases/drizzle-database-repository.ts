// AIDEV-NOTE: Drizzle implementation of Database repository
// Handles data persistence for Database domain entities

import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import { Database } from '@/ddd/domain/databases/entities/database';
import type { DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { databases } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { ContextAwareDbClient } from '@/lib/db/context-client';

export class DrizzleDatabaseRepository implements IDatabaseRepository {
  constructor(private readonly db: ContextAwareDbClient) {}

  async findByOrganization(organizationId: OrganizationId): Promise<Database[]> {
    const results = await this.db
      .select()
      .from(databases)
      .where(eq(databases.organizationId, organizationId.value));

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

  async findById(id: DatabaseId): Promise<Database | null> {
    const results = await this.db
      .select()
      .from(databases)
      .where(eq(databases.id, id.value))
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

  async isSlugUnique(organizationId: OrganizationId, slug: string, excludeId?: DatabaseId): Promise<boolean> {
    const conditions = [
      eq(databases.organizationId, organizationId.value),
      eq(databases.slug, slug)
    ];

    if (excludeId) {
      conditions.push(ne(databases.id, excludeId.value));
    }

    const results = await this.db
      .select({ id: databases.id })
      .from(databases)
      .where(and(...conditions))
      .limit(1);

    return results.length === 0;
  }

  async save(database: Database): Promise<Database> {
    if (database.id.value === -1) { // Check for temporary ID
      // Insert new database and return with generated ID
      const [inserted] = await this.db.insert(databases).values({
        name: database.name,
        slug: database.slug,
        metadata: database.metadata,
        organizationId: database.organizationId.value,
        createdBy: database.createdBy.value
      }).returning();
      
      return Database.fromPersistence({
        id: inserted.id,
        name: inserted.name,
        slug: inserted.slug,
        metadata: inserted.metadata as Record<string, any> | null,
        organizationId: inserted.organizationId,
        createdBy: inserted.createdBy,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt
      });
    } else {
      // Update existing database and return updated entity
      const [updated] = await this.db
        .update(databases)
        .set({
          name: database.name,
          slug: database.slug,
          metadata: database.metadata,
          organizationId: database.organizationId.value,
          createdBy: database.createdBy.value,
          updatedAt: new Date()
        })
        .where(eq(databases.id, database.id.value))
        .returning();
        
      return Database.fromPersistence({
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        metadata: updated.metadata as Record<string, any> | null,
        organizationId: updated.organizationId,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      });
    }
  }

  async delete(id: DatabaseId): Promise<void> {
    await this.db.delete(databases).where(eq(databases.id, id.value));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .select({ count: databases.id })
      .from(databases)
      .where(eq(databases.organizationId, organizationId.value));

    return result.length;
  }
}