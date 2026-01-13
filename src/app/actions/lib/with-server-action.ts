'use server'

/**
 * Server Action Boilerplate Wrapper
 *
 * Encapsulates common patterns used across all server actions:
 * - withAuthContext for RLS context setting
 * - Permission checking via requirePermission
 * - Organization context via requireCurrentOrganization
 * - Audit logging on success
 *
 * AIDEV-NOTE: This consolidates ~600 lines of duplicated boilerplate across 38 action files
 */

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission } from "../permissions";
import { requireCurrentOrganization } from "../user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getAuditApplicationService } from "@/ddd/application/di/container";
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import type { OrganizationDTO } from '@/app/mappers/organization-mapper';
import type { AuditEventType } from '@/ddd/domain/audit/types';

/**
 * Session type returned by requirePermission
 */
export interface ActionSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    currentOrganizationId?: number;
    organizationRole?: string;
  };
}

/**
 * Context provided to the operation callback
 */
export interface ActionContext {
  session: ActionSession;
  org: OrganizationDTO;
}

/**
 * Audit configuration for automatic audit logging
 */
export interface AuditConfig {
  /** Event type category (e.g., 'agent', 'database', 'security') */
  eventType: AuditEventType;
  /** Event category for grouping (e.g., 'agent_crud', 'table_crud') */
  eventCategory: string;
  /** Action performed (e.g., 'create', 'update', 'delete') */
  eventAction: string;
  /** Resource type being acted upon */
  resourceType: string;
  /** Optional: Additional event data to include in audit log */
  eventData?: Record<string, unknown>;
}

/**
 * Options for withServerAction
 */
export interface ServerActionOptions {
  /** Path(s) to revalidate after successful operation */
  revalidatePaths?: string[];
  /** Default revalidation path if none specified */
  defaultRevalidatePath?: string;
}

/**
 * Result with resource info for audit logging
 * The operation should return data with optional id/name for audit
 */
export interface AuditableResult<T = any> extends Result<T> {
  data?: T & {
    id?: string | number;
    name?: string;
  };
}

/**
 * Wrapper for server actions that handles common boilerplate:
 * 1. Wraps with withAuthContext for RLS
 * 2. Checks permission and gets session
 * 3. Gets current organization
 * 4. Executes the operation
 * 5. Logs audit event on success (if auditConfig provided)
 * 6. Revalidates paths
 *
 * @param permission - Permission string to check (e.g., "agents:manage")
 * @param operation - The async operation to execute
 * @param auditConfig - Optional audit configuration for logging
 * @param options - Optional configuration for revalidation paths
 * @returns Promise<Result<T>>
 *
 * @example
 * ```ts
 * export async function createAgent(data: CreateAgentData): Promise<Result> {
 *   return withServerAction(
 *     "agents:manage",
 *     async ({ session, org }) => {
 *       const service = getAgentApplicationService();
 *       return service.createAgent({ ...data, organizationId: org.id, ownerId: session.user.id });
 *     },
 *     { eventType: 'agent', eventCategory: 'agent_crud', eventAction: 'create', resourceType: 'agent' },
 *     { defaultRevalidatePath: '/manage' }
 *   );
 * }
 * ```
 */
export async function withServerAction<T>(
  permission: string,
  operation: (ctx: ActionContext) => Promise<AuditableResult<T>>,
  auditConfig?: AuditConfig,
  options?: ServerActionOptions
): Promise<Result<T>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission(permission);
      const org = await requireCurrentOrganization();

      const result = await operation({ session, org });

      if (result.success && auditConfig) {
        const auditService = getAuditApplicationService();
        auditService.logEvent(
          OrganizationId.fromNumber(org.id),
          {
            eventType: auditConfig.eventType,
            eventCategory: auditConfig.eventCategory,
            eventAction: auditConfig.eventAction,
            actorType: 'user',
            actorId: session.user.id,
            actorName: session.user.name || undefined,
            resourceType: auditConfig.resourceType,
            resourceId: result.data?.id ? String(result.data.id) : undefined,
            resourceName: result.data?.name,
            eventData: auditConfig.eventData || {},
            success: true,
          }
        );
      }

      // Revalidate paths if operation succeeded
      if (result.success) {
        if (options?.revalidatePaths) {
          options.revalidatePaths.forEach(path => revalidatePath(path));
        } else if (options?.defaultRevalidatePath) {
          revalidatePath(options.defaultRevalidatePath);
        }
      }

      return result;
    } catch (error) {
      console.error(`Server action error (permission: ${permission}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Operation failed",
      };
    }
  });
}

/**
 * Wrapper for server actions that require resource-specific permissions
 * Similar to withServerAction but uses requireResourcePermission
 *
 * @param permission - Permission string to check
 * @param resourceType - Type of resource being accessed
 * @param resourceId - ID of the specific resource
 * @param operation - The async operation to execute
 * @param auditConfig - Optional audit configuration
 * @param options - Optional configuration for revalidation paths
 */
export async function withResourceServerAction<T>(
  permission: string,
  resourceType: string,
  resourceId: number | undefined,
  operation: (ctx: ActionContext) => Promise<AuditableResult<T>>,
  auditConfig?: AuditConfig,
  options?: ServerActionOptions
): Promise<Result<T>> {
  return withAuthContext(async () => {
    try {
      const session = await requireResourcePermission(permission, resourceType, resourceId);
      const org = await requireCurrentOrganization();

      const result = await operation({ session, org });

      if (result.success && auditConfig) {
        const auditService = getAuditApplicationService();
        auditService.logEvent(
          OrganizationId.fromNumber(org.id),
          {
            eventType: auditConfig.eventType,
            eventCategory: auditConfig.eventCategory,
            eventAction: auditConfig.eventAction,
            actorType: 'user',
            actorId: session.user.id,
            actorName: session.user.name || undefined,
            resourceType: auditConfig.resourceType,
            resourceId: result.data?.id ? String(result.data.id) : String(resourceId),
            resourceName: result.data?.name,
            eventData: auditConfig.eventData || {},
            success: true,
          }
        );
      }

      // Revalidate paths if operation succeeded
      if (result.success) {
        if (options?.revalidatePaths) {
          options.revalidatePaths.forEach(path => revalidatePath(path));
        } else if (options?.defaultRevalidatePath) {
          revalidatePath(options.defaultRevalidatePath);
        }
      }

      return result;
    } catch (error) {
      console.error(`Server action error (permission: ${permission}, resource: ${resourceType}/${resourceId}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Operation failed",
      };
    }
  });
}

/**
 * Lightweight wrapper for read-only operations that don't need audit logging
 *
 * @param permission - Permission string to check
 * @param operation - The async operation to execute
 */
export async function withReadOnlyAction<T>(
  permission: string,
  operation: (ctx: ActionContext) => Promise<T>
): Promise<T> {
  return withAuthContext(async () => {
    const session = await requirePermission(permission);
    const org = await requireCurrentOrganization();
    return operation({ session, org });
  });
}
