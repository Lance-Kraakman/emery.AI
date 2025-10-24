'use server'

// AIDEV-NOTE: Server Actions for row data management using DynamicTableService
// Uses domain service for business logic and validation

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { Result, CreateRowCommand, UpdateRowCommand } from "./types";
import { Row, RowId } from "@/ddd/domain/tables/value-objects/row";
import { TableId, UserId } from "@/ddd/domain/shared/value-objects";
import { RowMapper, type RowDTO } from "@/app/mappers/row-mapper";


export async function createRow(data: CreateRowCommand, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");
    const { tableId, data: rowData } = data;
    

    if (!tableId) {
      return {
        success: false,
        error: "tableId is required",
      };
    }

    // Use table application service for row creation
    const tableAppService = getTableApplicationService();
    
    // Get table to retrieve field information
    const table = await tableAppService.getTable(TableId.fromNumber(tableId));
    
    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }

    // Convert plain data to Row entity using table field information
    const row = Row.fromPlainObject(rowData || {}, tableId, table.fields);

    // AIDEV-NOTE: Ensure we have a valid user ID
    if (!session.user?.id || typeof session.user.id !== 'string') {
      return {
        success: false,
        error: "Invalid user session - user ID not found"
      };
    }
    
    const result = await tableAppService.createRow({
      tableId: TableId.fromNumber(tableId),
      data: row,
      createdBy: UserId.fromString(session.user.id)
    });

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
    
    // Convert Domain object to DTO for serialization
    const rowDTO = result.data ? RowMapper.toDTO(result.data) : null;
    
    return {
      success: true,
      data: rowDTO,
    };
  } catch (error) {
    console.error("Error creating row:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create row",
    };
  }
}

/**
 * Create multiple rows in a table (batch operation)
 */
export async function createRows(data: { tableId: number; rows: Record<string, any>[] }, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");
    const { tableId, rows: rowsData } = data;

    if (!tableId) {
      return {
        success: false,
        error: "tableId is required",
      };
    }

    if (!rowsData || rowsData.length === 0) {
      return {
        success: true,
        data: []
      };
    }

    // Use table application service for row creation
    const tableAppService = getTableApplicationService();

    // Get table to retrieve field information
    const table = await tableAppService.getTable(TableId.fromNumber(tableId));

    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }

    // Convert all plain data to Row entities
    const rows = rowsData.map(rowData => Row.fromPlainObject(rowData, tableId, table.fields));

    // AIDEV-NOTE: Ensure we have a valid user ID
    if (!session.user?.id || typeof session.user.id !== 'string') {
      return {
        success: false,
        error: "Invalid user session - user ID not found"
      };
    }

    const result = await tableAppService.createRows({
      tableId: TableId.fromNumber(tableId),
      rows: rows,
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create rows"
      };
    }

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }

    // Convert Domain objects to DTOs for serialization
    const rowDTOs = result.data ? result.data.map(row => RowMapper.toDTO(row)) : [];

    return {
      success: true,
      data: rowDTOs,
    };
  } catch (error) {
    console.error("Error creating rows:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create rows",
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


export async function updateRowData(data: UpdateRowCommand, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");
    const { tableId, rowId, data: rowData } = data;

    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
      };
    }

    // Use table application service for row updates
    const tableAppService = getTableApplicationService();
    
    // Get table to retrieve field information
    const table = await tableAppService.getTable(TableId.fromNumber(tableId));
    
    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }

    // CRITICAL FIX: Fetch existing row data first to preserve all fields
    const existingRow = await tableAppService.getRow(
      TableId.fromNumber(tableId),
      RowId.fromString(rowId)
    );

    let mergedData = { ...rowData, id: rowId };

    if (existingRow) {
      const existingData = existingRow.toPlainObject();
      // MERGE: Start with existing data, then overlay the new changes
      mergedData = { ...existingData, ...rowData, id: rowId };
    }

    // Convert merged data to Row entity using table field information
    const row = Row.fromPlainObject(mergedData, tableId, table.fields);

    // AIDEV-NOTE: Ensure we have a valid user ID
    if (!session.user?.id || typeof session.user.id !== 'string') {
      return {
        success: false,
        error: "Invalid user session - user ID not found"
      };
    }

    const result = await tableAppService.updateRow({
      tableId: TableId.fromNumber(tableId),
      rowId: RowId.fromString(rowId),
      data: row,
      updatedBy: UserId.fromString(session.user.id)
    });

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
    
    // Convert Domain object to DTO for serialization
    const rowDTO = result.data ? RowMapper.toDTO(result.data) : null;
    
    return {
      success: true,
      data: rowDTO,
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
    const session = await requirePermission("data:manage");
    
    if (!tableId || !rowId) {
      return {
        success: false,
        error: "tableId and rowId are required",
      };
    }

    // Use table application service for row deletion
    const tableAppService = getTableApplicationService();
    
    const result = await tableAppService.deleteRow(
      TableId.fromNumber(tableId),
      RowId.fromString(rowId)
    );

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


/**
 * Get rows in DataSheetGrid format with pagination
 * Returns rows with pagination metadata for infinite scroll
 *
 * Uses limit+1 pattern: Request one extra row to detect if more pages exist,
 * then return only the requested limit. This prevents false positives when
 * total rows is exactly a multiple of the page size (e.g., 1000 rows with 100/page).
 */
export async function getRowsDSG(
  tableId: number,
  limit = 100,
  offset = 0
): Promise<{ rows: any[], hasMore: boolean, total: number }> {
  try {
    await requirePermission("data:manage");

    if (!tableId) {
      throw new Error("tableId is required");
    }

    const tableAppService = getTableApplicationService();

    // Get table to access field definitions
    const table = await tableAppService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      throw new Error("Table not found");
    }

    // Request limit + 1 rows to detect if more pages exist
    // Standard pagination pattern to avoid false positives at multiples of page size
    const rowsData = await tableAppService.getRows(
      TableId.fromNumber(tableId),
      { limit: limit + 1, offset }
    );

    // Transform all rows to DSG format (including the potential extra row)
    const allDsgData = rowsData.map(row => {
      const plainData = row.toPlainObject();
      return { id: row.id.value, ...plainData };
    });

    // If we got more than requested, there are more pages
    const hasMore = allDsgData.length > limit;

    // Return only the requested number of rows (slice off the extra if it exists)
    const dsgData = hasMore ? allDsgData.slice(0, limit) : allDsgData;

    return {
      rows: dsgData,
      hasMore,
      total: dsgData.length
    };
  } catch (error) {
    console.error("Error fetching paginated rows:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch rows");
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
