/**
 * System Context Utilities
 * 
 * AIDEV-NOTE: Provides clean helpers for system-level database operations
 * Used by scheduler and other system services that need elevated access
 * while maintaining organization boundaries through RLS policies.
 */

import { contextManager } from './context-manager';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// System user created in drizzle migration 0004.
// Override via SYSTEM_USER_ID env var to avoid hardcoded well-known UUID in app code.
// Fallback matches the seeded value in 0004_auto-users-assignments.sql.
export const SYSTEM_USER_ID_VALUE = process.env.SYSTEM_USER_ID ?? "bdd640fb-0667-4ad1-9c80-317fa3b1799d";
const SYSTEM_USER_ID = UserId.fromString(SYSTEM_USER_ID_VALUE);

/**
 * Execute operation with system user context for the given organization
 * 
 * This helper provides a clean API for system services (like the scheduler)
 * to perform database operations with elevated privileges while maintaining
 * organization boundaries.
 * 
 * @param organizationId - Organization context for the operation
 * @param operation - Async operation to execute with system context
 * @returns Promise resolving to the operation result
 * 
 * @example
 * ```typescript
 * await withSystemContext(organizationId, async () => {
 *   const agents = await agentRepository.findByOrganization(organizationId);
 *   return await processAgents(agents);
 * });
 * ```
 */
export async function withSystemContext<T>(
  organizationId: OrganizationId | number,
  operation: () => Promise<T>
): Promise<T> {
  const orgId = typeof organizationId === 'number' 
    ? OrganizationId.fromNumber(organizationId) 
    : organizationId;
    
  return contextManager.withContext(orgId, operation, SYSTEM_USER_ID);
}