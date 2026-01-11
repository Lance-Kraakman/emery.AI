import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware to protect platform routes from app-only users.
 *
 * App-only users can ONLY access /public/* routes
 * Organization users can access everything
 *
 * Note: Rate limiting is handled by AWS WAF at the CloudFront edge.
 */
export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  const { pathname } = request.nextUrl;

  // Allow public routes and auth routes
  if (
    pathname.startsWith('/public/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check if user is app-only user
  if (token?.isAppOnlyUser) {
    console.log('[Middleware] Blocking app-only user from platform route:', pathname);

    // Redirect to last accessed app or sign out
    const lastAppAccess = token.lastAppAccess as string | undefined;
    const url = request.nextUrl.clone();

    if (lastAppAccess) {
      url.pathname = `/public/${lastAppAccess}`;
      return NextResponse.redirect(url);
    }

    // No app access found, redirect to sign out
    url.pathname = '/api/auth/signout';
    return NextResponse.redirect(url);
  }

  // Allow organization users to access everything
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api routes (except /api/auth which is matched)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
