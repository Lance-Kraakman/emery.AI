/**
 * Page Content API - Update page Puck content
 *
 * AIDEV-NOTE: This endpoint updates the Puck visual editor content for the AppBuilder agent.
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
 * PUT /api/pages/[id]/content
 *
 * Update page template data (Puck content).
 *
 * Body:
 * - templateData: object (required, Puck JSON structure)
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

    const body = await request.json();

    // Validate required fields
    if (!body.templateData || typeof body.templateData !== 'object') {
      return NextResponse.json({ error: 'templateData is required and must be an object' }, { status: 400 });
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

    const result = await pageService.updatePageContent({
      id: PageId.fromNumber(pageId),
      templateData: body.templateData,
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Failed to update page content' }, { status: 400 });
    }

    const dto = PuckPageMapper.toDTO(result.data);

    return NextResponse.json({
      success: true,
      data: dto,
      message: 'Page content updated successfully',
    });
  } catch (error) {
    console.error('Error updating page content:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
