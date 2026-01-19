/**
 * Integration Connection Summary API - Get user's connection statistics
 *
 * GET /api/integrations/connections/summary
 * Returns summary of user's OAuth connections
 */

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getConnectionSummary } from '@/app/actions/connections';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const result = await getConnectionSummary();

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error || 'Failed to get connection summary',
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[API] Error getting connection summary:', error);
    return Response.json({
      success: false,
      error: 'Failed to get connection summary',
    }, { status: 500 });
  }
}
