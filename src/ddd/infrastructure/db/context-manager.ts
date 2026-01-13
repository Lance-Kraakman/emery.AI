import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// AIDEV-NOTE: Simplified context management for RLS policies
// Single function handles both organization-only and full user+organization context
// Organization context is required, user context is optional for audit/user-specific operations

interface ContextData {
  organizationId: OrganizationId;
  userId?: UserId; // Optional - for audit trails and user-specific operations
}

class ContextManager {
  private context: ContextData | null = null;

  /**
   * Set RLS context for database operations
   * @param organizationId - Required organization context for RLS policies
   * @param userId - Optional user context for audit trails and user-specific operations
   */
  setContext(organizationId: OrganizationId, userId?: UserId): void {
    this.context = { organizationId, userId };
  }

  /**
   * Get current context (for debugging and internal use)
   */
  getContext(): ContextData | null {
    return this.context;
  }

  /**
   * Clear RLS context - subsequent operations will use normal database client
   */
  clearContext(): void {
    this.context = null;
  }

  /**
   * Check if context is currently set
   */
  hasContext(): boolean {
    return this.context !== null;
  }

  /**
   * Execute operation with temporary context
   * Useful for one-off operations that need specific context
   */
  async withContext<T>(
    organizationId: OrganizationId,
    operation: () => Promise<T>,
    userId?: UserId
  ): Promise<T> {
    const previousContext = this.context;
    this.setContext(organizationId, userId);
    
    try {
      return await operation();
    } finally {
      this.context = previousContext;
    }
  }
}

// Singleton instance for global context management
export const contextManager = new ContextManager();