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
  
  console.log("🔧 withAuthContext() - Setting RLS context:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    currentOrgId: session?.user?.currentOrganizationId,
    willSetContext: !!(session?.user?.id && session?.user?.currentOrganizationId)
  });
  
  if (session?.user?.id && session?.user?.currentOrganizationId) {
    contextManager.setContext(
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      UserId.fromString(session.user.id)
    );
    console.log("✅ withAuthContext() - RLS context set successfully");
  } else {
    console.warn("⚠️ withAuthContext() - Cannot set RLS context - missing user ID or organization ID");
  }
  
  try {
    const result = await operation();
    console.log("✅ withAuthContext() - Operation completed successfully");
    return result;
  } catch (error) {
    console.error("🚫 withAuthContext() - Operation failed:", error);
    throw error;
  } finally {
    // Clear context after operation to prevent leakage
    contextManager.clearContext();
    console.log("🧹 withAuthContext() - Context cleared");
  }
}

