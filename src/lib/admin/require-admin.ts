import { auth } from '@/lib/auth';
import { Session } from 'next-auth';
import { NextResponse } from 'next/server';

/**
 * Validates the current session is a platform admin (ADMIN_EMAILS env var).
 * Returns the NextAuth Session if valid, or a 403 NextResponse if not.
 */
export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await auth();

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 403 }
    );
  }

  return session;
}

function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',')
    .map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Type guard: returns true if the result is a NextResponse (error).
 */
export function isErrorResponse(result: Session | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
