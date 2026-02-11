/**
 * User API Key Refresh
 *
 * POST /api/user/refresh-api-key
 *
 * Generates a fresh API key for the authenticated user.
 * Used by Tauri desktop app when no API key is stored (e.g., signed in before feature existed).
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ensureFreshUserApiKey } from '@/lib/auth/user-api-keys';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = await ensureFreshUserApiKey(session.user.id);
    return Response.json({ success: true, apiKey });
  } catch (error) {
    console.error('[refresh-api-key] Error:', error);
    return Response.json({ error: 'Failed to generate API key' }, { status: 500 });
  }
}
