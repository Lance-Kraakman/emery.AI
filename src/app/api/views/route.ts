/**
 * Views API - List and Create data views
 *
 * AIDEV-NOTE: This endpoint provides CRUD access to data views for agents.
 * Views are filtered/sorted views of database tables used by Puck components.
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm -> minimal TOON format
 */

// Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getViewApplicationService } from '@/ddd/application/di/getters';
import { ViewMapper, type ViewDTO } from '@/app/mappers/view-mapper';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { TableId } from '@/ddd/domain/shared/value-objects/table-id';
import { ViewType } from '@/ddd/domain/views/value-objects/view-type';
import { operationToToon } from '@/lib/toon-format';

/**
 * Format views as TOON for LLM consumption
 */
function viewsToToon(views: ViewDTO[]): string {
  if (views.length === 0) {
    return 'views[0]: No views found';
  }

  const header = `views[${views.length}]{id,tableId,name,viewType,requiresAuth}:`;
  const rows = views.map(v =>
    `${v.id},${v.tableId},${v.name},${v.viewType},${v.requiresAuth}`
  ).join('\n');

  return `${header}\n${rows}`;
}

/**
 * GET /api/views - List views for organization
 *
 * Query parameters:
 * - format: 'llm' for TOON format
 * - table_id: Optional filter by table ID
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const tableIdParam = searchParams.get('table_id');

  const response = await withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'User has no current organization', status: 400 };
    }

    const viewService = getViewApplicationService();
    const orgId = OrganizationId.fromNumber(user.organizationId);

    let views;
    if (tableIdParam) {
      const tableId = TableId.fromNumber(parseInt(tableIdParam, 10));
      const result = await viewService.getViewsByTable(tableId);
      views = result.success && result.data ? result.data : [];
    } else {
      const result = await viewService.getViewsByOrganization(orgId);
      views = result.success && result.data ? result.data : [];
    }

    return { success: true, data: views.map(ViewMapper.toDTO) };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      return new NextResponse(viewsToToon(body.data), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
}

/**
 * POST /api/views - Create a new view
 *
 * Body:
 * - tableId: number (required)
 * - name: string (required)
 * - viewType: 'grid' | 'metric' | 'chart' | 'form' (default: 'grid')
 * - description?: string
 * - filters?: Array<{fieldId, operator, value}>
 * - sorting?: Array<{fieldId, direction, priority}>
 * - fieldMappings?: Array<{sourceFieldId, displayName, visible, order}>
 * - viewConfig?: object (type-specific configuration)
 * - requiresAuth?: boolean (default: true)
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  const response = await withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'User has no current organization', status: 400 };
    }

    const body = await request.json();

    // Validate required fields
    if (!body.tableId || typeof body.tableId !== 'number') {
      return { success: false, error: 'tableId is required and must be a number', status: 400 };
    }
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return { success: false, error: 'name is required', status: 400 };
    }

    const viewService = getViewApplicationService();

    // Parse view type (default to grid)
    const viewTypeStr = body.viewType || 'grid';
    let viewType: ViewType;
    try {
      viewType = ViewType.create(viewTypeStr);
    } catch (e) {
      return {
        success: false,
        error: `Invalid viewType: ${viewTypeStr}. Must be one of: grid, metric, chart, form`,
        status: 400
      };
    }

    const result = await viewService.createView({
      name: body.name.trim(),
      description: body.description,
      tableId: TableId.fromNumber(body.tableId),
      organizationId: OrganizationId.fromNumber(user.organizationId),
      createdBy: UserId.fromString(user.id),
      viewType: viewType,
      filters: body.filters,
      sorting: body.sorting,
      fieldMappings: body.fieldMappings,
      viewConfig: body.viewConfig,
      requiresAuth: body.requiresAuth !== false,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create view', status: 400 };
    }

    return {
      success: true,
      data: ViewMapper.toDTO(result.data),
      message: 'View created successfully'
    };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'created',
        entity: 'view',
        id: body.data.id,
        data: { name: body.data.name, tableId: body.data.tableId, viewType: body.data.viewType },
      });
      return new NextResponse(toon, {
        status: 201,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
}
