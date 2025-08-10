'use server'

// AIDEV-NOTE: Server Actions for table management - replaces /api/tables route
// AIDEV-TODO: Add transaction support for table creation/deletion with dynamic tables

import { db } from "@/lib/db/client";
import { tables, organizations } from "@/lib/db/schema";
import { createDynamicTable, dropDynamicTable } from "@/lib/db/dynamic";
import { generateTableName } from "@/utils/slugify";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { autoReindexService } from "@/lib/rag/auto-reindex";
import type { ActionResult, CreateTableData } from "./types";

export async function createTable(data: CreateTableData): Promise<ActionResult> {
  try {
    const session = await requirePermission("create_table");
    const currentOrg = await requireCurrentOrganization();
    const { name } = data;

    if (!name) {
      return {
        success: false,
        error: "name is required",
      };
    }

    const dbName = generateTableName(name);

    // Create dynamic table first
    await createDynamicTable(dbName);

    // Then create metadata entry using current organization
    const [newTable] = await db.insert(tables).values({
      organizationId: currentOrg.id,
      name,
      dbName,
      createdBy: session.user.id,
    }).returning();

    // Trigger RAG reindexing for tables domain in this organization
    autoReindexService.debouncedReindex(currentOrg.id, 'tables').catch(console.error);
    
    revalidatePath('/mission-control');
    
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

  const result = await createTable({ name });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/mission-control');
  return result;
}

export async function getTables() {
  try {
    const currentOrg = await requireCurrentOrganization();
    
    const tableList = await db
      .select()
      .from(tables)
      .where(eq(tables.organizationId, currentOrg.id));

    console.log(`[GET-TABLES] Found ${tableList.length} tables:`, tableList.map(t => ({ id: t.id, name: t.name, dbName: t.dbName })));
    return tableList;
  } catch (error) {
    console.error("Error fetching tables:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    
    // Return empty array instead of throwing error to prevent UI crashes
    // The logs will help diagnose the issue
    console.log(`[GET-TABLES] Returning empty array due to error to prevent UI crash`);
    return [];
  }
}

export async function deleteTable(tableId: number): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_tables");
    const currentOrg = await requireCurrentOrganization();
    
    if (!tableId) {
      return {
        success: false,
        error: "Table ID is required",
      };
    }

    // Get table info and verify it belongs to current organization
    const [table] = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);
    
    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Verify table belongs to current organization
    if (table.organizationId !== currentOrg.id) {
      return {
        success: false,
        error: "Access denied: table not in current organization",
      };
    }

    // Drop dynamic table first
    await dropDynamicTable(table.dbName);
    
    // Then delete metadata
    await db.delete(tables).where(eq(tables.id, tableId));

    revalidatePath('/mission-control');
    
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

  revalidatePath('/mission-control');
  return result;
}