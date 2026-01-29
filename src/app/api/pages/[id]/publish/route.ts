/**
 * Page Publish API - Publish or unpublish a page
 *
 * AIDEV-NOTE: This endpoint controls page visibility for the AppBuilder agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAppApplicationService, getPuckPageApplicationService } from '@/ddd/application/di/getters';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { PuckPageMapper } from '@/app/mappers/puck-page-mapper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/pages/[id]/publish
 *
 * Publish or unpublish a page.
 *
 * Query parameters:
 * - action: 'publish' or 'unpublish' (required)
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    const action = searchParams.get('action');

    if (action !== 'publish' && action !== 'unpublish') {
      return NextResponse.json(
        { error: 'action query parameter must be "publish" or "unpublish"' },
        { status: 400 }
      );
    }

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

    const result = action === 'publish'
      ? await pageService.publishPage(PageId.fromNumber(pageId))
      : await pageService.unpublishPage(PageId.fromNumber(pageId));

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || `Failed to ${action} page` }, { status: 400 });
    }

    const dto = PuckPageMapper.toDTO(result.data);

    return NextResponse.json({
      success: true,
      data: dto,
      message: `Page ${action === 'publish' ? 'published' : 'unpublished'} successfully`,
    });
  } catch (error) {
    console.error('Error publishing/unpublishing page:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
