/**
 * Views API - Get, Update, Delete a single view
 *
 * AIDEV-NOTE: This endpoint provides read/update/delete for data views.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getViewApplicationService } from '@/ddd/application/di/getters';
import { ViewMapper } from '@/app/mappers/view-mapper';
import { ViewId } from '@/ddd/domain/views/value-objects/view-id';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/views/[id] - Get view by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
    const viewService = getViewApplicationService();
    const result = await viewService.getView(ViewId.fromNumber(viewId));

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'View not found', status: 404 };
    }

    // Verify organization access
    if (result.data.organizationId.value !== user.organizationId) {
      return { success: false, error: 'View not found', status: 404 };
    }

    return { success: true, data: ViewMapper.toDTO(result.data) };
  });
}

/**
 * PUT /api/views/[id] - Update a view
 *
 * Body:
 * - name?: string
 * - description?: string
 * - filters?: Array<{fieldId, operator, value}>
 * - sorting?: Array<{fieldId, direction, priority}>
 * - fieldMappings?: Array<{sourceFieldId, displayName, visible, order}>
 * - viewConfig?: object
 * - requiresAuth?: boolean
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
    const body = await request.json();
    const viewService = getViewApplicationService();

    // Verify view exists and user has access
    const existingResult = await viewService.getView(ViewId.fromNumber(viewId));
    if (!existingResult.success || !existingResult.data) {
      return { success: false, error: 'View not found', status: 404 };
    }
    if (existingResult.data.organizationId.value !== user.organizationId) {
      return { success: false, error: 'View not found', status: 404 };
    }

    const result = await viewService.updateView({
      id: ViewId.fromNumber(viewId),
      name: body.name,
      description: body.description,
      filters: body.filters,
      sorting: body.sorting,
      pagination: body.pagination,
      fieldMappings: body.fieldMappings,
      viewConfig: body.viewConfig,
      requiresAuth: body.requiresAuth,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update view', status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'update',
      resourceType: 'view',
      resourceId: String(viewId),
      resourceName: body.name,
    });

    return {
      success: true,
      data: ViewMapper.toDTO(result.data),
      message: 'View updated successfully'
    };
  });
}

/**
 * DELETE /api/views/[id] - Delete a view
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
    const viewService = getViewApplicationService();

    const existingResult = await viewService.getView(ViewId.fromNumber(viewId));
    if (!existingResult.success || !existingResult.data) {
      return { success: false, error: 'View not found', status: 404 };
    }
    if (existingResult.data.organizationId.value !== user.organizationId) {
      return { success: false, error: 'View not found', status: 404 };
    }

    const viewName = existingResult.data.name;
    const result = await viewService.deleteView(ViewId.fromNumber(viewId));

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete view', status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'delete',
      resourceType: 'view',
      resourceId: String(viewId),
      resourceName: viewName,
    });

    return { success: true, data: { id: viewId, name: viewName }, message: 'View deleted successfully' };
  });
}
