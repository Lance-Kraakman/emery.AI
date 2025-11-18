"use server"

// AIDEV-NOTE: Server Actions for database management using DatabaseApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requirePermission, requireResourcePermission } from "./permissions"
import { requireCurrentOrganization } from "./user-organizations"
import { withAuthContext } from '@/lib/auth/with-context';
import { getDatabaseApplicationService } from "@/ddd/application/di/container"
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
  metadata: z.record(z.any()).optional(),
})

const updateDatabaseSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Database name is required").optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export async function getDatabases(searchQuery?: string, hasTables?: boolean): Promise<DatabaseDTO[]> {
  try {
    const session = await requirePermission("database:view");
    const currentOrg = await requireCurrentOrganization();

    const databaseApplicationService = getDatabaseApplicationService();

    const filters: DatabaseFiltersDTO = {
      organizationId: currentOrg.id,
      searchQuery,
      hasTables
    };

    const databases = await databaseApplicationService.getDatabases(filters);
    return databases; // Service now returns DatabaseDTO[]
  } catch (error) {
    console.error('Error fetching databases:', error)
    throw new Error('Failed to fetch databases')
  }
}

export async function getDatabase(id: number): Promise<DatabaseDTO> {
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
}

export async function createDatabase(data: z.infer<typeof createDatabaseSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("database:create");
    const currentOrg = await requireCurrentOrganization();

    const validatedData = createDatabaseSchema.parse(data);

    const databaseApplicationService = getDatabaseApplicationService();

    const dto: CreateDatabaseDTO = {
      name: validatedData.name,
      description: validatedData.description,
      metadata: validatedData.metadata,
      organizationId: currentOrg.id,
      ownerId: session.user.id
    };

    const result = await databaseApplicationService.createDatabase(dto);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create database"
      };
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
}

export async function updateDatabase(data: z.infer<typeof updateDatabaseSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const validatedData = updateDatabaseSchema.parse(data);

    if (!validatedData.id) {
      return { success: false, error: "Database ID is required" };
    }

    await requireResourcePermission("database:manage", "database", validatedData.id);

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
}

export async function deleteDatabase(id: number, revalidateUrl?: string): Promise<Result> {
  try {
    if (!id) {
      return { success: false, error: "Database ID is required" };
    }

    await requireResourcePermission("database:manage", "database", id);

    const currentOrg = await requireCurrentOrganization();
    const databaseApplicationService = getDatabaseApplicationService();
    const result = await databaseApplicationService.deleteDatabase(DatabaseId.fromNumber(id), OrganizationId.fromNumber(currentOrg.id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete database"
      };
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
      data: { message: "Database deleted successfully" },
      warnings: result.warnings
    };
  } catch (error) {
    console.error('Error deleting database:', error)
    return { success: false, error: "Failed to delete database" }
  }
}

/**
 * Get database count for the current organization
 */
export async function getDatabaseCount() {
  try {
    const session = await requirePermission("database:view");
    const currentOrg = await requireCurrentOrganization();

    const databaseApplicationService = getDatabaseApplicationService();
    return await databaseApplicationService.getDatabaseCount(OrganizationId.fromNumber(currentOrg.id));
  } catch (error) {
    console.error('Error fetching database count:', error);
    throw new Error('Failed to fetch database count');
  }
}

/**
 * Duplicate an existing database with all its tables
 * Appends " (Copy)" to the database name and copies all tables
 */
export async function duplicateDatabase(id: number, revalidateUrl?: string): Promise<Result> {
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

    // Create the duplicated database
    const dto: CreateDatabaseDTO = {
      name: newName,
      description: originalDatabase.description || undefined,
      metadata: originalDatabase.metadata || {},
      organizationId: currentOrg.id,
      ownerId: session.user.id
    };

    const result = await databaseApplicationService.createDatabase(dto);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to duplicate database"
      };
    }

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
}

/**
 * Get database by slug
 */
export async function getDatabaseBySlug(slug: string): Promise<DatabaseDTO> {
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
}