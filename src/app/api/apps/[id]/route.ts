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
import { authenticateRequest } from '@/lib/auth/test-auth';
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
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const includeMeta = searchParams.get('meta') === '1';

    const appService = getAppApplicationService();
    const app = await appService.getApp(AppId.fromNumber(appId));

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    // Verify organization access
    if (app.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const dto = AppMapper.toDTO(app);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = appToToon(dto, { includeMeta });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: dto,
    });
  } catch (error) {
    console.error('Error getting app:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
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
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const body = await request.json();

    const appService = getAppApplicationService();

    // First verify app exists and belongs to user's organization
    const existingApp = await appService.getApp(AppId.fromNumber(appId));
    if (!existingApp) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }
    if (existingApp.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const result = await appService.updateApp({
      id: AppId.fromNumber(appId),
      name: body.name,
      slug: body.slug,
      description: body.description,
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Failed to update app' }, { status: 400 });
    }

    // Handle theme config update separately if provided
    if (body.themeConfig !== undefined) {
      result.data.updateTheme(body.themeConfig);
    }

    const dto = AppMapper.toDTO(result.data);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = operationToToon({
        action: 'updated',
        entity: 'app',
        id: dto.id,
        data: { name: dto.name, slug: dto.slug },
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: dto,
    });
  } catch (error) {
    console.error('Error updating app:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/apps/[id]
 *
 * Delete an app. All pages will be cascade deleted.
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const appService = getAppApplicationService();

    // First verify app exists and belongs to user's organization
    const existingApp = await appService.getApp(AppId.fromNumber(appId));
    if (!existingApp) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }
    if (existingApp.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const result = await appService.deleteApp(AppId.fromNumber(appId));

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete app' }, { status: 400 });
    }

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = operationToToon({
        action: 'deleted',
        entity: 'app',
        id: appId,
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'App deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting app:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
