/**
 * App API - Get, Update, Delete a single app
 *
 * AIDEV-NOTE: This endpoint provides CRUD access to a single app for the AppBuilder agent.
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm → minimal TOON format
 * - ?format=llm&meta=1 → TOON with metadata
 */

// Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getAppApplicationService } from '@/ddd/application/di/getters';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { AppMapper } from '@/app/mappers/puck-app-mapper';
import { appToToon, operationToToon } from '@/lib/toon-format';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id]
 *
 * Get a single app by ID.
 *
 * Query parameters:
 * - format: 'llm' for TOON format
 * - meta: '1' to include metadata in TOON format
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const appId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const includeMeta = searchParams.get('meta') === '1';

  if (isNaN(appId)) {
    return Response.json({ success: false, error: 'Invalid app ID' }, { status: 400 });
  }

  const response = await withAuthenticatedRoute(request, async (user) => {
    const appService = getAppApplicationService();
    const app = await appService.getApp(AppId.fromNumber(appId));

    if (!app) {
      return { success: false, error: 'App not found', status: 404 };
    }

    // Verify organization access
    if (app.organizationId.value !== user.organizationId) {
      return { success: false, error: 'App not found', status: 404 };
    }

    return { success: true, data: AppMapper.toDTO(app) };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      const toon = appToToon(body.data, { includeMeta });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
}

/**
 * PUT /api/apps/[id]
 *
 * Update an app.
 *
 * Body:
 * - name?: string
 * - slug?: string
 * - description?: string
 * - themeConfig?: object
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const appId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (isNaN(appId)) {
    return Response.json({ success: false, error: 'Invalid app ID' }, { status: 400 });
  }

  const response = await withAuthenticatedRoute(request, async (user) => {
    const body = await request.json();
    const appService = getAppApplicationService();

    // Verify app exists and belongs to user's organization
    const existingApp = await appService.getApp(AppId.fromNumber(appId));
    if (!existingApp) {
      return { success: false, error: 'App not found', status: 404 };
    }
    if (existingApp.organizationId.value !== user.organizationId) {
      return { success: false, error: 'App not found', status: 404 };
    }

    const result = await appService.updateApp({
      id: AppId.fromNumber(appId),
      name: body.name,
      slug: body.slug,
      description: body.description,
      themeConfig: body.themeConfig,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update app', status: 400 };
    }

    return { success: true, data: AppMapper.toDTO(result.data) };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'updated',
        entity: 'app',
        id: body.data.id,
        data: { name: body.data.name, slug: body.data.slug },
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
 * DELETE /api/apps/[id]
 *
 * Delete an app. All pages will be cascade deleted.
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const appId = parseInt(id, 10);
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (isNaN(appId)) {
    return Response.json({ success: false, error: 'Invalid app ID' }, { status: 400 });
  }

  // Store app name for TOON response (need it before deletion)
  let appName = '';

  const response = await withAuthenticatedRoute(request, async (user) => {
    const appService = getAppApplicationService();

    // Verify app exists and belongs to user's organization
    const existingApp = await appService.getApp(AppId.fromNumber(appId));
    if (!existingApp) {
      return { success: false, error: 'App not found', status: 404 };
    }
    if (existingApp.organizationId.value !== user.organizationId) {
      return { success: false, error: 'App not found', status: 404 };
    }

    appName = existingApp.name;

    const result = await appService.deleteApp(AppId.fromNumber(appId));

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete app', status: 400 };
    }

    return { success: true, data: { id: appId, name: appName }, message: 'App deleted successfully' };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      const toon = operationToToon({
        action: 'deleted',
        entity: 'app',
        id: appId,
        data: { name: appName },
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  return response;
}
