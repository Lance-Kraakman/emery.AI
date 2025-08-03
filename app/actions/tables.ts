'use server'

// AIDEV-NOTE: Server Actions for table management - replaces /api/tables route
// AIDEV-TODO: Add transaction support for table creation/deletion with dynamic tables

import { db } from "@/lib/db/client";
import { tables, workspaces } from "@/lib/db/schema";
import { createDynamicTable, dropDynamicTable } from "@/lib/db/dynamic";
import { generateTableName } from "@/utils/slugify";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult, CreateTableData } from "./types";

export async function createTable(data: CreateTableData): Promise<ActionResult> {
  try {
    const { workspaceId, name } = data;

    if (!workspaceId || !name) {
      return {
        success: false,
        error: "workspaceId and name are required",
      };
    }

    // Verify workspace exists
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
      
    if (workspace.length === 0) {
      return {
        success: false,
        error: "Workspace not found",
      };
    }

    const dbName = generateTableName(name);

    // Create dynamic table first
    await createDynamicTable(dbName);

    // Then create metadata entry
    const [newTable] = await db.insert(tables).values({
      workspaceId,
      name,
      dbName,
    }).returning();

    revalidatePath('/dashboard');
    
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
  const workspaceId = parseInt(formData.get('workspaceId') as string);
  const name = formData.get('name') as string;

  const result = await createTable({ workspaceId, name });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
}

export async function getTables(workspaceId: number) {
  try {
    if (!workspaceId) {
      throw new Error("workspaceId is required");
    }

    const tableList = await db
      .select()
      .from(tables)
      .where(eq(tables.workspaceId, workspaceId));

    return tableList;
  } catch (error) {
    console.error("Error fetching tables:", error);
    throw new Error("Failed to fetch tables");
  }
}

export async function deleteTable(tableId: number): Promise<ActionResult> {
  try {
    if (!tableId) {
      return {
        success: false,
        error: "Table ID is required",
      };
    }

    // Get table info first
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

    // Drop dynamic table first
    await dropDynamicTable(table.dbName);
    
    // Then delete metadata
    await db.delete(tables).where(eq(tables.id, tableId));

    revalidatePath('/dashboard');
    
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

  revalidatePath('/dashboard');
}