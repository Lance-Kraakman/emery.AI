'use server'

// AIDEV-NOTE: Server Actions for table management using domain repositories
// Migrated from legacy dynamic.ts to domain-driven architecture

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getDynamicTableRepository } from "@/ddd/application/di/container";
// import { getDynamicTableRepository } from "@/lib/application/di/container";
import { slugify } from "@/utils/slugify";
import type { ActionResult, CreateTableData } from "./types";
import type { CreateDynamicTableData } from "./types";

export async function createTable(data: CreateTableData & { databaseId: number; description?: string }, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("create_table");
    const currentOrg = await requireCurrentOrganization();
    const { name, databaseId, description } = data;

    if (!name) {
      return {
        success: false,
        error: "name is required",
      };
    }

    if (!databaseId) {
      return {
        success: false,
        error: "Database selection is required. Tables must belong to a database.",
      };
    }

    // AIDEV-TODO: Verify database exists and belongs to organization using a DatabaseRepository
    
    const dynamicTableRepository = getDynamicTableRepository();

    const tableData: CreateDynamicTableData = {
      name,
      dbName: slugify(name),
      databaseId,
      organizationId: currentOrg.id,
      createdBy: session.user.id,
      metadata: description ? { description } : undefined,
    };

    const newTable = await dynamicTableRepository.create(tableData);

    // Note: RAG reindexing is now handled automatically by database triggers
    
    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for table operations
    }
    
    return {
      success: true,
      data: newTable,
    };
  } catch (error) {
    console.error("Error creating table:", error);
    return {
      success: false,
      error: "Failed to create table",
    };
  }
}

export async function createTableAction(formData: FormData) {
  const name = formData.get('name') as string;
  const databaseId = parseInt(formData.get('databaseId') as string);

  if (!databaseId) {
    throw new Error("Database ID is required");
  }

  const result = await createTable({ name, databaseId });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main createTable function
  return result;
}

export async function getTables() {
  try {
    const currentOrg = await requireCurrentOrganization();
    const dynamicTableRepository = getDynamicTableRepository();
    
    // AIDEV-TODO: Enhance findByOrganization to include database details
    const tableList = await dynamicTableRepository.findByOrganization(currentOrg.id);

    console.log(`[GET-TABLES] Found ${tableList.length} tables for org ${currentOrg.id}`);
    return tableList;
  } catch (error) {
    console.error("Error fetching tables:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    // Return empty array instead of throwing error to prevent UI crashes
    console.log(`[GET-TABLES] Returning empty array due to error to prevent UI crash`);
    return [];
  }
}

export async function deleteTable(tableId: number, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_tables");
    const currentOrg = await requireCurrentOrganization();
    
    if (!tableId) {
      return {
        success: false,
        error: "Table ID is required",
      };
    }

    const dynamicTableRepository = getDynamicTableRepository();

    // Verify table exists and belongs to the current organization
    const table = await dynamicTableRepository.findById(tableId);
    if (!table || table.organizationId !== currentOrg.id) {
      return {
        success: false,
        error: "Table not found or access denied",
      };
    }

    // Delete table using domain repository (handles both metadata and physical table)
    await dynamicTableRepository.delete(tableId);

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for table operations
    }
    
    return {
      success: true,
      data: { message: "Table deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting table:", error);
    return {
      success: false,
      error: "Failed to delete table",
    };
  }
}

export async function deleteTableAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);

  const result = await deleteTable(tableId);
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main deleteTable function
  return result;
}
