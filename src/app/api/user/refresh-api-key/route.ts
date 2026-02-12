/**
 * User API Key Refresh
 *
 * POST /api/user/refresh-api-key
 *
 * Returns a device token for the authenticated user.
 * Used by Tauri desktop app for workspace sync.
 * Device tokens are stable and don't get rotated by agent execution.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getOrCreateDeviceToken } from '@/lib/auth/token-service';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = await getOrCreateDeviceToken(session.user.id);
    return Response.json({ success: true, apiKey });
  } catch (error) {
    console.error('[refresh-api-key] Error:', error);
    return Response.json({ error: 'Failed to generate device token' }, { status: 500 });
  }
}
