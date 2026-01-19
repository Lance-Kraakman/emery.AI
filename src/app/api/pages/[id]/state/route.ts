/**
 * Page State API - Update page state configuration
 *
 * AIDEV-NOTE: This endpoint updates the page state (variables, persistence) for the
 * page_builder and app_builder agents to create dynamic pages.
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm -> minimal TOON format
 */

// Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAppApplicationService, getPuckPageApplicationService, getPuckPageRepository } from '@/ddd/application/di/getters';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { PuckPageMapper } from '@/app/mappers/puck-page-mapper';
import { operationToToon } from '@/lib/toon-format';
import type { PageStateConfig } from '@/components/puck/types/state';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/pages/[id]/state
 *
 * Update page state configuration (variables, persistence).
 *
 * Body:
 * - variables: StateVariable[] (optional, array of state variable definitions)
 * - persistence: 'none' | 'session' | 'localStorage' (optional)
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

    // Validate body has at least variables or persistence
    if (!body.variables && !body.persistence) {
      return NextResponse.json(
        { error: 'At least variables or persistence is required' },
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

    // Build the page state config
    const pageState: PageStateConfig = {
      variables: body.variables ?? existingPage.pageState?.variables ?? [],
      persistence: body.persistence ?? existingPage.pageState?.persistence ?? 'none',
    };

    // Update page state using the entity method
    existingPage.setPageState(pageState);

    // Save using repository
    const pageRepository = getPuckPageRepository();
    const updatedPage = await pageRepository.update(existingPage);

    const dto = PuckPageMapper.toDTO(updatedPage);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = operationToToon({
        action: 'updated',
        entity: 'page_state',
        id: dto.id,
        data: {
          name: dto.name,
          variablesCount: pageState.variables.length,
          persistence: pageState.persistence,
        },
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: dto,
      message: 'Page state updated successfully',
    });
  } catch (error) {
    console.error('Error updating page state:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
