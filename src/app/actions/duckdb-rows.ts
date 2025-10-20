'use server'

/**
 * DuckDB Row Actions - Server actions for analytical queries on table data
 *
 * Uses DuckDB repository for efficient pagination and analytics.
 * Designed for big data workloads with true server-side pagination.
 *
 * AIDEV-NOTE: Server actions for DuckDB-powered infinite scroll
 */

import { requirePermission } from "./permissions";
import { getTableApplicationService } from "@/ddd/application/di/container";
import { TableId } from "@/ddd/domain/shared/value-objects";
import type { DSGRow } from "@/app/mappers/dsg-mapper";

/**
 * Get paginated rows using DuckDB for efficient queries
 * Perfect for infinite scroll with true server-side pagination
 */
export async function getRowsDataDSGPaginated(
  tableId: number,
  options: {
    limit?: number
    offset?: number
    orderBy?: string
    orderDirection?: 'ASC' | 'DESC'
  } = {}
): Promise<{
  rows: DSGRow[]
  hasMore: boolean
  totalCount: number
}> {
  try {
    await requirePermission("data:manage");

    if (!tableId) {
      throw new Error("tableId is required");
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Use table application service (will use DuckDB repository if available)
    const tableAppService = getTableApplicationService();

    // Get paginated rows
    const rowsData = await tableAppService.getRows(
      TableId.fromNumber(tableId),
      {
        limit,
        offset,
        orderBy: options.orderBy,
        orderDirection: options.orderDirection
      }
    );

    // Get total count (DuckDB makes this fast)
    const hasRows = await tableAppService.tableHasRows(TableId.fromNumber(tableId));

    // For now, estimate hasMore by checking if we got a full page
    // In future, could add a count query to DuckDB repository
    const hasMore = rowsData.length === limit;

    // Transform to DSG format
    const dsgRows: DSGRow[] = rowsData.map(row => ({
      id: row.id.value,
      ...row.toPlainObject()
    }));

    return {
      rows: dsgRows,
      hasMore,
      totalCount: rowsData.length // Simplified for now
    };

  } catch (error) {
    console.error("Error fetching paginated rows with DuckDB:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to fetch paginated rows");
  }
}

/**
 * Get row count for a table using DuckDB
 * Fast even for large tables
 */
export async function getTableRowCount(tableId: number): Promise<number> {
  try {
    await requirePermission("data:manage");

    if (!tableId) {
      throw new Error("tableId is required");
    }

    const tableAppService = getTableApplicationService();
    const stats = await tableAppService.tableHasRows(TableId.fromNumber(tableId));

    // TODO: Enhance TableApplicationService to expose count from DuckDB
    // For now, return basic existence check
    return stats ? 1 : 0;

  } catch (error) {
    console.error("Error getting row count:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to get row count");
  }
}
