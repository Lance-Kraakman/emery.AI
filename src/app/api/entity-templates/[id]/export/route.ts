/**
 * Template Export API endpoint
 *
 * - GET /api/entity-templates/[id]/export - Export template as .brain file
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { TemplateApplicationService } from '@/ddd/application/services/templates/template-application-service';
import { DrizzleTemplateRepository } from '@/ddd/infrastructure/db/repositories/templates/drizzle-template-repository';
import { db } from '@/ddd/infrastructure/db/client';

function getTemplateService() {
  const repository = new DrizzleTemplateRepository(db);
  return new TemplateApplicationService(repository);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/entity-templates/[id]/export - Export template as .brain JSON
 *
 * Returns the template in BrainTemplate format suitable for download
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  const resolvedParams = await params;
  const templateId = parseInt(resolvedParams.id, 10);
  if (isNaN(templateId)) {
    return Response.json({ success: false, error: 'Invalid template ID' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const download = searchParams.get('download') === '1';

  const response = await withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const service = getTemplateService();

    // Verify access
    const existing = await service.getTemplate(templateId);
    if (!existing.success || existing.data!.organizationId.value !== user.organizationId) {
      return { success: false, error: 'Template not found', status: 404 };
    }

    const result = await service.exportTemplate(templateId);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to export template', status: 400 };
    }

    return { success: true, data: result.data };
  });

  // If download requested, set appropriate headers
  if (download && response.ok) {
    const body = await response.json();
    if (body.success && body.data) {
      const filename = `${body.data.metadata.name.toLowerCase().replace(/\s+/g, '-')}.brain.json`;
      return new NextResponse(JSON.stringify(body.data, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }
  }

  return response;
}
