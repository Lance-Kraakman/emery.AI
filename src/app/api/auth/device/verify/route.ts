import { NextRequest, NextResponse } from 'next/server';
import { consumeDeviceSession, isValidDeviceCode } from '@/lib/auth/device-flow';

export const dynamic = 'force-dynamic';

/**
 * Polled by the Tauri webview to check if the browser auth completed.
 * 200 + Set-Cookie = session ready, 202 = still pending, 400 = bad code.
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

    const isSecure = process.env.NEXTAUTH_URL?.startsWith('https://') ?? true;

    const response = NextResponse.json(
      { status: 'complete', message: 'Authentication successful' },
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
