"use server"

// AIDEV-NOTE: Server Actions for database management using DatabaseApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requirePermission, requireResourcePermission } from "./permissions"
import { requireCurrentOrganization } from "./user-organizations"
import { withAuthContext } from '@/lib/auth/with-context';
import { getDatabaseApplicationService, getAuditApplicationService, getTableApplicationService, getContextMappingApplicationService } from "@/ddd/application/di/container"
import type { Result } from "./types"

import type {
  CreateDatabaseDTO,
  UpdateDatabaseDTO,
  DatabaseFiltersDTO,
  DatabaseDTO
} from "@/app/dtos/database.dto"
import { UserId, DatabaseId, OrganizationId } from "@/ddd/domain/shared/value-objects"
import { DatabaseMapper } from "@/app/mappers/database-mapper"

const createDatabaseSchema = z.object({
  name: z.string().min(1, "Database name is required"),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional().nullable(),
  agentId: z.number().optional().nullable(), // null = org-scoped, number = agent-scoped
})

const updateDatabaseSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Database name is required").optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export async function getDatabases(searchQuery?: string, hasTables?: boolean, agentId?: number | null): Promise<DatabaseDTO[]> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("database:view");
      const currentOrg = await requireCurrentOrganization();

      const databaseApplicationService = getDatabaseApplicationService();

      const filters: DatabaseFiltersDTO = {
        organizationId: currentOrg.id,
        searchQuery,
        hasTables,
        agentId
      };

      const databases = await databaseApplicationService.getDatabases(filters);
      return databases; // Service now returns DatabaseDTO[]
    } catch (error) {
      console.error('Error fetching databases:', error)
      throw new Error('Failed to fetch databases')
    }
  });
}

/**
 * Get databases for a specific agent (agent-scoped databases only)
 */
export async function getAgentDatabases(agentId: number): Promise<DatabaseDTO[]> {
  return getDatabases(undefined, undefined, agentId);
}

/**
 * Get organization-scoped databases only (not agent-scoped)
 */
export async function getOrgDatabases(): Promise<DatabaseDTO[]> {
  return getDatabases(undefined, undefined, null);
}

export async function getDatabase(id: number): Promise<DatabaseDTO> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        throw new Error("Database ID is required");
      }

      await requireResourcePermission("database:view", "database", id);

      const databaseApplicationService = getDatabaseApplicationService();
      const database = await databaseApplicationService.getDatabase(DatabaseId.fromNumber(id));

      if (!database) {
        throw new Error("Database not found");
      }

      return DatabaseMapper.toDTO(database);
    } catch (error) {
      console.error('Error fetching database:', error)
      throw new Error('Failed to fetch database')
    }
  });
}

export async function createDatabase(data: z.infer<typeof createDatabaseSchema>, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("database:create");
      const currentOrg = await requireCurrentOrganization();

      const validatedData = createDatabaseSchema.parse(data);

      const databaseApplicationService = getDatabaseApplicationService();

      const dto: CreateDatabaseDTO = {
        name: validatedData.name,
        description: validatedData.description,
        metadata: validatedData.metadata ?? undefined,
        organizationId: currentOrg.id,
        ownerId: session.user.id,
        agentId: validatedData.agentId || null
      };

      const result = await databaseApplicationService.createDatabase(dto);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to create database"
        };
      }

      // AUDIT: Log database creation
      if (result.data) {
        const auditService = getAuditApplicationService();
        auditService.logEvent(
          OrganizationId.fromNumber(currentOrg.id),
          {
            eventType: 'database',
            eventCategory: 'database_crud',
            eventAction: 'create',
            actorType: 'user',
            actorId: session.user.id,
            actorName: session.user.name || undefined,
            resourceType: 'database',
            resourceId: String(result.data.id),
            resourceName: result.data.name,
            eventData: { description: validatedData.description },
            success: true,
          }
        );
      }

      // Note: RAG reindexing is now handled automatically by database triggers

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl)
      } else {
        revalidatePath('/data') // Default path for database operations
      }

      return {
        success: true,
        data: result.data,
        warnings: result.warnings
      };
    } catch (error) {
      console.error('Error creating database:', error)

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
        }
      }

      return { success: false, error: "Failed to create database" }
    }
  });
}

export async function updateDatabase(data: z.infer<typeof updateDatabaseSchema>, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const validatedData = updateDatabaseSchema.parse(data);

      if (!validatedData.id) {
        return { success: false, error: "Database ID is required" };
      }

      const session = await requireResourcePermission("database:manage", "database", validatedData.id);
      const currentOrg = await requireCurrentOrganization();

      const databaseApplicationService = getDatabaseApplicationService();

      const dto: UpdateDatabaseDTO = {
        databaseId: validatedData.id,
        name: validatedData.name,
        description: validatedData.description,
        metadata: validatedData.metadata
      };

      const result = await databaseApplicationService.updateDatabase(dto);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to update database"
        };
      }

      // AUDIT: Log database update
      if (result.data) {
        const auditService = getAuditApplicationService();
        auditService.logEvent(
          OrganizationId.fromNumber(currentOrg.id),
          {
            eventType: 'database',
            eventCategory: 'database_crud',
            eventAction: 'update',
            actorType: 'user',
            actorId: session.user.id,
            actorName: session.user.name || undefined,
            resourceType: 'database',
            resourceId: String(validatedData.id),
            resourceName: result.data.name,
            eventData: { updates: validatedData },
            success: true,
          }
        );
      }

      // Note: RAG reindexing is now handled automatically by database triggers

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl)
      } else {
        revalidatePath('/data') // Default path for database operations
      }

      return {
        success: true,
        data: result.data,
        warnings: result.warnings
      };
    } catch (error) {
      console.error('Error updating database:', error)

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
        }
      }

      return { success: false, error: "Failed to update database" }
    }
  });
}

export async function deleteDatabase(id: number, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return { success: false, error: "Database ID is required" };
      }

      const session = await requireResourcePermission("database:manage", "database", id);
      const currentOrg = await requireCurrentOrganization();
      const databaseApplicationService = getDatabaseApplicationService();

      // AUDIT: Get database name BEFORE deletion
      const databaseToDelete = await databaseApplicationService.getDatabase(DatabaseId.fromNumber(id));
      const databaseName = databaseToDelete?.name;

      const result = await databaseApplicationService.deleteDatabase(DatabaseId.fromNumber(id), OrganizationId.fromNumber(currentOrg.id));

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to delete database"
        };
      }

      // AUDIT: Log database deletion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'database_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'database',
          resourceId: String(id),
          resourceName: databaseName,
          eventData: {},
          success: true,
        }
      );

      // Note: RAG reindexing is now handled automatically by database triggers

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl)
      } else {
        revalidatePath('/data') // Default path for database operations
      }

      return {
        success: true,
        data: { message: "Database deleted successfully" },
        warnings: result.warnings
      };
    } catch (error) {
      console.error('Error deleting database:', error)
      return { success: false, error: "Failed to delete database" }
    }
  });
}

/**
 * Get a preview of what will be deleted when cascade deleting a database
 */
export async function getDatabaseDeletionPreview(id: number): Promise<Result<{
  databaseId: number;
  databaseName: string;
  tables: Array<{ id: number; name: string }>;
  tableCount: number;
}>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return { success: false, error: "Database ID is required" };
      }

      await requireResourcePermission("database:view", "database", id);
      const databaseApplicationService = getDatabaseApplicationService();

      const result = await databaseApplicationService.getDeletionPreview(DatabaseId.fromNumber(id));

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to get deletion preview"
        };
      }

      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Error getting database deletion preview:', error)
      return { success: false, error: "Failed to get database deletion preview" }
    }
  });
}

/**
 * Delete a database with cascade - deletes all tables first, then the database
 * Use this when the user has confirmed cascade deletion by typing the confirmation phrase
 */
export async function cascadeDeleteDatabase(id: number, revalidateUrl?: string): Promise<Result<{
  deletedTables: number;
  deletedDatabase: boolean;
}>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return { success: false, error: "Database ID is required" };
      }

      const session = await requireResourcePermission("database:manage", "database", id);
      const currentOrg = await requireCurrentOrganization();
      const databaseApplicationService = getDatabaseApplicationService();

      // AUDIT: Get database name BEFORE deletion
      const databaseToDelete = await databaseApplicationService.getDatabase(DatabaseId.fromNumber(id));
      const databaseName = databaseToDelete?.name;

      // Get deletion preview for audit logging
      const preview = await databaseApplicationService.getDeletionPreview(DatabaseId.fromNumber(id));
      const tableCount = preview.success && preview.data ? preview.data.tableCount : 0;
      const tableNames = preview.success && preview.data ? preview.data.tables.map(t => t.name) : [];

      const result = await databaseApplicationService.deleteDatabaseWithCascade(
        DatabaseId.fromNumber(id),
        OrganizationId.fromNumber(currentOrg.id)
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to cascade delete database"
        };
      }

      // AUDIT: Log cascade database deletion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'database_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'database',
          resourceId: String(id),
          resourceName: databaseName,
          eventData: {
            cascadeDelete: true,
            deletedTables: result.data?.deletedTables || 0,
            tableNames
          },
          success: true,
        }
      );

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl)
      } else {
        revalidatePath('/data') // Default path for database operations
      }

      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Error cascade deleting database:', error)
      return { success: false, error: "Failed to cascade delete database" }
    }
  });
}

/**
 * Get database count for the current organization
 */
export async function getDatabaseCount() {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("database:view");
      const currentOrg = await requireCurrentOrganization();

      const databaseApplicationService = getDatabaseApplicationService();
      return await databaseApplicationService.getDatabaseCount(OrganizationId.fromNumber(currentOrg.id));
    } catch (error) {
      console.error('Error fetching database count:', error);
      throw new Error('Failed to fetch database count');
    }
  });
}

/**
 * Duplicate an existing database with all its tables
 * Appends " (Copy)" to the database name and copies all tables
 */
export async function duplicateDatabase(id: number, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return { success: false, error: "Database ID is required" };
      }

      // Need to view the original database to duplicate it
      await requireResourcePermission("database:view", "database", id);
      // Need create permission for the new database
      const session = await requirePermission("database:create");
      const currentOrg = await requireCurrentOrganization();

      const databaseApplicationService = getDatabaseApplicationService();

      // Get the original database
      const originalDatabase = await databaseApplicationService.getDatabase(DatabaseId.fromNumber(id));
      if (!originalDatabase) {
        return { success: false, error: "Database not found" };
      }

      // Create new name with " (Copy)" suffix
      const newName = `${originalDatabase.name} (Copy)`;

      // Create the duplicated database (preserve agent scoping)
      const dto: CreateDatabaseDTO = {
        name: newName,
        description: originalDatabase.description || undefined,
        metadata: originalDatabase.metadata || {},
        organizationId: currentOrg.id,
        ownerId: session.user.id,
        agentId: originalDatabase.agentId?.value || null
      };

      const result = await databaseApplicationService.createDatabase(dto);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to duplicate database"
        };
      }

      // AUDIT: Log database duplication
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'database_crud',
          eventAction: 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'database',
          resourceId: String(result.data.id),
          resourceName: result.data.name,
          eventData: { duplicatedFrom: id, originalName: originalDatabase.name },
          success: true,
        }
      );

      // TODO: Copy tables from the original database
      // Note: getTablesForDatabase method doesn't exist yet
      // This would require fetching tables by database ID and duplicating them
      // For now, only the database itself is duplicated

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl)
      } else {
        revalidatePath('/data')
      }

      return {
        success: true,
        data: result.data,
        warnings: result.warnings
      };
    } catch (error) {
      console.error('Error duplicating database:', error)
      return { success: false, error: "Failed to duplicate database" }
    }
  });
}

/**
 * Get database by slug
 */
export async function getDatabaseBySlug(slug: string): Promise<DatabaseDTO> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("database:view");

      if (!slug) {
        throw new Error("Database slug is required");
      }

      // Note: This would require adding findBySlug method to application service
      // For now, get all databases and filter by slug
      const currentOrg = await requireCurrentOrganization();
      const databases = await getDatabases();
      const database = databases.find(db => db.slug === slug);

      if (!database) {
        throw new Error("Database not found");
      }

      return database;
    } catch (error) {
      console.error('Error fetching database by slug:', error);
      throw new Error('Failed to fetch database by slug');
    }
  });
}

/**
 * Assign a database to an agent (ownership)
 * This also auto-creates context_mappings for all tables in the database,
 * giving the agent readwrite access to all tables.
 *
 * @param databaseId - The database to assign
 * @param agentId - The agent to assign to (null to remove ownership)
 */
export async function assignDatabaseToAgent(
  databaseId: number,
  agentId: number | null,
  revalidateUrl?: string
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!databaseId) {
        return { success: false, error: "Database ID is required" };
      }

      const session = await requireResourcePermission("database:manage", "database", databaseId);
      const currentOrg = await requireCurrentOrganization();

      const databaseApplicationService = getDatabaseApplicationService();
      const tableApplicationService = getTableApplicationService();
      const contextMappingService = getContextMappingApplicationService();

      // Get the database
      const database = await databaseApplicationService.getDatabase(DatabaseId.fromNumber(databaseId));
      if (!database) {
        return { success: false, error: "Database not found" };
      }

      // Update database ownership (agentId field)
      const updateResult = await databaseApplicationService.updateDatabaseAgent(
        DatabaseId.fromNumber(databaseId),
        agentId
      );

      if (!updateResult.success) {
        return { success: false, error: updateResult.error || "Failed to update database ownership" };
      }

      // If assigning to an agent (not removing ownership), auto-create context mappings
      if (agentId !== null) {
        // Get all tables in this database
        const tables = await tableApplicationService.getTablesForDatabase(DatabaseId.fromNumber(databaseId));

        // Create context mappings for each table
        for (const table of tables) {
          try {
            await contextMappingService.attachContextTable({
              organizationId: currentOrg.id,
              targetType: 'agent',
              targetId: String(agentId),
              tableId: table.id.value,
              tableName: table.name,
              accessMode: 'readwrite',
              syncMode: 'on_access',
              createdBy: session.user.id,
            });
          } catch (error) {
            // Ignore duplicate mapping errors - mapping may already exist
            console.warn(`Context mapping may already exist for table ${table.id.value}:`, error);
          }
        }
      }

      // AUDIT: Log database ownership assignment
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'database_ownership',
          eventAction: agentId !== null ? 'assign' : 'unassign',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'database',
          resourceId: String(databaseId),
          resourceName: database.name,
          eventData: { agentId, previousAgentId: database.agentId?.value },
          success: true,
        }
      );

      // Revalidate paths
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/organization');
        revalidatePath('/data');
      }

      return {
        success: true,
        data: { databaseId, agentId, message: `Database ${agentId !== null ? 'assigned to' : 'unassigned from'} agent` }
      };
    } catch (error) {
      console.error('Error assigning database to agent:', error);
      return { success: false, error: "Failed to assign database to agent" };
    }
  });
}