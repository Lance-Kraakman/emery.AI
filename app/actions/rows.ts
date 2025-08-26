'use server'

// AIDEV-NOTE: Server Actions for row data management using RowApplicationService
// Uses application service for business logic and validation

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { getRowApplicationService } from "@/ddd/application/di/container";
import type { Result, CreateRowData, UpdateRowData } from "./types";
import type { CreateRowCommand, UpdateRowCommand } from "@/ddd/application/services/rows/row-application-service";


export async function createRow(data: CreateRowData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_data");
    const { tableId, data: rowData } = data;

    if (!tableId) {
      return {
        success: false,
        error: "tableId is required",
      };
    }

    // Use RowApplicationService for row creation
    const rowApplicationService = getRowApplicationService();
    
    const command: CreateRowCommand = {
      tableId,
      data: rowData || {},
      createdBy: session.user.id
    };

    const result = await rowApplicationService.createRow(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create row"
      };
    }

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }
    
    return {
      success: true,
      data: result.data,
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

    // Use RowApplicationService for row fetching
    const rowApplicationService = getRowApplicationService();
    
    const rowCollection = await rowApplicationService.getRows(tableId, { limit, offset });
    return [...rowCollection.rows];
  } catch (error) {
    console.error("Error fetching rows:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch rows");
  }
}

export async function updateRowData(data: UpdateRowData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_data");
    const { tableId, rowId, data: rowData } = data;

    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
      };
    }

    // Use RowApplicationService for row updates
    const rowApplicationService = getRowApplicationService();
    
    const command: UpdateRowCommand = {
      tableId,
      rowId,
      data: rowData || {},
      updatedBy: session.user.id
    };

    const result = await rowApplicationService.updateRow(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update row"
      };
    }

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }
    
    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("Error updating row:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update row",
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

export async function deleteRowData(tableId: number, rowId: string, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_data");
    
    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
      };
    }

    // Use RowApplicationService for row deletion
    const rowApplicationService = getRowApplicationService();
    
    const result = await rowApplicationService.deleteRow(tableId, rowId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete row"
      };
    }

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
      error: error instanceof Error ? error.message : "Failed to delete row",
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
