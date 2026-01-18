export const dynamic = 'force-dynamic';

/**
 * Database management API endpoint
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm → minimal TOON format
 * - ?format=llm&meta=1 → TOON with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody } from '@/lib/api/base';
import { getDatabaseApplicationService } from '@/ddd/application/di/container';
import { databasesToToon, operationToToon } from '@/lib/toon-format';

/**
 * GET /api/databases - List databases
 * ?format=llm → TOON format | ?format=llm&meta=1 → with metadata
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const includeMeta = searchParams.get('meta') === '1';

  const response = await withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const databaseService = getDatabaseApplicationService();
    const databases = await databaseService.getDatabases({
      organizationId: user.organizationId
    });

    return { success: true, data: databases };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      return new NextResponse(databasesToToon(body.data, { includeMeta }), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}

/**
 * POST /api/databases - Create a new database
 * ?format=llm → TOON format response
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  const response = await withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const body = await parseJsonBody(request);
    if (!body?.name) {
      return { success: false, error: 'Database name is required', status: 400 };
    }

    const databaseService = getDatabaseApplicationService();
    const result = await databaseService.createDatabase({
      name: body.name,
      description: body.description,
      organizationId: user.organizationId,
      ownerId: user.id,
      metadata: body.metadata
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create database', status: 400 };
    }

    return { success: true, data: result.data, message: 'Database created successfully' };
  });

  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      // Extract ID - handle value object (.value) or plain number
      const idVal = body.data?.id;
      const dbId = typeof idVal === 'object' && idVal !== null ? (idVal.value ?? 0) : (idVal ?? 0);
      const toon = operationToToon({
        action: 'created',
        entity: 'database',
        id: dbId,
        data: { name: body.data?.name, slug: body.data?.slug }
      });
      return new NextResponse(toon, {
        status: 201,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}
