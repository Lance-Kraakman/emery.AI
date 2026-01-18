/**
 * Row Operations API Endpoint
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm → minimal TOON format
 * - ?format=llm&meta=1 → TOON with metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuthenticatedRoute, parseJsonBody, requireParam, parseIntParam, parseOptionalIntParam } from '@/lib/api/base';
import { createRow, updateRowData, deleteRowData, getRowsDSG } from '@/app/actions/rows';
import { rowsToToon, operationToToon } from '@/lib/toon-format';

/**
 * POST /api/rows - Create a new row
 * ?format=llm → TOON format response
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const response = await withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);
    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const { tableId, data, dataKeyType } = body;
    requireParam(tableId, 'tableId');
    requireParam(data, 'data');

    const result = await createRow({ tableId, data, dataKeyType });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create row', status: 400 };
    }

    return { success: true, data: result.data, message: 'Row created successfully' };
  });

  if (format === "llm") {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'created',
        entity: 'row',
        id: body.data?.id || body.data?._id || 0,
        data: body.data
      });
      return new NextResponse(toon, {
        status: 201,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}

/**
 * GET /api/rows - Get rows with pagination
 * ?format=llm → TOON format | ?format=llm&meta=1 → with metadata
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const includeMeta = searchParams.get("meta") === "1";

  const response = await withAuthenticatedRoute(request, async (user) => {
    const tableIdStr = searchParams.get("tableId");
    if (!tableIdStr) {
      return { success: false, error: 'tableId is required', status: 400 };
    }

    const tableId = parseIntParam(tableIdStr, 'tableId');
    const limit = parseOptionalIntParam(searchParams.get("limit"), 100);
    const offset = parseOptionalIntParam(searchParams.get("offset"), 0);
    const orderBy = searchParams.get("orderBy") || undefined;
    const orderDirection = (searchParams.get("orderDirection") as 'ASC' | 'DESC') || undefined;

    const result = await getRowsDSG(tableId, limit, offset, orderBy, orderDirection);

    return {
      success: true,
      data: { rows: result.rows, hasMore: result.hasMore, total: result.total, limit, offset }
    };
  });

  // Transform to TOON if requested
  if (format === "llm") {
    const body = await response.clone().json();
    if (body.success) {
      return new NextResponse(rowsToToon(body.data.rows, { includeMeta }), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}

/**
 * PUT /api/rows - Update an existing row
 * ?format=llm → TOON format response
 */
export async function PUT(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const response = await withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);
    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const { tableId, rowId, data, dataKeyType } = body;
    requireParam(tableId, 'tableId');
    requireParam(rowId, 'rowId');
    requireParam(data, 'data');

    const result = await updateRowData({ tableId, rowId, data, dataKeyType });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update row', status: 400 };
    }

    return { success: true, data: result.data, message: 'Row updated successfully' };
  });

  if (format === "llm") {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'updated',
        entity: 'row',
        id: body.data?.id || body.data?._id || 0,
        data: body.data
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}

/**
 * DELETE /api/rows - Delete a row
 * ?format=llm → TOON format response
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const response = await withAuthenticatedRoute(request, async (user) => {
    const tableIdStr = searchParams.get("tableId");
    const rowId = searchParams.get("rowId");

    if (!tableIdStr || !rowId) {
      return { success: false, error: 'tableId and rowId are required', status: 400 };
    }

    const tableId = parseIntParam(tableIdStr, 'tableId');
    const result = await deleteRowData(tableId, rowId);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete row', status: 400 };
    }

    return { success: true, data: { id: rowId }, message: 'Row deleted successfully' };
  });

  if (format === "llm") {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'deleted',
        entity: 'row',
        id: body.data?.id || 0
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}
