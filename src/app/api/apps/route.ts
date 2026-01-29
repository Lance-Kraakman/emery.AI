/**
 * Apps API - List and Create apps
 *
 * AIDEV-NOTE: This endpoint provides CRUD access to apps for the AppBuilder agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAppApplicationService } from '@/ddd/application/di/getters';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { AppMapper } from '@/app/mappers/puck-app-mapper';

/**
 * GET /api/apps
 *
 * List all apps for the organization.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    if (!authResult.user.organizationId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 });
    }

    const appService = getAppApplicationService();
    const apps = await appService.getAppsByOrganization(
      OrganizationId.fromNumber(authResult.user.organizationId)
    );

    const dtos = AppMapper.toDTOs(apps);

    return NextResponse.json({
      success: true,
      data: dtos,
    });
  } catch (error) {
    console.error('Error listing apps:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/apps
 *
 * Create a new app.
 *
 * Body:
 * - name: string (required)
 * - slug?: string (optional, auto-generated from name if not provided)
 * - description?: string (optional)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    if (!authResult.user.organizationId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const appService = getAppApplicationService();
    const organizationId = OrganizationId.fromNumber(authResult.user.organizationId);

    // Generate slug from name if not provided
    let slug = body.slug;
    if (!slug) {
      const slugResult = await appService.generateSlugFromName(organizationId, body.name);
      if (!slugResult.success || !slugResult.data) {
        return NextResponse.json({ error: slugResult.error || 'Failed to generate slug' }, { status: 400 });
      }
      slug = slugResult.data;
    }

    const result = await appService.createApp({
      name: body.name.trim(),
      slug,
      description: body.description,
      organizationId,
      ownerId: UserId.fromString(authResult.user.id),
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'Failed to create app' }, { status: 400 });
    }

    const dto = AppMapper.toDTO(result.data);

    return NextResponse.json({
      success: true,
      data: dto,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating app:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
