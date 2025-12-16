/**
 * Drizzle implementation of ViewRepository
 *
 * AIDEV-NOTE: Handles data access for View entities using PostgreSQL.
 * Follows DDD repository pattern - maps between domain entities and database records.
 */

import type { DbClient } from "@/lib/db/client";
import { views, fields, tables } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { ViewRepository } from "@/ddd/domain/views/repositories/view-repository";
import { View } from "@/ddd/domain/views/entities/view";
import { ViewId } from "@/ddd/domain/views/value-objects/view-id";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";
import { TableField } from "@/ddd/domain/tables/value-objects/table-field";

export class DrizzleViewRepository implements ViewRepository {
  constructor(
    private readonly db: DbClient,
    private readonly rawDb: DbClient // Raw db for public queries (bypasses RLS)
  ) {}

  async save(dataSource: View): Promise<View> {
    try {
      const persistence = dataSource.toPersistence();

      // If ID is 0, this is a new entity - use insert
      if (persistence.id === 0) {
        const [record] = await this.db
          .insert(views)
          .values({
            organizationId: persistence.organizationId,
            tableId: persistence.tableId,
            name: persistence.name,
            ownerId: persistence.createdBy, // Map createdBy to ownerId for database
            viewType: persistence.viewType,
            viewConfig: persistence.viewConfig,
            requiresAuth: persistence.requiresAuth, // Include requiresAuth in insert
            filters: persistence.filters,
            sorting: persistence.sorting,
            pagination: persistence.pagination,
            fieldMappings: persistence.fieldMappings ?? null,
            createdAt: persistence.createdAt,
            updatedAt: persistence.updatedAt,
          })
          .returning();

        return this.toDomain(record);
      } else {
        // Update existing entity
        const [record] = await this.db
          .update(views)
          .set({
            name: persistence.name,
            viewType: persistence.viewType,
            viewConfig: persistence.viewConfig,
            requiresAuth: persistence.requiresAuth, // Include requiresAuth in update
            filters: persistence.filters,
            sorting: persistence.sorting,
            pagination: persistence.pagination,
            fieldMappings: persistence.fieldMappings ?? null,
            updatedAt: new Date(),
          })
          .where(eq(views.id, persistence.id))
          .returning();

        if (!record) {
          throw new Error(`View ${persistence.id} not found`);
        }

        return this.toDomain(record);
      }
    } catch (error) {
      console.error("[DrizzleViewRepository] Error saving view:", error);
      throw error;
    }
  }

  async findById(id: ViewId): Promise<View | null> {
    try {
      const record = await this.db.query.views.findFirst({
        where: eq(views.id, id.value),
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error("[DrizzleViewRepository] Error finding view by ID:", error);
      throw error;
    }
  }

  /**
   * Find a public view by ID (bypasses RLS using raw db)
   * Only returns views where requiresAuth = false
   *
   * AIDEV-NOTE: This method uses rawDb to bypass RLS policies.
   * Security is enforced at application level by checking requiresAuth = false.
   */
  async findByIdPublic(id: ViewId): Promise<View | null> {
    try {
      const record = await this.rawDb.query.views.findFirst({
        where: and(
          eq(views.id, id.value),
          eq(views.requiresAuth, false)
        ),
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error("[DrizzleViewRepository] Error finding public view by ID:", error);
      throw error;
    }
  }

  async findByTableId(tableId: TableId): Promise<View[]> {
    try {
      const records = await this.db.query.views.findMany({
        where: eq(views.tableId, tableId.value),
      });

      return records.map((record: any) => this.toDomain(record));
    } catch (error) {
      console.error("[DrizzleViewRepository] Error finding views by table ID:", error);
      throw error;
    }
  }

  async findByOrganizationId(organizationId: OrganizationId): Promise<View[]> {
    try {
      const records = await this.db.query.views.findMany({
        where: eq(views.organizationId, organizationId.value),
      });

      // Sort by name on the application side
      return records
        .map((record: any) => this.toDomain(record))
        .sort((a: View, b: View) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(
        "[DrizzleViewRepository] Error finding views by organization ID:",
        error
      );
      throw error;
    }
  }

  async findByName(organizationId: OrganizationId, name: string): Promise<View | null> {
    try {
      const record = await this.db.query.views.findFirst({
        where: and(
          eq(views.organizationId, organizationId.value),
          eq(views.name, name)
        ),
      });

      return record ? this.toDomain(record) : null;
    } catch (error) {
      console.error("[DrizzleViewRepository] Error finding view by name:", error);
      throw error;
    }
  }

  async delete(id: ViewId): Promise<void> {
    try {
      await this.db.delete(views).where(eq(views.id, id.value));

      console.log(`[DrizzleViewRepository] Deleted view ID: ${id.value}`);
    } catch (error) {
      console.error("[DrizzleViewRepository] Error deleting view:", error);
      throw error;
    }
  }

  async existsByName(organizationId: OrganizationId, name: string): Promise<boolean> {
    try {
      const record = await this.db.query.views.findFirst({
        where: and(
          eq(views.organizationId, organizationId.value),
          eq(views.name, name)
        ),
      });

      return !!record;
    } catch (error) {
      console.error("[DrizzleViewRepository] Error checking name existence:", error);
      throw error;
    }
  }

  /**
   * Get table metadata for a public view (bypasses RLS using raw db)
   * Only returns table if the view is public (requiresAuth = false)
   *
   * AIDEV-NOTE: This method is used for unauthenticated access to public view data.
   * Returns the minimal table info needed to query Delta Lake (s3Path).
   */
  async findTableForPublicView(viewId: ViewId): Promise<{
    tableId: number;
    organizationId: number;
    databaseId: number;
    s3Path: string;
  } | null> {
    try {
      // First verify the view exists and is public
      const viewRecord = await this.rawDb.query.views.findFirst({
        where: and(
          eq(views.id, viewId.value),
          eq(views.requiresAuth, false)
        ),
      });

      if (!viewRecord) {
        return null;
      }

      // Get the table metadata using rawDb
      const tableRecord = await this.rawDb.query.tables.findFirst({
        where: eq(tables.id, viewRecord.tableId),
      });

      if (!tableRecord) {
        return null;
      }

      return {
        tableId: tableRecord.id,
        organizationId: tableRecord.organizationId,
        databaseId: tableRecord.databaseId,
        s3Path: tableRecord.s3Path,
      };
    } catch (error) {
      console.error("[DrizzleViewRepository] Error finding table for public view:", error);
      throw error;
    }
  }

  /**
   * Get fields for a public view's table (bypasses RLS using raw db)
   * Only returns fields if the view is public (requiresAuth = false)
   *
   * AIDEV-NOTE: This method is used for unauthenticated access to public view schemas.
   * Uses rawDb to bypass RLS, but only for views explicitly marked as public.
   */
  async findFieldsForPublicView(viewId: ViewId): Promise<TableField[] | null> {
    try {
      // First verify the view exists and is public
      const viewRecord = await this.rawDb.query.views.findFirst({
        where: and(
          eq(views.id, viewId.value),
          eq(views.requiresAuth, false)
        ),
      });

      if (!viewRecord) {
        return null;
      }

      // Now get fields for the view's table using rawDb
      const fieldRecords = await this.rawDb.query.fields.findMany({
        where: eq(fields.tableId, viewRecord.tableId),
        orderBy: [asc(fields.orderIndex)],
      });

      // Convert to domain entities using fromPersistence (for existing records with IDs)
      return fieldRecords.map((record: any) =>
        TableField.fromPersistence({
          id: record.id,
          tableId: viewRecord.tableId,
          name: record.name,
          type: record.type,
          orderIndex: record.orderIndex ?? 0,
          relatedTableId: record.fieldConfig?.targetTableId ?? null,
          required: record.required ?? false,
          metadata: record.fieldConfig ?? null,
          createdAt: record.createdAt,
        })
      );
    } catch (error) {
      console.error("[DrizzleViewRepository] Error finding fields for public view:", error);
      throw error;
    }
  }

  /**
   * Helper method to convert database record to domain entity
   */
  private toDomain(record: any): View {
    return View.fromPersistence({
      id: record.id,
      organizationId: record.organizationId,
      tableId: record.tableId,
      name: record.name,
      viewType: record.viewType || 'grid',
      viewConfig: record.viewConfig || { type: 'grid' },
      requiresAuth: record.requiresAuth ?? true, // Read from DB, default true if missing
      filters: record.filters,
      sorting: record.sorting,
      pagination: record.pagination,
      fieldMappings: record.fieldMappings ?? undefined,
      createdBy: record.ownerId, // Map ownerId from database to createdBy for domain
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
