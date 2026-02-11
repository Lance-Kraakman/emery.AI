/**
 * Row Operations API Endpoint
 */

import { NextRequest } from "next/server";
import { withAuthenticatedRoute, parseJsonBody, requireParam, parseIntParam, parseOptionalIntParam } from '@/lib/api/base';
import { createRow, updateRowData, deleteRowData, deleteRowsData, getRowsDSG } from '@/app/actions/rows';
import { extractActorOverride } from '@/lib/api/agent-context';

/**
 * POST /api/rows - Create a new row
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);
    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const { tableId, data, dataKeyType } = body;
    requireParam(tableId, 'tableId');
    requireParam(data, 'data');

    const actorOverride = extractActorOverride(request, user);
    const result = await createRow({ tableId, data, dataKeyType }, undefined, actorOverride);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create row', status: 400 };
    }

    return { success: true, data: result.data, message: 'Row created successfully' };
  });
}

/**
 * GET /api/rows - Get rows with pagination
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  return withAuthenticatedRoute(request, async (user) => {
    const tableIdStr = searchParams.get("tableId");
    if (!tableIdStr) {
      return { success: false, error: 'tableId is required', status: 400 };
    }

    const tableId = parseIntParam(tableIdStr, 'tableId');
    const limit = parseOptionalIntParam(searchParams.get("limit"), 100);
    const offset = parseOptionalIntParam(searchParams.get("offset"), 0);
    const orderBy = searchParams.get("orderBy") || undefined;
    const orderDirection = (searchParams.get("orderDirection") as 'ASC' | 'DESC') || undefined;
    const filtersParam = searchParams.get("filters");
    const filters = filtersParam ? JSON.parse(filtersParam) : undefined;

    const result = await getRowsDSG(tableId, limit, offset, orderBy, orderDirection, filters);

    return {
      success: true,
      data: { rows: result.rows, hasMore: result.hasMore, total: result.total, limit, offset }
    };
  });
}

/**
 * PUT /api/rows - Update an existing row
 */
export async function PUT(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);
    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const { tableId, rowId, data, dataKeyType } = body;
    requireParam(tableId, 'tableId');
    requireParam(rowId, 'rowId');
    requireParam(data, 'data');

    const actorOverride = extractActorOverride(request, user);
    const result = await updateRowData({ tableId, rowId, data, dataKeyType }, undefined, actorOverride);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update row', status: 400 };
    }

    return { success: true, data: result.data, message: 'Row updated successfully' };
  });
}

/**
 * DELETE /api/rows - Delete row(s)
 * Supports:
 *   - Single row: ?tableId=X&rowId=Y (query params)
 *   - Batch: { tableId: X, rowIds: ["a", "b", "c"] } (request body)
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  return withAuthenticatedRoute(request, async (user) => {
    const tableIdStr = searchParams.get("tableId");
    const rowId = searchParams.get("rowId");
    const actorOverride = extractActorOverride(request, user);

    // Check for batch delete via request body
    const body = await parseJsonBody(request).catch(() => null);

    if (body?.rowIds && Array.isArray(body.rowIds)) {
      // Batch delete mode
      const tableId = parseIntParam(body.tableId?.toString() || tableIdStr || '', 'tableId');

      if (!tableId || body.rowIds.length === 0) {
        return { success: false, error: 'tableId and rowIds are required', status: 400 };
      }

      const result = await deleteRowsData(tableId, body.rowIds, undefined, actorOverride);

      if (!result.success) {
        return { success: false, error: result.error || 'Failed to delete rows', status: 400 };
      }

      return {
        success: true,
        data: { deletedIds: body.rowIds, count: body.rowIds.length },
        message: `${body.rowIds.length} row(s) deleted successfully`
      };
    }

    // Single row delete mode (backward compatible)
    if (!tableIdStr || !rowId) {
      return { success: false, error: 'tableId and rowId are required', status: 400 };
    }

    const tableId = parseIntParam(tableIdStr, 'tableId');
    const result = await deleteRowData(tableId, rowId, undefined, actorOverride);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete row', status: 400 };
    }

    return { success: true, data: { deletedIds: [rowId], count: 1 }, message: 'Row deleted successfully' };
  });
}
