'use server'

// AIDEV-NOTE: Server Actions for row data management - replaces /api/rows route
// AIDEV-QUESTION: Should we add optimistic locking for concurrent row updates?

import { db } from "@/lib/db/client";
import { tables, fields } from "@/lib/db/schema";
import { insertRow, updateRow, deleteRow, getRows } from "@/lib/db/dynamic";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import type { ActionResult, CreateRowData, UpdateRowData } from "./types";

async function processRowData(tableId: number, data: Record<string, any>) {
  const tableFields = await db.select().from(fields).where(eq(fields.tableId, tableId));
  const processedData: Record<string, any> = {};
  
  for (const field of tableFields) {
    const fieldKey = `field_${field.id}`;
    const value = data[field.slug] || data[field.name];
    
    if (field.required && (value === undefined || value === null || value === "")) {
      throw new Error(`Field '${field.name}' is required`);
    }
    
    if (value !== undefined && value !== null) {
      // Handle JSONB fields for relations and files
      if (field.type === 'relation' || field.type === 'file') {
        // If value is a string, try to parse it as JSON
        if (typeof value === 'string') {
          try {
            processedData[fieldKey] = JSON.parse(value);
          } catch {
            processedData[fieldKey] = value;
          }
        } else {
          processedData[fieldKey] = value;
        }
      } else {
        processedData[fieldKey] = value;
      }
    }
  }
  
  return processedData;
}

export async function createRow(data: CreateRowData): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_data");
    const { tableId, data: rowData } = data;

    if (!tableId) {
      return {
        success: false,
        error: "tableId is required",
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

    // Process row data with field mapping and validation
    const processedData = await processRowData(tableId, rowData);

    // Insert row into dynamic table
    const newRow = await insertRow(table.dbName, processedData);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newRow,
    };
  } catch (error) {
    console.error("Error creating row:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create row",
    };
  }
}

export async function createRowAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);
  const rowDataStr = formData.get('data') as string;
  
  let rowData: Record<string, any>;
  try {
    rowData = JSON.parse(rowDataStr);
  } catch {
    throw new Error("Invalid row data format");
  }

  const result = await createRow({ tableId, data: rowData });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getRowsData(tableId: number, limit = 100, offset = 0) {
  try {
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const [table] = await db.select().from(tables).where(eq(tables.id, tableId)).limit(1);
    if (!table) {
      throw new Error("Table not found");
    }

    const rows = await getRows(table.dbName, limit, offset);
    return rows;
  } catch (error) {
    console.error("Error fetching rows:", error);
    throw new Error("Failed to fetch rows");
  }
}

export async function updateRowData(data: UpdateRowData): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_data");
    const { tableId, rowId, data: rowData } = data;

    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
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

    // Process row data with field mapping (no required field validation for updates)
    const tableFields = await db.select().from(fields).where(eq(fields.tableId, tableId));
    const processedData: Record<string, any> = {};
    
    for (const field of tableFields) {
      const fieldKey = `field_${field.id}`;
      const value = rowData[field.slug] || rowData[field.name];
      
      if (value !== undefined && value !== null) {
        // Handle JSONB fields for relations and files
        if (field.type === 'relation' || field.type === 'file') {
          // If value is a string, try to parse it as JSON
          if (typeof value === 'string') {
            try {
              processedData[fieldKey] = JSON.parse(value);
            } catch {
              processedData[fieldKey] = value;
            }
          } else {
            processedData[fieldKey] = value;
          }
        } else {
          processedData[fieldKey] = value;
        }
      }
    }

    // Update row in dynamic table
    await updateRow(table.dbName, rowId, processedData);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Row updated successfully" },
    };
  } catch (error) {
    console.error("Error updating row:", error);
    return {
      success: false,
      error: "Failed to update row",
    };
  }
}

export async function updateRowAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);
  const rowId = formData.get('rowId') as string;
  const rowDataStr = formData.get('data') as string;
  
  let rowData: Record<string, any>;
  try {
    rowData = JSON.parse(rowDataStr);
  } catch {
    throw new Error("Invalid row data format");
  }

  const result = await updateRowData({ tableId, rowId, data: rowData });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function deleteRowData(tableId: number, rowId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_data");
    
    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
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

    // Delete row from dynamic table
    await deleteRow(table.dbName, rowId);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Row deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting row:", error);
    return {
      success: false,
      error: "Failed to delete row",
    };
  }
}

export async function deleteRowAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);
  const rowId = formData.get('rowId') as string;

  const result = await deleteRowData(tableId, rowId);
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}