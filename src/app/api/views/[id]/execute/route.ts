/**
 * Views Execute API - Run a view query
 *
 * AIDEV-NOTE: This endpoint executes a view query and returns rows.
 * Used by Puck components (DataBlock, TableBlock) and agent tools.
 */

// Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getViewApplicationService } from '@/ddd/application/di/getters';
import { ViewId } from '@/ddd/domain/views/value-objects/view-id';
import { PaginationConfig } from '@/ddd/domain/views/value-objects/pagination-config';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/views/[id]/execute - Execute view query
 *
 * Body (all optional):
 * - pagination?: { pageSize: number, offset: number }
 * - additionalFilters?: Array<{fieldId, operator, value}>
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const viewId = parseInt(id, 10);

  if (isNaN(viewId)) {
    return Response.json({ success: false, error: 'Invalid view ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
    // Parse body (may be empty)
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const viewService = getViewApplicationService();

    // Verify view exists and user has access
    const existingResult = await viewService.getView(ViewId.fromNumber(viewId));
    if (!existingResult.success || !existingResult.data) {
      return { success: false, error: 'View not found', status: 404 };
    }

    // Check access: either user has access to org, or view is public
    const view = existingResult.data;
    const hasOrgAccess = view.organizationId.value === user.organizationId;
    const isPublic = !view.requiresAuth;

    if (!hasOrgAccess && !isPublic) {
      return { success: false, error: 'View not found', status: 404 };
    }

    // Build pagination override if provided
    let overridePagination: PaginationConfig | undefined;
    if (body.pagination && typeof body.pagination === 'object') {
      const pag = body.pagination as { pageSize?: number; offset?: number };
      overridePagination = PaginationConfig.create({
        pageSize: pag.pageSize ?? 50,
        offset: pag.offset ?? 0
      });
    }

    const result = await viewService.executeView({
      dataSourceId: ViewId.fromNumber(viewId),
      overridePagination,
      additionalFilters: body.additionalFilters as any,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to execute view', status: 400 };
    }

    // Get view schema for field info (needed for toPlainObject)
    const schemaResult = await viewService.getViewSchema(ViewId.fromNumber(viewId));
    if (!schemaResult.success || !schemaResult.data) {
      return { success: false, error: 'Failed to get view schema', status: 500 };
    }
    const fields = schemaResult.data;

    const { rows, totalCount, pageSize, offset } = result.data;

    // Convert rows to plain objects using field mapping
    const plainRows = rows.map(row => row.toPlainObject(fields));

    return {
      success: true,
      data: { rows: plainRows, totalCount, pageSize, offset }
    };
  });
}
