import { NextRequest, NextResponse } from 'next/server';
import { consumeDeviceSession, isValidDeviceCode } from '@/lib/auth/device-flow';
import { getOrCreateDeviceToken } from '@/lib/auth/token-service';
import { db } from '@/ddd/infrastructure/db/client';
import { sessions } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Polled by the Tauri webview to check if the browser auth completed.
 * 200 + Set-Cookie + apiKey = session ready, 202 = still pending, 400 = bad code.
 *
 * For Tauri desktop apps, also returns an API key for Rust commands to use.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code || !isValidDeviceCode(code)) {
    return NextResponse.json(
      { error: 'invalid_code', message: 'Missing or invalid device code' },
      { status: 400 }
    );
  }

  try {
    const sessionToken = await consumeDeviceSession(code);

    if (!sessionToken) {
      return NextResponse.json(
        { status: 'pending', message: 'Authorization pending' },
        { status: 202 }
      );
    }

    // Look up user ID from session token
    const [session] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    // Generate device token for Tauri to use with Rust commands
    // Device tokens are stable and won't be rotated by agent/skill execution
    let apiKey: string | undefined;
    if (session?.userId) {
      try {
        apiKey = await getOrCreateDeviceToken(session.userId);
      } catch (err) {
        console.error('[Device Flow] Failed to generate device token:', err);
        // Continue without API key - user can still use the session
      }
    }

    const isSecure = process.env.NEXTAUTH_URL?.startsWith('https://') ?? true;

    const response = NextResponse.json(
      {
        status: 'complete',
        message: 'Authentication successful',
        apiKey, // Included for Tauri to store and use with Rust commands
      },
      { status: 200 }
    );

    // Must match the cookie config in src/lib/auth.ts:240-246
    response.cookies.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isSecure,
      maxAge: 30 * 24 * 60 * 60, // 30 days (NextAuth DB session default)
    });

    return response;
  } catch (error) {
    console.error('[Device Flow] Verify error:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
