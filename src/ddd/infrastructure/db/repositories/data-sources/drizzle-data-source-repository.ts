/**
 * Drizzle implementation of DataSourceRepository
 *
 * AIDEV-NOTE: Handles data access for DataSource entities using PostgreSQL.
 * Follows DDD repository pattern - maps between domain entities and database records.
 */

import type { DbClient } from "@/lib/db/client";
import { dataSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { DataSourceRepository } from "@/ddd/domain/data-sources/repositories/data-source-repository";
import { DataSource } from "@/ddd/domain/data-sources/entities/data-source";
import { DataSourceId } from "@/ddd/domain/data-sources/value-objects/data-source-id";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";

export class DrizzleDataSourceRepository implements DataSourceRepository {
  constructor(private readonly db: DbClient) {}

  async save(dataSource: DataSource): Promise<DataSource> {
    try {
      const persistence = dataSource.toPersistence();

      // If ID is 0, this is a new entity - use insert
      if (persistence.id === 0) {
        const [record] = await this.db
          .insert(dataSources)
          .values({
            organizationId: persistence.organizationId,
            tableId: persistence.tableId,
            name: persistence.name,
            filters: persistence.filters,
            sorting: persistence.sorting,
            pagination: persistence.pagination,
            createdAt: persistence.createdAt,
            updatedAt: persistence.updatedAt,
          })
          .returning();

        return this.toDomain(record);
      } else {
        // Update existing entity
        const [record] = await this.db
          .update(dataSources)
          .set({
            name: persistence.name,
            filters: persistence.filters,
            sorting: persistence.sorting,
            pagination: persistence.pagination,
            updatedAt: new Date(),
          })
          .where(eq(dataSources.id, persistence.id))
          .returning();

        if (!record) {
          throw new Error(`DataSource ${persistence.id} not found`);
        }

        return this.toDomain(record);
      }
    } catch (error) {
      console.error("[DrizzleDataSourceRepository] Error saving data source:", error);
      throw error;
    }
  }

  async findById(id: DataSourceId): Promise<DataSource | null> {
    try {
      const record = await this.db.query.dataSources.findFirst({
        where: eq(dataSources.id, id.value),
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error("[DrizzleDataSourceRepository] Error finding data source by ID:", error);
      throw error;
    }
  }

  async findByTableId(tableId: TableId): Promise<DataSource[]> {
    try {
      const records = await this.db.query.dataSources.findMany({
        where: eq(dataSources.tableId, tableId.value),
      });

      return records.map((record: any) => this.toDomain(record));
    } catch (error) {
      console.error("[DrizzleDataSourceRepository] Error finding data sources by table ID:", error);
      throw error;
    }
  }

  async findByOrganizationId(organizationId: OrganizationId): Promise<DataSource[]> {
    try {
      const records = await this.db.query.dataSources.findMany({
        where: eq(dataSources.organizationId, organizationId.value),
      });

      // Sort by name on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: DataSource, b: DataSource) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(
        "[DrizzleDataSourceRepository] Error finding data sources by organization ID:",
        error
      );
      throw error;
    }
  }

  async findByName(organizationId: OrganizationId, name: string): Promise<DataSource | null> {
    try {
      const record = await this.db.query.dataSources.findFirst({
        where: and(
          eq(dataSources.organizationId, organizationId.value),
          eq(dataSources.name, name)
        ),
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error("[DrizzleDataSourceRepository] Error finding data source by name:", error);
      throw error;
    }
  }

  async delete(id: DataSourceId): Promise<void> {
    try {
      await this.db.delete(dataSources).where(eq(dataSources.id, id.value));

      console.log(`[DrizzleDataSourceRepository] Deleted data source ID: ${id.value}`);
    } catch (error) {
      console.error("[DrizzleDataSourceRepository] Error deleting data source:", error);
      throw error;
    }
  }

  async existsByName(organizationId: OrganizationId, name: string): Promise<boolean> {
    try {
      const record = await this.db.query.dataSources.findFirst({
        where: and(
          eq(dataSources.organizationId, organizationId.value),
          eq(dataSources.name, name)
        ),
      });

      return !!record;
    } catch (error) {
      console.error("[DrizzleDataSourceRepository] Error checking name existence:", error);
      throw error;
    }
  }

  /**
   * Helper method to convert database record to domain entity
   */
  private toDomain(record: any): DataSource {
    return DataSource.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      tableId: record.tableId,
      name: record.name,
      filters: record.filters,
      sorting: record.sorting,
      pagination: record.pagination,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
