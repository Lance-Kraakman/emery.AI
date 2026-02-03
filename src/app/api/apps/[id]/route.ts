/**
 * App API - Get, Update, Delete a single app
 *
 * AIDEV-NOTE: This endpoint provides CRUD access to a single app for the AppBuilder agent.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getAppApplicationService } from '@/ddd/application/di/getters';
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { AppMapper } from '@/app/mappers/puck-app-mapper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id]
 *
 * Get a single app by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const appId = parseInt(id, 10);

  if (isNaN(appId)) {
    return Response.json({ success: false, error: 'Invalid app ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
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
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const appId = parseInt(id, 10);

  if (isNaN(appId)) {
    return Response.json({ success: false, error: 'Invalid app ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
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

    logAgentMutation(request, user, {
      action: 'update',
      resourceType: 'app',
      resourceId: String(appId),
      resourceName: body.name,
    });

    return { success: true, data: AppMapper.toDTO(result.data) };
  });
}

/**
 * DELETE /api/apps/[id]
 *
 * Delete an app. All pages will be cascade deleted.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const { id } = await params;
  const appId = parseInt(id, 10);

  if (isNaN(appId)) {
    return Response.json({ success: false, error: 'Invalid app ID' }, { status: 400 });
  }

  return withAuthenticatedRoute(request, async (user) => {
    const appService = getAppApplicationService();

    // Verify app exists and belongs to user's organization
    const existingApp = await appService.getApp(AppId.fromNumber(appId));
    if (!existingApp) {
      return { success: false, error: 'App not found', status: 404 };
    }
    if (existingApp.organizationId.value !== user.organizationId) {
      return { success: false, error: 'App not found', status: 404 };
    }

    const appName = existingApp.name;

    const result = await appService.deleteApp(AppId.fromNumber(appId));

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete app', status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'delete',
      resourceType: 'app',
      resourceId: String(appId),
      resourceName: appName,
    });

    return { success: true, data: { id: appId, name: appName }, message: 'App deleted successfully' };
  });
}
