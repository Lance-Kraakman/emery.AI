/**
 * Context-Aware Database Client - Enhanced DB Client for Hidden RLS
 * 
 * AIDEV-NOTE: This implements the "Enhanced DB Client" approach for truly hidden RLS.
 * The client automatically applies RLS context to all database operations when context is set,
 * requiring zero changes to repositories or application services.
 * 
 * Key Features:
 * - setContext(userId, orgId) - Set RLS context for subsequent operations
 * - clearContext() - Clean up context 
 * - Transparent Proxy - Intercepts all db.query and db.transaction calls
 * - Automatic RLS - Wraps operations with withRLSContext when context is set
 * - Fallback Mode - Works like normal DB client when no context is set
 * 
 * Usage in API Routes:
 * ```typescript
 * const db = getContextAwareDb();
 * db.setContext(userId, orgId);
 * try {
 *   // All service calls automatically get RLS context
 *   const tasks = await taskService.getTasks(orgId);
 * } finally {
 *   db.clearContext();
 * }
 * ```
 */

import { withRLSContext, withOrganizationContext } from './rls-context';
import type { db } from './client';

type DrizzleDB = typeof db;
type DrizzleTransaction = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

interface RLSContext {
  userId?: string;
  organizationId?: number;
}

export class ContextAwareDbClient {
  private currentContext: RLSContext = {};

  constructor(private baseDb: DrizzleDB) {}

  /**
   * Set RLS context for subsequent database operations
   * All queries and transactions will automatically use this context
   */
  setContext(userId: string, organizationId: number): void {
    this.currentContext = { userId, organizationId };
  }

  /**
   * Set organization-only context (for system operations)
   */
  setOrganizationContext(organizationId: number): void {
    this.currentContext = { organizationId };
  }

  /**
   * Clear RLS context - subsequent operations will use normal DB client
   */
  clearContext(): void {
    this.currentContext = {};
  }

  /**
   * Get current context (for debugging/testing)
   */
  getContext(): RLSContext {
    return { ...this.currentContext };
  }

  /**
   * Proxy for db.query that automatically applies RLS context
   * This is where the magic happens - all repository queries get RLS automatically
   */
  get query() {
    if (this.hasFullContext()) {
      // Return a proxy that wraps all query operations with RLS context
      return this.createRLSQueryProxy();
    } else if (this.hasOrganizationContext()) {
      // Return a proxy that wraps with organization context only
      return this.createOrgQueryProxy();
    }
    
    // No context set - return normal query interface
    return this.baseDb.query;
  }

  /**
   * Proxy for db.transaction that automatically applies RLS context
   */
  transaction<T>(callback: (tx: DrizzleTransaction) => Promise<T>): Promise<T> {
    if (this.hasFullContext()) {
      return withRLSContext(
        this.baseDb,
        this.currentContext.userId!,
        this.currentContext.organizationId!,
        callback
      );
    } else if (this.hasOrganizationContext()) {
      return withOrganizationContext(
        this.baseDb,
        this.currentContext.organizationId!,
        callback
      );
    }

    // No context set - use normal transaction
    return this.baseDb.transaction(callback);
  }

  /**
   * Direct access to base db methods (for operations that don't need RLS)
   */
  get raw() {
    return this.baseDb;
  }

  /**
   * Execute a single operation with temporary context
   * Useful for one-off operations without changing the global context
   */
  async withContext<T>(
    userId: string,
    organizationId: number,
    operation: () => Promise<T>
  ): Promise<T> {
    const previousContext = { ...this.currentContext };
    this.setContext(userId, organizationId);
    
    try {
      return await operation();
    } finally {
      this.currentContext = previousContext;
    }
  }

  /**
   * Execute a single operation with temporary organization context
   */
  async withOrganizationContext<T>(
    organizationId: number,
    operation: () => Promise<T>
  ): Promise<T> {
    const previousContext = { ...this.currentContext };
    this.setOrganizationContext(organizationId);
    
    try {
      return await operation();
    } finally {
      this.currentContext = previousContext;
    }
  }

  // Private helper methods

  private hasFullContext(): boolean {
    return !!(this.currentContext.userId && this.currentContext.organizationId);
  }

  private hasOrganizationContext(): boolean {
    return !!this.currentContext.organizationId;
  }

  /**
   * Create a proxy for query operations with full RLS context
   * This intercepts all query calls and wraps them with withRLSContext
   */
  private createRLSQueryProxy(): any {
    const userId = this.currentContext.userId!;
    const organizationId = this.currentContext.organizationId!;
    const baseQuery = this.baseDb.query;
    const baseDb = this.baseDb;

    return new Proxy(baseQuery, {
      get(target, prop) {
        const originalMethod = target[prop as keyof typeof target];
        
        if (typeof originalMethod === 'object' && originalMethod !== null) {
          // This is a table query object (e.g., db.query.tasks)
          return new Proxy(originalMethod, {
            get(tableTarget, tableProp) {
              const originalTableMethod = tableTarget[tableProp as keyof typeof tableTarget];
              
              if (typeof originalTableMethod === 'function') {
                // This is a query method (e.g., findFirst, findMany)
                return function(...args: any[]) {
                  // Wrap the query with RLS context
                  return withRLSContext(baseDb, userId, organizationId, async (tx) => {
                    // Call the original method on the transaction query interface
                    return (tx.query as any)[prop][tableProp](...args);
                  });
                };
              }
              
              return originalTableMethod;
            }
          });
        }
        
        return originalMethod;
      }
    });
  }

  /**
   * Create a proxy for query operations with organization context only
   */
  private createOrgQueryProxy(): any {
    const organizationId = this.currentContext.organizationId!;
    const baseQuery = this.baseDb.query;
    const baseDb = this.baseDb;

    return new Proxy(baseQuery, {
      get(target, prop) {
        const originalMethod = target[prop as keyof typeof target];
        
        if (typeof originalMethod === 'object' && originalMethod !== null) {
          // This is a table query object (e.g., db.query.tasks)
          return new Proxy(originalMethod, {
            get(tableTarget, tableProp) {
              const originalTableMethod = tableTarget[tableProp as keyof typeof tableTarget];
              
              if (typeof originalTableMethod === 'function') {
                // This is a query method (e.g., findFirst, findMany)
                return function(...args: any[]) {
                  // Wrap the query with organization context
                  return withOrganizationContext(baseDb, organizationId, async (tx) => {
                    // Call the original method on the transaction query interface
                    return (tx.query as any)[prop][tableProp](...args);
                  });
                };
              }
              
              return originalTableMethod;
            }
          });
        }
        
        return originalMethod;
      }
    });
  }
}

// Singleton pattern for global context-aware client
let contextAwareDbInstance: ContextAwareDbClient | null = null;

/**
 * Get the global context-aware database client instance
 * This replaces the standard db client in API routes and services
 */
export function getContextAwareDb(): ContextAwareDbClient {
  if (!contextAwareDbInstance) {
    throw new Error('Context-aware DB client not initialized. Call initializeContextAwareDb() first.');
  }
  return contextAwareDbInstance;
}

/**
 * Initialize the context-aware database client with the base DB instance
 * Should be called once during application startup
 */
export function initializeContextAwareDb(baseDb: DrizzleDB): ContextAwareDbClient {
  contextAwareDbInstance = new ContextAwareDbClient(baseDb);
  return contextAwareDbInstance;
}

/**
 * Reset the context-aware DB client (for testing)
 */
export function resetContextAwareDb(): void {
  contextAwareDbInstance = null;
}