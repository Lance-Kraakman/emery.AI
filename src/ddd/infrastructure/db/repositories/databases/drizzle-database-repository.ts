// AIDEV-NOTE: Drizzle implementation of Database repository
// Handles data persistence for Database domain entities

import type { IDatabaseRepository, CreateDatabaseData, UpdateDatabaseData } from '@/ddd/domain/databases/repositories/database-repository';
import { Database } from '@/ddd/domain/databases/entities/database';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import type { DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { databases } from '@/ddd/infrastructure/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import type { DbClient } from '@/ddd/infrastructure/db/client';

export class DrizzleDatabaseRepository 
  extends DrizzleBaseRepository<Database, DatabaseId, CreateDatabaseData, UpdateDatabaseData, any>
  implements IDatabaseRepository {
  
  protected readonly table = databases;
  protected readonly idColumn = databases.id;
  protected readonly organizationColumn = databases.organizationId;

  async create(data: CreateDatabaseData): Promise<Database> {
    const [record] = await this.db
      .insert(databases)
      .values({
        name: data.name,
        slug: data.slug,
        metadata: data.metadata,
        organizationId: data.organizationId,
        ownerId: data.ownerId,
        agentId: data.agentId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return this.fromPersistence(record);
  }
  
  async update(id: DatabaseId, data: UpdateDatabaseData): Promise<Database> {
    const updateData = {
      ...data,
      updatedAt: new Date()
    };
    
    const [record] = await this.db
      .update(databases)
      .set(updateData)
      .where(eq(databases.id, id.value))
      .returning();
    
    if (!record) {
      throw new Error(`Database with id ${id.value} not found`);
    }
    
    return this.fromPersistence(record);
  }

  // Inherits findById from base class
  // Inherits findByOrganization from base class  
  // Inherits delete from base class

  async findBySlug(slug: string): Promise<Database | null> {
    const results = await this.db
      .select()
      .from(databases)
      .where(eq(databases.slug, slug))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.fromPersistence(results[0]);
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
      .select()
      .from(databases)
      .where(and(...conditions))
      .limit(1);

    return results.length === 0;
  }

  // Legacy save method - kept for backward compatibility during transition
  async save(database: Database): Promise<Database> {
    const data = database.toPersistence();

    if (data.id && data.id > 0) {
      // Update existing database
      const [record] = await this.db
        .update(databases)
        .set({
          name: data.name,
          slug: data.slug,
          metadata: data.metadata,
          updatedAt: new Date()
        })
        .where(eq(databases.id, data.id))
        .returning();

      return this.fromPersistence(record);
    } else {
      // Create new database
      const [record] = await this.db
        .insert(databases)
        .values({
          name: data.name,
          slug: data.slug,
          metadata: data.metadata,
          organizationId: data.organizationId,
          ownerId: data.ownerId,
          agentId: data.agentId || null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return this.fromPersistence(record);
    }
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .select({ count: databases.id })
      .from(databases)
      .where(eq(databases.organizationId, organizationId.value));

    return result.length;
  }

  async updateAgent(id: DatabaseId, agentId: number | null): Promise<Database> {
    const [record] = await this.db
      .update(databases)
      .set({
        agentId: agentId,
        updatedAt: new Date()
      })
      .where(eq(databases.id, id.value))
      .returning();

    if (!record) {
      throw new Error(`Database with id ${id.value} not found`);
    }

    return this.fromPersistence(record);
  }

  protected fromPersistence(record: any): Database {
    return Database.fromPersistence({
      id: record.id,
      name: record.name,
      slug: record.slug,
      metadata: record.metadata as Record<string, any> | null,
      organizationId: record.organizationId,
      ownerId: record.ownerId,
      agentId: record.agentId ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    });
  }
  
  protected toPersistence(database: Database): any {
    return database.toPersistence();
  }
}