import { auth } from '@/src/lib/auth';
import { contextManager } from '@/src/lib/db/context-manager';
import { OrganizationId, UserId } from '@/src/ddd/domain/shared/value-objects';

const DEBUG_AUTH_CONTEXT = process.env.DEBUG_AUTH_CONTEXT === 'true' || process.env.NODE_ENV === 'development';

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
  
  if (DEBUG_AUTH_CONTEXT) {
    console.log("🔧 withAuthContext() - Setting RLS context:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      currentOrgId: session?.user?.currentOrganizationId,
      willSetContext: !!(session?.user?.id && session?.user?.currentOrganizationId)
    });
  }
  
  if (session?.user?.id && session?.user?.currentOrganizationId) {
    contextManager.setContext(
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      UserId.fromString(session.user.id)
    );
    if (DEBUG_AUTH_CONTEXT) {
      console.log("✅ withAuthContext() - RLS context set for org:", session.user.currentOrganizationId);
    }
  } else {
    console.warn("⚠️ withAuthContext() - Cannot set RLS context - missing user ID or organization ID");
  }
  
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error("🚫 withAuthContext() - Operation failed:", error);
    throw error;
  } finally {
    // Clear context after operation to prevent leakage
    contextManager.clearContext();
    if (DEBUG_AUTH_CONTEXT) {
      console.log("🧹 withAuthContext() - Context cleared");
    }
  }
}

