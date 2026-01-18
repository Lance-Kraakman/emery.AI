/**
 * Views API - Get, Update, Delete a single view
 *
 * AIDEV-NOTE: This endpoint provides read/update/delete for data views.
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm -> minimal TOON format
 */

// Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getViewApplicationService } from '@/ddd/application/di/getters';
import { ViewMapper } from '@/app/mappers/view-mapper';
import { ViewId } from '@/ddd/domain/views/value-objects/view-id';
import { operationToToon } from '@/lib/toon-format';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Format a single view as TOON for LLM consumption
 */
function viewToToon(view: ReturnType<typeof ViewMapper.toDTO>): string {
  const lines = [
    `view:${view.id}`,
    `name: ${view.name}`,
    `tableId: ${view.tableId}`,
    `viewType: ${view.viewType}`,
    `requiresAuth: ${view.requiresAuth}`,
  ];

  if (view.description) {
    lines.push(`description: ${view.description}`);
  }

  if (view.filters.length > 0) {
    lines.push(`filters: ${JSON.stringify(view.filters)}`);
  }

  if (view.sorting.length > 0) {
    lines.push(`sorting: ${JSON.stringify(view.sorting)}`);
  }

  if (view.fieldMappings && view.fieldMappings.length > 0) {
    lines.push(`fieldMappings: ${JSON.stringify(view.fieldMappings)}`);
  }

  return lines.join('\n');
}

/**
 * GET /api/views/[id] - Get view by ID
 *
 * Query parameters:
 * - format: 'llm' for TOON format
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  const response = await withAuthenticatedRoute(request, async (user) => {
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

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      return new NextResponse(viewToToon(body.data), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
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
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  const response = await withAuthenticatedRoute(request, async (user) => {
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

    return {
      success: true,
      data: ViewMapper.toDTO(result.data),
      message: 'View updated successfully'
    };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'updated',
        entity: 'view',
        id: body.data.id,
        data: { name: body.data.name },
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
}

/**
 * DELETE /api/views/[id] - Delete a view
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  // Store view name for TOON response (need it before deletion)
  let viewName = '';

  const response = await withAuthenticatedRoute(request, async (user) => {
    const viewService = getViewApplicationService();

    // Verify view exists and user has access
    const existingResult = await viewService.getView(ViewId.fromNumber(viewId));
    if (!existingResult.success || !existingResult.data) {
      return { success: false, error: 'View not found', status: 404 };
    }
    if (existingResult.data.organizationId.value !== user.organizationId) {
      return { success: false, error: 'View not found', status: 404 };
    }

    viewName = existingResult.data.name;

    const result = await viewService.deleteView(ViewId.fromNumber(viewId));

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete view', status: 400 };
    }

    return { success: true, data: { id: viewId, name: viewName }, message: 'View deleted successfully' };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'deleted',
        entity: 'view',
        id: viewId,
        data: { name: viewName },
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
}
