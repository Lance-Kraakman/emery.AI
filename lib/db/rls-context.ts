/**
 * Simplified RLS Context Management
 * 
 * AIDEV-NOTE: Simple utility functions for RLS context management.
 * Provides a single function with optional user parameter to handle both org-only and full context.
 * 
 * Usage in Application Services:
 * ```typescript
 * const result = await withRLSContext(db, orgId, async (tx) => {
 *   return await tx.select().from(agents);
 * }, userId); // userId is optional
 * ```
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from './client';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

type DrizzleTransaction = PgTransaction<any, any, any>;

/**
 * Execute operations with RLS context - handles both organization-only and full user+org context
 * 
 * @param db - Drizzle database instance
 * @param organizationId - Required organization context for RLS policies
 * @param operation - Database operation to execute with RLS context
 * @param userId - Optional user context for audit trails and user-specific operations
 * @returns Promise resolving to operation result
 */
export async function withRLSContext<T>(
  db: DbClient,
  organizationId: OrganizationId,
  operation: (tx: DrizzleTransaction) => Promise<T>,
  userId?: UserId
): Promise<T> {
  return await db.transaction(async (tx) => {
    try {
      // Always set organization context (primary RLS boundary)
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${organizationId.value.toString()}, true)`);
      
      // Optionally set user context for audit trails and user-specific operations
      if (userId) {
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId.value}, true)`);
      }
      
      // Execute the operation with proper RLS context
      return await operation(tx);
      
    } finally {
      // Context automatically cleared when transaction ends
      // No manual cleanup needed - PostgreSQL handles this
    }
  });
}