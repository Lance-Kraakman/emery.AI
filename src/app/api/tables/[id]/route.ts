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
import { logAgentMutation } from '@/lib/api/agent-context';
import { getTableApplicationService } from '@/ddd/application/di/container';
import { TableId } from '@/ddd/domain/shared/value-objects';
import type { UpdateTableCommand } from '@/ddd/application/services/tables/table-application-service';
import { TableMapper } from '@/app/mappers/table-mapper';
import { FieldMapper } from '@/app/mappers/field-mapper';

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
      data: {
        ...TableMapper.toDTO(table),
        fields: table.fields.map(FieldMapper.toDTO),
      },
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
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
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

    logAgentMutation(request, user, {
      action: 'update',
      resourceType: 'table',
      resourceId: String(tableId),
      resourceName: name,
    });

    return {
      success: true,
      data: result.data ? TableMapper.toDTO(result.data) : null,
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

    await tableService.deleteTable(TableId.fromNumber(tableId));

    logAgentMutation(request, user, {
      action: 'delete',
      resourceType: 'table',
      resourceId: String(tableId),
      resourceName: table.name,
    });

    return {
      success: true,
      data: { id: tableId },
      message: 'Table deleted successfully'
    };
  });
}
