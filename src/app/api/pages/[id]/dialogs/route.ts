/**
 * Page Dialogs API - Add dialogs to a page
 *
 * AIDEV-NOTE: This endpoint adds dialogs to a page for the page_builder and
 * app_builder agents to create interactive apps with modal content.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAppApplicationService, getPuckPageApplicationService, getPuckPageRepository } from '@/ddd/application/di/getters';
import { PageId } from '@/ddd/domain/puck/value-objects/page-id';
import { PuckPageMapper } from '@/app/mappers/puck-page-mapper';
import type { PageDialog, PageDialogsConfig } from '@/ddd/domain/puck/value-objects/page-dialogs';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/pages/[id]/dialogs
 *
 * Add a dialog to the page.
 *
 * Body:
 * - name: string (required, display name)
 * - stateKey: string (required, boolean state variable controlling open/close)
 * - title: string (optional, dialog title)
 * - description: string (optional)
 * - size: 'sm' | 'md' | 'lg' | 'xl' | 'full' (optional, default 'md')
 * - closeOnOutsideClick: boolean (optional, default true)
 * - closeOnEscape: boolean (optional, default true)
 * - content: PuckData (optional, dialog body content)
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

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!body.stateKey || typeof body.stateKey !== 'string') {
      return NextResponse.json({ error: 'stateKey is required (boolean state variable name)' }, { status: 400 });
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

    // Build the new dialog
    const newDialog: PageDialog = {
      id: uuidv4(),
      name: body.name,
      stateKey: body.stateKey,
      title: body.title || '',
      description: body.description || '',
      size: body.size || 'md',
      closeOnOutsideClick: body.closeOnOutsideClick ?? true,
      closeOnEscape: body.closeOnEscape ?? true,
      content: body.content || {
        root: { props: {} },
        content: [],
        zones: {},
      },
    };

    // Get existing dialogs and append new one
    const existingDialogs = existingPage.pageDialogs?.dialogs ?? [];
    const pageDialogs: PageDialogsConfig = {
      dialogs: [...existingDialogs, newDialog],
    };

    // Update page dialogs using the entity method
    existingPage.setPageDialogs(pageDialogs);

    // Save using repository
    const pageRepository = getPuckPageRepository();
    const updatedPage = await pageRepository.update(existingPage);

    const dto = PuckPageMapper.toDTO(updatedPage);

    return NextResponse.json({
      success: true,
      data: dto,
      dialog: newDialog,
      message: 'Dialog added successfully',
    });
  } catch (error) {
    console.error('Error adding dialog:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
