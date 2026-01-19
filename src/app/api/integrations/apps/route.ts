/**
 * Integration Apps API - List available OAuth-enabled apps
 *
 * GET /api/integrations/apps
 * Query params:
 * - category: Filter by category (communication, productivity, etc.)
 * - search: Search by name or description
 * - limit: Maximum results (default 50)
 * - offset: Pagination offset (default 0)
 */

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAvailableAppsPaginated } from '@/app/actions/connections';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Build search filter that includes category if specified
    let searchFilter = search || undefined;
    if (category && !search) {
      // Use category as search if no explicit search
      searchFilter = category;
    }

    const result = await getAvailableAppsPaginated({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      search: searchFilter,
    });

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error || 'Failed to get available apps',
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[API] Error getting available apps:', error);
    return Response.json({
      success: false,
      error: 'Failed to get available apps',
    }, { status: 500 });
  }
}
