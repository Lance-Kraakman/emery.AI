/**
 * Integration Connections API - Get user's OAuth connections
 *
 * GET /api/integrations/connections
 * Returns the user's active OAuth connections
 */

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getUserOAuthConnections } from '@/app/actions/connections';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const result = await getUserOAuthConnections();

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error || 'Failed to get connections',
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: {
        connections: result.data,
      },
    });
  } catch (error) {
    console.error('[API] Error getting user connections:', error);
    return Response.json({
      success: false,
      error: 'Failed to get connections',
    }, { status: 500 });
  }
}
