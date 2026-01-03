import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  checkDistributedRateLimit,
  getRateLimitForPath,
  getRateLimitIdentifier
} from '@/lib/security/distributed-rate-limiter';

/**
 * Middleware to protect platform routes from app-only users
 * and apply rate limiting to API routes.
 *
 * App-only users can ONLY access /public/* routes
 * Organization users can access everything
 *
 * SECURITY: Rate limiting prevents DoS attacks
 */
export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  const { pathname } = request.nextUrl;

  // Track rate limit info for headers
  let rateLimitHeaders: Record<string, string> | null = null;

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userId = token?.sub || null;

    const identifier = getRateLimitIdentifier(ip, userId, pathname);
    const config = getRateLimitForPath(pathname);
    const result = await checkDistributedRateLimit(identifier, config);

    if (!result.allowed) {
      console.warn('[RateLimit] Request blocked', {
        ip,
        userId,
        pathname,
        retryAfter: result.retryAfter
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfter || 60),
            'X-RateLimit-Limit': String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetAt)
          }
        }
      );
    }

    // Store rate limit headers to apply later
    rateLimitHeaders = {
      'X-RateLimit-Limit': String(config.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetAt)
    };
  }

  // Helper to create response with rate limit headers
  const createResponse = (response: NextResponse): NextResponse => {
    if (rateLimitHeaders) {
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    return response;
  };

  // Allow public routes and auth routes
  if (
    pathname.startsWith('/public/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return createResponse(NextResponse.next());
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
  return createResponse(NextResponse.next());
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
