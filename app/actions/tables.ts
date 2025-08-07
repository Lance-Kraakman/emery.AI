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
import type { ActionResult, CreateTableData } from "./types";

export async function createTable(data: CreateTableData): Promise<ActionResult> {
  try {
    const session = await requirePermission("create_table");
    const { organizationId, name } = data;

    if (!organizationId || !name) {
      return {
        success: false,
        error: "organizationId and name are required",
      };
    }

    // Verify organization exists and user has access
    const organization = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
      
    if (organization.length === 0) {
      return {
        success: false,
        error: "Organization not found",
      };
    }

    // Check if user belongs to this organization
    if (session.user.organizationId !== organizationId) {
      return {
        success: false,
        error: "Access denied: user not in organization",
      };
    }

    const dbName = generateTableName(name);

    // Create dynamic table first
    await createDynamicTable(dbName);

    // Then create metadata entry
    const [newTable] = await db.insert(tables).values({
      organizationId,
      name,
      dbName,
      createdBy: session.user.id,
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
  const organizationId = parseInt(formData.get('organizationId') as string);
  const name = formData.get('name') as string;

  const result = await createTable({ organizationId, name });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getTables(organizationId?: number) {
  try {
    console.log(`[GET-TABLES] Fetching tables for organizationId: ${organizationId}`);
    
    // Check authentication
    let session;
    try {
      session = await requireAuth();
      console.log(`[GET-TABLES] Auth session:`, { 
        userId: session.user?.id?.substring(0, 8) + '...', 
        email: session.user?.email,
        organizationId: session.user?.organizationId,
        roleId: session.user?.roleId,
        needsSetup: session.user?.needsSetup 
      });
    } catch (authError) {
      console.error(`[GET-TABLES] Authentication failed:`, authError);
      // Return empty array for auth failures instead of throwing - let the UI handle it
      return [];
    }

    const targetOrgId = organizationId || session.user.organizationId;
    console.log(`[GET-TABLES] Target organization ID: ${targetOrgId}`);
    
    if (!targetOrgId) {
      console.log(`[GET-TABLES] No organization ID available - user may need to complete setup`);
      // Return empty array instead of throwing error - user likely needs to complete setup
      return [];
    }

    // Check if user has access to this organization
    if (organizationId && session.user.organizationId !== organizationId) {
      console.warn(`[GET-TABLES] User ${session.user.id} trying to access org ${organizationId} but belongs to ${session.user.organizationId}`);
      // Return empty array instead of throwing - this is an access issue, not a system error
      return [];
    }

    console.log(`[GET-TABLES] Querying database for tables in organization ${targetOrgId}`);
    let tableList;
    try {
      tableList = await db
        .select()
        .from(tables)
        .where(eq(tables.organizationId, targetOrgId));
    } catch (dbError) {
      console.error(`[GET-TABLES] Database query failed:`, dbError);
      throw new Error(`Database query failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

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
  return result;
}