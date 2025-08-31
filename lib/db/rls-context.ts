/**
 * Row Level Security (RLS) Context Management - Standard Drizzle Pattern
 * 
 * AIDEV-NOTE: Transaction-based RLS context management following Drizzle's standard pattern.
 * Similar to Drizzle's Supabase integration but uses session variables instead of JWT claims.
 * Context is automatically cleared when transaction ends, ensuring no context leakage.
 * 
 * Usage in Application Services:
 * ```typescript
 * const tasks = await withRLSContext(db, userId, orgId, async (tx) => {
 *   return await tx.select().from(tasks);
 * });
 * ```
 * 
 * Usage in Integration Tests:
 * ```typescript
 * const user = await withRLSContext(testDb, testUserId, testOrgId, async (tx) => {
 *   return await userRepo.create(userData, tx);
 * });
 * ```
 */

import { sql } from 'drizzle-orm';
import type { db } from './client';
import type { PgDatabase, PgTransaction } from 'drizzle-orm/pg-core';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

type DrizzleDB = typeof db;
type DrizzleTransaction = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

/**
 * Execute operations with RLS context set - Standard Drizzle transaction pattern
 * 
 * This follows the same pattern as Drizzle's Supabase integration:
 * 1. Start transaction
 * 2. Set PostgreSQL session variables for RLS policies
 * 3. Execute operation with proper context
 * 4. Context automatically cleared when transaction ends
 * 
 * @param db - Drizzle database instance
 * @param userId - User UUID for auth.uid() function  
 * @param organizationId - Organization ID for get_current_organization_id() function
 * @param operation - Database operation to execute with RLS context
 * @returns Promise resolving to operation result
 */
export async function withRLSContext<T>(
  db: DrizzleDB,
  userId: UserId,
  organizationId: OrganizationId,
  operation: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    try {
      // Set RLS context variables for this transaction
      await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId.value}, true)`);
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${organizationId.value.toString()}, true)`);
      
      // Execute the operation with proper RLS context
      return await operation(tx);
      
    } finally {
      // Context automatically cleared when transaction ends
      // No manual cleanup needed - PostgreSQL handles this
    }
  });
}

/**
 * Execute operations with only organization context (for system operations)
 * 
 * Use this when operations don't need user-specific context but still need
 * organization isolation for RLS policies.
 * 
 * @param db - Drizzle database instance
 * @param organizationId - Organization ID for get_current_organization_id() function
 * @param operation - Database operation to execute with organization context
 * @returns Promise resolving to operation result
 */
export async function withOrganizationContext<T>(
  db: DrizzleDB,
  organizationId: OrganizationId,
  operation: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    try {
      // Set only organization context for system operations
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${organizationId.value.toString()}, true)`);
      
      return await operation(tx);
      
    } finally {
      // Context automatically cleared when transaction ends
    }
  });
}