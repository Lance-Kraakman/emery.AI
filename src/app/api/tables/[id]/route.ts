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

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { getTableApplicationService } from '@/ddd/application/di/container';
import { TableId } from '@/ddd/domain/shared/value-objects';
import type { UpdateTableCommand } from '@/ddd/application/services/tables/table-application-service';

/**
 * GET /api/tables/[id]
 * Retrieve single table with fields and metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const tableId = parseIntParam(params.id, 'table id');
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
  { params }: { params: { id: string } }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const tableId = parseIntParam(params.id, 'table id');
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
}

/**
 * DELETE /api/tables/[id]
 * Delete table and all associated data (fields, rows, S3 data)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const tableId = parseIntParam(params.id, 'table id');
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
}
