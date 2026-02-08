import { auth } from '@/lib/auth';
import { contextManager } from '@/ddd/infrastructure/db/context-manager';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

const DEBUG_AUTH_CONTEXT = process.env.DEBUG_AUTH_CONTEXT === 'true';

/**
 * Wrap server action operations with RLS context.
 *
 * USAGE:
 * - All server actions should wrap their logic with this function
 * - Sets database RLS context based on authenticated user
 * - If context is already set (e.g., by API route), skips re-authentication
 *
 * HOW IT WORKS:
 * - Browser calls: No context exists → authenticates via auth() cookies → sets context
 * - API route calls: Context already set by withAuthenticatedRoute() → skips auth, uses existing
 *
 * Uses asyncLocalStorage.run() via contextManager.withContext() to properly scope
 * context to the operation. run() is used instead of enterWith() because Next.js
 * Server Components create multiple async contexts internally.
 *
 * @example
 * export async function createRow(data) {
 *   return withAuthContext(async () => {
 *     const session = await requirePermission("table:manage");
 *     // ... database operations are now RLS-scoped
 *   });
 * }
 *
 * @param operation - The async operation to execute with RLS context
 * @returns Promise resolving to the operation result
 */
export async function withAuthContext<T>(
  operation: () => Promise<T>
): Promise<T> {
  // If RLS context already set (e.g., by withAuthenticatedRoute in API routes),
  // skip re-authentication and run in existing context.
  // This allows server actions to be called from:
  // - Browser (no context → authenticate via auth())
  // - API routes (context set → use existing)
  if (contextManager.hasContext()) {
    if (DEBUG_AUTH_CONTEXT) {
      const ctx = contextManager.getContext();
      console.log("🔧 withAuthContext() - Context already set, skipping auth:", {
        organizationId: ctx?.organizationId?.value,
        userId: ctx?.userId?.value,
      });
    }
    return operation();
  }

  const session = await auth();

  if (DEBUG_AUTH_CONTEXT) {
    console.log("🔧 withAuthContext() - Setting RLS context:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      currentOrgId: session?.user?.currentOrganizationId,
    });
  }

  if (!session?.user?.id || !session?.user?.currentOrganizationId) {
    throw new Error('Cannot execute operation: RLS context required but user/org missing from session');
  }

  // Use withContext (asyncLocalStorage.run) for proper async context scoping
  // This ensures context propagates correctly in Next.js Server Components
  return contextManager.withContext(
    OrganizationId.fromNumber(session.user.currentOrganizationId),
    operation,
    UserId.fromString(session.user.id)
  );
}
