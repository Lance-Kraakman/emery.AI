'use server'

// AIDEV-NOTE: Server Actions for row data management using domain repositories
// Migrated from legacy dynamic.ts operations to domain-driven architecture

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { getDynamicTableRepository } from "@/ddd/application/di/container";
import type { ActionResult, CreateRowData, UpdateRowData } from "./types";


export async function createRow(data: CreateRowData, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_data");
    const { tableId, data: rowData } = data;

    if (!tableId) {
      return {
        success: false,
        error: "tableId is required",
      };
    }

    // Use domain repository for row creation
    const dynamicTableRepository = getDynamicTableRepository();
    
    // Verify table exists using domain repository
    const table = await dynamicTableRepository.findById(tableId);
    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Create row using domain repository (handles field mapping and validation)
    const domainRowData: CreateRowData = {
      tableId,
      data: rowData || {},
    };

    const newRow = await dynamicTableRepository.insertRow(tableId, domainRowData);

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }
    
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

  revalidatePath('/mission-control');
  return result;
}

export async function getRowsData(tableId: number, limit = 100, offset = 0): Promise<any[]> {
  try {
    // Add authentication check (using manage_data as it covers view access)
    await requirePermission("manage_data");
    
    if (!tableId) {
      throw new Error("tableId is required");
    }

    // Use domain repository for row fetching
    const dynamicTableRepository = getDynamicTableRepository();
    
    const table = await dynamicTableRepository.findById(tableId);
    if (!table) {
      throw new Error("Table not found");
    }

    const rows = await dynamicTableRepository.findRows(tableId, { limit, offset });
    return rows;
  } catch (error) {
    console.error("Error fetching rows:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch rows");
  }
}

export async function updateRowData(data: UpdateRowData, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_data");
    const { tableId, rowId, data: rowData } = data;

    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
      };
    }

    // Use domain repository for row updates
    const dynamicTableRepository = getDynamicTableRepository();
    
    // Verify table exists
    const table = await dynamicTableRepository.findById(tableId);
    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Update row using domain repository (handles field mapping and validation)
    const domainUpdateData: UpdateRowData = {
      tableId,
      rowId,
      data: rowData || {},
    };

    await dynamicTableRepository.updateRow(tableId, rowId, domainUpdateData);

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }
    
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

  revalidatePath('/mission-control');
  return result;
}

export async function deleteRowData(tableId: number, rowId: string, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_data");
    
    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
      };
    }

    // Use domain repository for row deletion
    const dynamicTableRepository = getDynamicTableRepository();
    
    // Verify table exists
    const table = await dynamicTableRepository.findById(tableId);
    if (!table) {
      return {
        success: false,
        error: "Table not found",
      };
    }

    // Delete row using domain repository
    await dynamicTableRepository.deleteRow(tableId, rowId);

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }
    
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

  revalidatePath('/mission-control');
  return result;
}
