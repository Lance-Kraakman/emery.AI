/**
 * Page API - Get, Update, Delete a single page
 *
 * AIDEV-NOTE: This endpoint provides CRUD access to a single page for the AppBuilder agent.
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm → minimal TOON format
 * - ?format=llm&meta=1 → TOON with metadata
 */

// Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAppApplicationService, getPuckPageApplicationService } from '@/ddd/application/di/getters';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { PuckPageMapper } from '@/app/mappers/puck-page-mapper';
import { pageToToon, operationToToon } from '@/lib/toon-format';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/pages/[id]
 *
 * Get a single page by ID.
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
    const pageId = parseInt(id, 10);

    if (isNaN(pageId)) {
      return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const includeMeta = searchParams.get('meta') === '1';

    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPage(PageId.fromNumber(pageId));

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Verify organization access through the app
    const appService = getAppApplicationService();
    const app = await appService.getApp(page.appId);

    if (!app || app.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const dto = PuckPageMapper.toDTO(page);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = pageToToon(dto, { includeMeta });
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
    console.error('Error getting page:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pages/[id]
 *
 * Update page metadata.
 *
 * Body:
 * - name?: string
 * - slug?: string
 * - description?: string
 * - requiresAuth?: boolean
 * - allowedRoles?: string[]
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
    const pageId = parseInt(id, 10);

    if (isNaN(pageId)) {
      return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const body = await request.json();

    const pageService = getPuckPageApplicationService();
    const existingPage = await pageService.getPage(PageId.fromNumber(pageId));

    if (!existingPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Verify organization access through the app
    const appService = getAppApplicationService();
    const app = await appService.getApp(existingPage.appId);

    if (!app || app.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const result = await pageService.updatePage({
      id: PageId.fromNumber(pageId),
      name: body.name,
      slug: body.slug,
      description: body.description,
      requiresAuth: body.requiresAuth,
      allowedRoles: body.allowedRoles,
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Failed to update page' }, { status: 400 });
    }

    const dto = PuckPageMapper.toDTO(result.data);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = operationToToon({
        action: 'updated',
        entity: 'page',
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
    console.error('Error updating page:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pages/[id]
 *
 * Delete a page.
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
    const pageId = parseInt(id, 10);

    if (isNaN(pageId)) {
      return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const pageService = getPuckPageApplicationService();
    const existingPage = await pageService.getPage(PageId.fromNumber(pageId));

    if (!existingPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Verify organization access through the app
    const appService = getAppApplicationService();
    const app = await appService.getApp(existingPage.appId);

    if (!app || app.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const result = await pageService.deletePage(PageId.fromNumber(pageId));

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete page' }, { status: 400 });
    }

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = operationToToon({
        action: 'deleted',
        entity: 'page',
        id: pageId,
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting page:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
