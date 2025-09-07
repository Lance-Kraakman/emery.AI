import { auth } from '@/lib/auth';
import { contextManager } from '@/lib/db/context-manager';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

/**
 * Helper function to automatically set RLS context for server actions
 * 
 * AIDEV-NOTE: This wraps server action operations with automatic RLS context setting
 * based on the authenticated user's session. Context is set in-memory for the
 * contextAwareDb proxy to pick up and apply at the database level.
 * 
 * @param operation - The async operation to execute with RLS context
 * @returns Promise resolving to the operation result
 */
export async function withAuthContext<T>(
  operation: () => Promise<T>
): Promise<T> {
  const session = await auth();
  
  if (session?.user?.id && session?.user?.currentOrganizationId) {
    contextManager.setContext(
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      UserId.fromString(session.user.id)
    );
  }
  
  try {
    return await operation();
  } finally {
    // Clear context after operation to prevent leakage
    contextManager.clearContext();
  }
}

