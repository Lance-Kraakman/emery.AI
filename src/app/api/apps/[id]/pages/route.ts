/**
 * Pages API - List and Create pages for an app
 *
 * AIDEV-NOTE: This endpoint provides CRUD access to pages for the AppBuilder agent.
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
import { AppId } from '@/ddd/domain/puck/value-objects/app-id';
import { UserId } from '@/ddd/domain/shared/value-objects';
import { PuckPageMapper } from '@/app/mappers/puck-page-mapper';
import { pagesToToon, operationToToon } from '@/lib/toon-format';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id]/pages
 *
 * List all pages for an app.
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

    // Verify app exists and belongs to user's organization
    const appService = getAppApplicationService();
    const app = await appService.getApp(AppId.fromNumber(appId));

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }
    if (app.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const pageService = getPuckPageApplicationService();
    const pages = await pageService.getPagesByApp(AppId.fromNumber(appId));

    const dtos = PuckPageMapper.toDTOs(pages);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = pagesToToon(dtos, { includeMeta });
      return new NextResponse(toon, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: dtos,
    });
  } catch (error) {
    console.error('Error listing pages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/apps/[id]/pages
 *
 * Create a new page in an app.
 *
 * Body:
 * - name: string (required)
 * - slug?: string (optional, auto-generated from name if not provided)
 * - description?: string (optional)
 * - templateData?: object (optional, Puck JSON structure)
 *
 * Query parameters:
 * - format: 'llm' for TOON format response
 */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Verify app exists and belongs to user's organization
    const appService = getAppApplicationService();
    const app = await appService.getApp(AppId.fromNumber(appId));

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }
    if (app.organizationId.value !== authResult.user.organizationId) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const pageService = getPuckPageApplicationService();
    const appIdVO = AppId.fromNumber(appId);

    // Generate slug from name if not provided
    let slug = body.slug;
    if (!slug) {
      const slugResult = await pageService.generateSlugFromName(appIdVO, body.name);
      if (!slugResult.success || !slugResult.data) {
        return NextResponse.json({ error: slugResult.error || 'Failed to generate slug' }, { status: 400 });
      }
      slug = slugResult.data;
    }

    const result = await pageService.createPage({
      appId: appIdVO,
      name: body.name.trim(),
      slug,
      description: body.description,
      templateData: body.templateData,
      ownerId: UserId.fromString(authResult.user.id),
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Failed to create page' }, { status: 400 });
    }

    const dto = PuckPageMapper.toDTO(result.data);

    // Return TOON format if requested
    if (format === 'llm') {
      const toon = operationToToon({
        action: 'created',
        entity: 'page',
        id: dto.id,
        data: { name: dto.name, slug: dto.slug, appId: dto.appId },
      });
      return new NextResponse(toon, {
        status: 201,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      success: true,
      data: dto,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating page:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
