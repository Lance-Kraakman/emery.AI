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
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";

/**
 * Convert row data from field names to field IDs
 *
 * AIDEV-NOTE: DSG grid sends data with field names as keys: { name: "value", age: 123 }
 * But Row.fromPlainObject expects numeric field IDs: { 6: "value", 7: 123 }
 * This function performs the conversion using the table's field definitions.
 *
 * @param rowData - Row data with field names as keys
 * @param tableFields - Table field definitions for mapping names to IDs
 * @returns Row data with numeric field IDs as keys
 */
function convertFieldNamesToIds(
  rowData: Record<string, any>,
  tableFields: readonly TableField[]
): Record<string, any> {
  const convertedData: Record<string, any> = {};

  for (const field of tableFields) {
    if (field.name === 'id') continue; // Skip id field - it's handled separately
    const fieldKey = field.id.value.toString();
    if (rowData[field.name] !== undefined) {
      convertedData[fieldKey] = rowData[field.name];
    }
  }

  // Preserve row ID if provided
  if (rowData.id) {
    convertedData.id = rowData.id;
  }

  return convertedData;
}


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

    // Convert field names to field IDs before creating Row entity
    // AIDEV-NOTE: DSG sends { name: "value" }, Row.fromPlainObject expects { 6: "value" }
    const convertedData = convertFieldNamesToIds(rowData || {}, table.fields);
    const row = Row.fromPlainObject(convertedData, tableId, table.fields);

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
    // AIDEV-NOTE: DSG sends { name: "value" }, Row.fromPlainObject expects { 6: "value" }
    const rows = rowsData.map(rowData => {
      const convertedData = convertFieldNamesToIds(rowData, table.fields);
      return Row.fromPlainObject(convertedData, tableId, table.fields);
    });

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
      const existingData = existingRow.toPlainObject(table.fields);
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

/**
 * Bulk update multiple rows with partial data (optimized for batch cell edits)
 * PERFORMANCE: Single query to fetch existing rows + single Delta Lake merge
 */
export async function updateRowsData(
  tableId: number,
  updates: Array<{ rowId: string; data: Record<string, any> }>,
  revalidateUrl?: string
): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");

    if (!tableId || !updates || updates.length === 0) {
      return {
        success: false,
        error: "tableId and updates array are required",
      };
    }

    // Use table application service
    const tableAppService = getTableApplicationService();

    // Get table to retrieve field information
    const table = await tableAppService.getTable(TableId.fromNumber(tableId));

    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }

    // OPTIMIZED: Fetch all existing rows in ONE query using 'in' filter
    const rowIds = updates.map(u => u.rowId);
    const existingRows = await tableAppService.getRows(
      TableId.fromNumber(tableId),
      {
        filters: [{ field: 'id', operator: 'in' as const, value: rowIds }]
      }
    );

    // Create a map for quick lookup
    const existingRowMap = new Map(
      existingRows.map(row => [row.id.value, row.toPlainObject(table.fields)])
    );

    // AIDEV-NOTE: Ensure we have a valid user ID
    if (!session.user?.id || typeof session.user.id !== 'string') {
      return {
        success: false,
        error: "Invalid user session - user ID not found"
      };
    }

    // Merge each update with existing row data
    const mergedUpdates = updates.map(update => {
      const existingData = existingRowMap.get(update.rowId) || {};

      // AIDEV-NOTE: Convert field names to IDs before merging (DSG sends field names)
      // This is critical for complex fields like documents/files to deserialize correctly
      const convertedUpdateData = convertFieldNamesToIds(update.data, table.fields);

      const mergedData = { ...existingData, ...convertedUpdateData, id: update.rowId };
      const row = Row.fromPlainObject(mergedData, tableId, table.fields);

      return {
        rowId: RowId.fromString(update.rowId),
        data: row
      };
    });

    // Bulk update using application service
    const result = await tableAppService.updateRows({
      tableId: TableId.fromNumber(tableId),
      updates: mergedUpdates,
      updatedBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to bulk update rows"
      };
    }

    // Optional revalidation with custom URL
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    }

    // Convert Domain objects to DTOs for serialization
    const rowDTOs = result.data?.map(row => RowMapper.toDTO(row)) || [];

    return {
      success: true,
      data: rowDTOs,
    };
  } catch (error) {
    console.error("Error bulk updating rows:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to bulk update rows",
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
 * Uses efficient Delta Lake metadata to get accurate total count without
 * loading all rows. This enables proper pagination UI with total row display.
 */
export async function getRowsDSG(
  tableId: number,
  limit = 100,
  offset = 0,
  orderBy?: string,
  orderDirection?: 'ASC' | 'DESC',
  filters?: Array<{ field: string, operator: string, value: any }>
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

    // Get actual total count from table metadata (efficient - reads only transaction log)
    const stats = await tableAppService.getTableStats(TableId.fromNumber(tableId));
    const totalRows = stats.rowCount;

    // Request limit + 1 rows to detect if more pages exist
    // Standard pagination pattern to avoid false positives at multiples of page size
    const rowsData = await tableAppService.getRows(
      TableId.fromNumber(tableId),
      {
        limit: limit + 1,
        offset,
        orderBy,
        orderDirection,
        filters: filters as any // RowFilter type from persistence layer
      }
    );

    // Transform all rows to DSG format (including the potential extra row)
    // AIDEV-NOTE: CRITICAL - Convert from numeric field IDs to field names for DSG
    // FieldValue now stores fieldId (e.g., "1", "10"), so we map to field names for DSG
    // DSG expects {id: "123", test: "value", name: "value"} (field names)
    const allDsgData = rowsData.map(row => {
      const dsgRow: Record<string, any> = { id: row.id.value };

      // Map fieldValues: fieldId → field name for DSG format
      for (const fieldValue of row.fieldValues) {
        const field = table.fields.find(f => f.id.value.toString() === fieldValue.fieldId);
        if (field) {
          dsgRow[field.name] = fieldValue.value;
        }
      }

      return dsgRow;
    });

    // If we got more than requested, there are more pages
    const hasMore = allDsgData.length > limit;

    // Return only the requested number of rows (slice off the extra if it exists)
    const dsgData = hasMore ? allDsgData.slice(0, limit) : allDsgData;

    return {
      rows: dsgData,
      hasMore,
      total: totalRows // Now returns actual total from metadata, not just loaded rows
    };
  } catch (error) {
    console.error("Error fetching paginated rows:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch rows");
  }
}

/**
 * Server action to search rows in DSG format
 *
 * Performs server-side search across all text fields in the table,
 * searching all data (not just loaded rows in memory).
 *
 * Returns matching rows with pagination metadata.
 */
export async function searchRowsDSG(
  tableId: number,
  query: string,
  limit = 100
): Promise<{ rows: any[], total: number }> {
  try {
    await requirePermission("data:manage");

    if (!tableId) {
      throw new Error("tableId is required");
    }

    if (!query || query.trim() === '') {
      // Return empty results for empty query
      return { rows: [], total: 0 };
    }

    const tableAppService = getTableApplicationService();

    // Get table to access organizationId
    const table = await tableAppService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      throw new Error("Table not found");
    }

    // Use searchTableRows method which searches all text fields
    const result = await tableAppService.searchTableRows({
      tableId: TableId.fromNumber(tableId),
      query: query.trim(),
      limit,
      organizationId: table.organizationId
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to search rows");
    }

    // Transform rows to DSG format
    // AIDEV-NOTE: CRITICAL - Convert from numeric field IDs to field names for DSG
    const dsgData = result.data.map(row => {
      const dsgRow: Record<string, any> = { id: row.id.value };

      // Map fieldValues: fieldId → field name for DSG format
      for (const fieldValue of row.fieldValues) {
        const field = table.fields.find(f => f.id.value.toString() === fieldValue.fieldId);
        if (field) {
          dsgRow[field.name] = fieldValue.value;
        }
      }

      return dsgRow;
    });

    return {
      rows: dsgData,
      total: dsgData.length // For search results, total is the number of matches
    };
  } catch (error) {
    console.error("Error searching rows:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to search rows");
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
