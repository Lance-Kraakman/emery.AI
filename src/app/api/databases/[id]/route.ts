/**
 * Single Database Operations API Endpoint
 *
 * RESTful endpoints for individual database management:
 * - GET: Retrieve single database by ID
 * - PUT: Update database metadata
 * - DELETE: Delete database
 *
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-read-database etc.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { hasResourcePermission } from '@/lib/auth';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getDatabaseApplicationService } from '@/ddd/application/di/container';
import { DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { DatabaseMapper } from '@/app/mappers/database-mapper';

/**
 * GET /api/databases/[id]
 * Retrieve single database by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const databaseId = parseIntParam(id, 'database id');

    if (!user.organizationId || !await hasResourcePermission(user.id, 'database:view', user.organizationId, 'databases', databaseId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const databaseService = getDatabaseApplicationService();

    const database = await databaseService.getDatabase(DatabaseId.fromNumber(databaseId));

    if (!database) {
      return {
        success: false,
        error: `Database with ID ${databaseId} not found`,
        status: 404
      };
    }

    // Convert domain entity to DTO for API response
    const databaseDTO = DatabaseMapper.toDTO(database);

    return {
      success: true,
      data: databaseDTO
    };
  });
}

/**
 * PUT /api/databases/[id]
 * Update database metadata
 *
 * Request body fields (all optional):
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
    const databaseId = parseIntParam(id, 'database id');

    if (!user.organizationId || !await hasResourcePermission(user.id, 'database:manage', user.organizationId, 'databases', databaseId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const databaseService = getDatabaseApplicationService();

    const result = await databaseService.updateDatabase({
      databaseId,
      name: body.name,
      description: body.description,
      metadata: body.metadata
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update database',
        status: 400
      };
    }

    logAgentMutation(request, user, {
      action: 'update',
      resourceType: 'database',
      resourceId: String(databaseId),
      resourceName: body.name,
    });

    return {
      success: true,
      data: result.data,
      message: 'Database updated successfully'
    };
  });
}

/**
 * DELETE /api/databases/[id]
 * Delete database
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const databaseId = parseIntParam(id, 'database id');

    if (!user.organizationId || !await hasResourcePermission(user.id, 'database:manage', user.organizationId, 'databases', databaseId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const databaseService = getDatabaseApplicationService();

    // Verify database exists before attempting deletion
    const database = await databaseService.getDatabase(DatabaseId.fromNumber(databaseId));

    if (!database) {
      return {
        success: false,
        error: `Database with ID ${databaseId} not found`,
        status: 404
      };
    }

    // Delete database
    const result = await databaseService.deleteDatabase(
      DatabaseId.fromNumber(databaseId),
      OrganizationId.fromNumber(user.organizationId)
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete database',
        status: 400
      };
    }

    logAgentMutation(request, user, {
      action: 'delete',
      resourceType: 'database',
      resourceId: String(databaseId),
      resourceName: database.name,
    });

    return {
      success: true,
      data: { id: databaseId },
      message: 'Database deleted successfully'
    };
  });
}
