'use server'

// AIDEV-NOTE: Server Actions for field management - replaces /api/fields route  
// AIDEV-TODO: Add transaction support for field creation/deletion with dynamic schema changes

import { db } from "@/lib/db/client";
import { fields, tables } from "@/lib/db/schema";
import { addFieldToTable, removeFieldFromTable } from "@/lib/db/dynamic";
import { slugify } from "@/utils/slugify";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { autoReindexService } from "@/lib/rag/auto-reindex";
import type { ActionResult, CreateFieldData } from "./types";

export async function createField(data: CreateFieldData, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("create_fields");
    const { tableId, name, type, required = false, relatedTableId } = data;

    if (!tableId || !name || !type) {
      return {
        success: false,
        error: "tableId, name, and type are required",
      };
    }

    // Verify table exists
    const [table] = await db.select().from(tables).where(eq(tables.id, tableId)).limit(1);
    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    const slug = slugify(name);

    // Check for duplicate field names
    const existingField = await db.select()
      .from(fields)
      .where(and(eq(fields.tableId, tableId), eq(fields.slug, slug)))
      .limit(1);

    if (existingField.length > 0) {
      return {
        success: false,
        error: "Field with this name already exists",
      };
    }

    // Calculate next order index
    const maxOrder = await db.select().from(fields).where(eq(fields.tableId, tableId));
    const orderIndex = maxOrder.length > 0 ? Math.max(...maxOrder.map(f => f.orderIndex || 0)) + 1 : 0;

    // Create field metadata
    const [newField] = await db.insert(fields).values({
      tableId,
      name,
      slug,
      type,
      required,
      orderIndex,
      relatedTableId,
    }).returning();

    // Add field to dynamic table
    await addFieldToTable(table.dbName, newField.id, type, required);

    // Trigger RAG reindexing for tables domain (since table schema changed)
    autoReindexService.debouncedReindex(table.organizationId, 'tables').catch(console.error);

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }
    
    return {
      success: true,
      data: newField,
    };
  } catch (error) {
    console.error("Error creating field:", error);
    return {
      success: false,
      error: "Failed to create field",
    };
  }
}

export async function createFieldAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);
  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const required = formData.get('required') === 'true';
  const relatedTableId = formData.get('relatedTableId') ? parseInt(formData.get('relatedTableId') as string) : undefined;

  const result = await createField({ tableId, name, type, required, relatedTableId });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main createField function
  return result;
}

export async function getFields(tableId: number) {
  try {
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const fieldList = await db.select()
      .from(fields)
      .where(eq(fields.tableId, tableId))
      .orderBy(fields.orderIndex);

    return fieldList;
  } catch (error) {
    console.error("Error fetching fields:", error);
    throw new Error("Failed to fetch fields");
  }
}

export async function deleteField(fieldId: number, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_fields");
    
    if (!fieldId) {
      return {
        success: false,
        error: "Field ID is required",
      };
    }

    // Get field info
    const [field] = await db.select()
      .from(fields)
      .where(eq(fields.id, fieldId))
      .limit(1);

    if (!field) {
      return {
        success: false,
        error: "Field not found",
      };
    }

    // Get table info
    const [table] = await db.select().from(tables).where(eq(tables.id, field.tableId)).limit(1);
    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Remove field from dynamic table first
    await removeFieldFromTable(table.dbName, field.id);
    
    // Then delete metadata
    await db.delete(fields).where(eq(fields.id, fieldId));

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }
    
    return {
      success: true,
      data: { message: "Field deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting field:", error);
    return {
      success: false,
      error: "Failed to delete field",
    };
  }
}

export async function deleteFieldAction(formData: FormData) {
  const fieldId = parseInt(formData.get('fieldId') as string);

  const result = await deleteField(fieldId);
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main deleteField function
  return result;
}