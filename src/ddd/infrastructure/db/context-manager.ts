/**
 * Async-safe RLS context management using Node.js AsyncLocalStorage.
 *
 * H-2 fix: The previous implementation used a global mutable singleton,
 * which was NOT async-safe. Concurrent async operations (e.g. the scheduler
 * processing automations from different orgs) could overwrite each other's
 * context, causing cross-tenant data leakage.
 *
 * AsyncLocalStorage provides per-async-chain context isolation — each
 * call to withContext() gets its own context that cannot be overwritten
 * by concurrent operations.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

interface ContextData {
  organizationId: OrganizationId;
  userId?: UserId; // Optional - for audit trails and user-specific operations
}

const asyncLocalStorage = new AsyncLocalStorage<ContextData>();

class ContextManager {
  /**
   * Set RLS context for the current async execution chain.
   * Uses AsyncLocalStorage.enterWith() for backwards compatibility with
   * code that uses setContext()/clearContext() instead of withContext().
   */
  setContext(organizationId: OrganizationId, userId?: UserId): void {
    asyncLocalStorage.enterWith({ organizationId, userId });
  }

  /**
   * Get current context from the async-local store.
   */
  getContext(): ContextData | null {
    return asyncLocalStorage.getStore() ?? null;
  }

  /**
   * Clear RLS context for the current async execution chain.
   */
  clearContext(): void {
    // enterWith(undefined) exits the store for this async chain
    asyncLocalStorage.enterWith(undefined as any);
  }

  /**
   * Check if context is currently set in this async chain.
   */
  hasContext(): boolean {
    return asyncLocalStorage.getStore() != null;
  }

  /**
   * Execute operation with scoped context (preferred API).
   * Context is automatically isolated to this async chain and cleaned up
   * when the operation completes — no risk of cross-contamination.
   */
  async withContext<T>(
    organizationId: OrganizationId,
    operation: () => Promise<T>,
    userId?: UserId
  ): Promise<T> {
    return asyncLocalStorage.run({ organizationId, userId }, operation);
  }
}

// Singleton instance — safe because state is in AsyncLocalStorage, not the object
export const contextManager = new ContextManager();
