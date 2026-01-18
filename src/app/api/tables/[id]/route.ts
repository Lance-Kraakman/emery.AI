// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Single Table Operations API Endpoint
 *
 * RESTful endpoints for individual table management:
 * - GET: Retrieve single table with fields
 * - PUT: Update table metadata (name, description, metadata)
 * - DELETE: Delete table and all associated data
 *
 * Uses standardized base utilities for consistent auth and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { getTableApplicationService } from '@/ddd/application/di/container';
import { TableId } from '@/ddd/domain/shared/value-objects';
import type { UpdateTableCommand } from '@/ddd/application/services/tables/table-application-service';
import { operationToToon } from '@/lib/toon-format';

/**
 * GET /api/tables/[id]
 * Retrieve single table with fields and metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const tableId = parseIntParam(id, 'table id');
    const tableService = getTableApplicationService();

    const table = await tableService.getTable(TableId.fromNumber(tableId));

    if (!table) {
      return {
        success: false,
        error: `Table with ID ${tableId} not found`,
        status: 404
      };
    }

    return {
      success: true,
      data: table
    };
  });
}

/**
 * PUT /api/tables/[id]
 * Update table metadata (name, description, metadata)
 * ?format=llm → TOON format response
 *
 * Request body:
 * {
 *   name?: string,
 *   description?: string,
 *   metadata?: Record<string, any>
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  const response = await withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const tableId = parseIntParam(id, 'table id');
    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const { name, description, metadata } = body;

    // At least one field must be provided
    if (!name && !description && !metadata) {
      return {
        success: false,
        error: 'At least one field must be provided (name, description, or metadata)',
        status: 400
      };
    }

    const tableService = getTableApplicationService();

    const command: UpdateTableCommand = {
      id: TableId.fromNumber(tableId),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(metadata !== undefined && { metadata })
    };

    const result = await tableService.updateTable(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update table',
        status: 400
      };
    }

    return {
      success: true,
      data: result.data,
      message: 'Table updated successfully'
    };
  });

  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      // Extract ID - handle value object (.value) or plain number
      const idVal = body.data?.id;
      const tblId = typeof idVal === 'object' && idVal !== null ? (idVal.value ?? 0) : (idVal ?? 0);
      const toon = operationToToon({
        action: 'updated',
        entity: 'table',
        id: tblId,
        data: { name: body.data?.name, description: body.data?.description }
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
 * DELETE /api/tables/[id]
 * Delete table and all associated data (fields, rows, S3 data)
 * ?format=llm → TOON format response
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  const response = await withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const tableId = parseIntParam(id, 'table id');
    const tableService = getTableApplicationService();

    // Verify table exists before attempting deletion
    const table = await tableService.getTable(TableId.fromNumber(tableId));

    if (!table) {
      return {
        success: false,
        error: `Table with ID ${tableId} not found`,
        status: 404
      };
    }

    // Delete table and all associated data
    await tableService.deleteTable(TableId.fromNumber(tableId));

    return {
      success: true,
      data: { id: tableId },
      message: 'Table deleted successfully'
    };
  });

  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      // Extract ID - handle value object (.value) or plain number
      const idVal = body.data?.id;
      const tblId = typeof idVal === 'object' && idVal !== null ? (idVal.value ?? 0) : (idVal ?? 0);
      const toon = operationToToon({
        action: 'deleted',
        entity: 'table',
        id: tblId
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}
