'use server'

// AIDEV-NOTE: Minimal permission/auth functions - only what's actually used
// Most files just import requireAuth and requirePermission

import { auth, hasPermission as authHasPermission, requirePermission as authRequirePermission } from "@/lib/auth";
import { Permission } from "@/ddd/domain/shared/value-objects/permission";
import { revalidatePath } from "next/cache";
// REMOVED: import { requireCurrentOrganization } from "./user-organizations"; - causes circular dependency
import { getRBACRepository, getUserRoleApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";
import { SYSTEM_ROLES, type SystemRoleType } from "@/ddd/domain/rbac/entities/role";
import { OrganizationId, UserId } from "@/ddd/domain/shared/value-objects";
import { headers } from "next/headers";
import { extractApiKeyFromHeader } from "@/lib/auth/user-api-keys";
import { authenticateWithApiKey } from "@/lib/auth/test-auth";

export interface AssignUserRolesCommand {
  userId: string;
  roleIds: number[];
  organizationId?: number;
}

export async function assignUserRoles(command: AssignUserRolesCommand): Promise<Result> {
  try {
    const session = await requireAuth();
    
    const organizationId = command.organizationId || session.user.currentOrganizationId;
    
    if (!organizationId) {
      return {
        success: false,
        error: "No current organization selected"
      };
    }
    
    if (!command.userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    // Check permission using string to avoid Permission VO serialization
    await authRequirePermission(session.user.id, "users:manage", organizationId);
    
    const userRoleService = getUserRoleApplicationService();
    const result = await userRoleService.updateMemberRoles({
      userId: command.userId,
      organizationId,
      roleIds: command.roleIds,
      updatedBy: session.user.id
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to assign user roles"
      };
    }

    revalidatePath('/dashboard');
    revalidatePath('/organization/settings/users');
    
    return {
      success: true,
      data: { message: "Roles assigned successfully" }
    };
  } catch (error) {
    console.error("Error assigning user roles:", error);
    return {
      success: false,
      error: "Failed to assign user roles",
    };
  }
}

// TODO: Replace with RBAC permission-based capability checking
// export async function hasCapability(capability: string): Promise<boolean> {
//   try {
//     const session = await auth();
//     if (!session?.user?.id) {
//       return false;
//     }
//     
//     const currentOrg = await requireCurrentOrganization();
//     // Use RBAC repository to check specific permissions
//     // return await rbacRepository.hasPermission(userId, permission, organizationId);
//     return false; // For now, return false to fix compilation
//   } catch (error) {
//     console.error("Error checking capability:", error);
//     return false;
//   }
// }

/**
 * Get current session without throwing
 * Returns null if not authenticated
 *
 * AIDEV-NOTE: Use this for public access patterns where you need to check
 * if user is authenticated before deciding which code path to take.
 */
export async function getSessionSafe() {
  try {
    // Try NextAuth session first
    const session = await auth();
    if (session?.user) {
      return session;
    }

    // If no session, try API key authentication
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const apiKey = extractApiKeyFromHeader(authHeader);

    if (apiKey) {
      const apiKeyAuth = await authenticateWithApiKey(apiKey);
      if (apiKeyAuth.success && apiKeyAuth.user) {
        return {
          user: {
            id: apiKeyAuth.user.id,
            email: apiKeyAuth.user.email,
            name: apiKeyAuth.user.name,
            currentOrganizationId: apiKeyAuth.user.organizationId,
            organizationRole: apiKeyAuth.user.organizationRole || 'member',
          },
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  // Try NextAuth session first
  const session = await auth();
  if (session?.user) {
    return session;
  }

  // If no session, try API key authentication
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const apiKey = extractApiKeyFromHeader(authHeader);

  if (apiKey) {
    const apiKeyAuth = await authenticateWithApiKey(apiKey);
    if (apiKeyAuth.success && apiKeyAuth.user) {
      // Return session-like object for compatibility
      return {
        user: {
          id: apiKeyAuth.user.id,
          email: apiKeyAuth.user.email,
          name: apiKeyAuth.user.name,
          currentOrganizationId: apiKeyAuth.user.organizationId,
          organizationRole: apiKeyAuth.user.organizationRole || 'member',
        },
      };
    }
  }

  // No valid authentication found
  console.error("🚫 requireAuth() - Authentication failed: No session or user");
  throw new Error("Authentication required");
}

export async function requirePermission(permissionString: string) {
  // console.log("🛡️ requirePermission() - Starting permission check for:", permissionString);

  const session = await requireAuth();

  if (!session.user.currentOrganizationId) {
    throw new Error("No current organization selected");
  }

  // console.log("🛡️ requirePermission() - Context:", {
  //   userId: session.user.id,
  //   organizationId: session.user.currentOrganizationId,
  //   permission: permissionString
  // });

  // Use string permission directly to avoid Permission VO serialization
  // console.log("🛡️ requirePermission() - About to call RBAC requirePermission...");

  try {
    // Use explicit organization context from session instead of requireCurrentOrganization
    await authRequirePermission(session.user.id, permissionString, session.user.currentOrganizationId);

    // console.log("✅ requirePermission() - Permission check PASSED");
    return session;
  } catch (error) {
    console.error("🚫 requirePermission() - Permission check FAILED:", {
      error: error instanceof Error ? error.message : error,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId,
      permission: permissionString
    });
    throw error;
  }
}

// Resource-specific permission checking
export async function requireResourcePermission(
  permissionString: string,
  resourceType: string,
  resourceId?: number
) {
  // console.log("🛡️ requireResourcePermission() - Starting resource permission check:", {
  //   permissionString,
  //   resourceType,
  //   resourceId
  // });

  const session = await requireAuth();

  if (!session.user.currentOrganizationId) {
    throw new Error("No current organization selected");
  }

  // Convert string permission to Permission object for repository call
  const permission = Permission.fromString(permissionString);
  
  try {
    const rbacRepository = getRBACRepository();

    await rbacRepository.requireResourcePermission(
      UserId.fromString(session.user.id),
      permission,
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      resourceType,
      resourceId
    );

    // console.log("✅ requireResourcePermission() - Resource permission check PASSED");
    return session;
  } catch (error) {
    console.error("🚫 requireResourcePermission() - Resource permission check FAILED:", {
      error: error instanceof Error ? error.message : error,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId,
      permission: permissionString,
      resourceType,
      resourceId
    });
    throw error;
  }
}

/**
 * Check if the current user has a specific permission (for client-side use)
 */
export async function checkPermission(permissionString: string): Promise<Result<boolean>> {
  try {
    const session = await requireAuth();

    if (!session.user.currentOrganizationId) {
      return {
        success: false,
        error: "No current organization selected"
      };
    }

    // Use the existing hasPermission function from lib/auth
    const { hasPermission } = await import('@/lib/auth');
    const hasPermissionResult = await hasPermission(
      session.user.id,
      permissionString,
      session.user.currentOrganizationId
    );

    return {
      success: true,
      data: hasPermissionResult
    };
  } catch (error) {
    console.error("Error checking permission:", error);
    return {
      success: false,
      error: "Failed to check permission"
    };
  }
}

/**
 * Check multiple permissions at once (batch operation for client-side use)
 */
export async function checkPermissions(permissions: string[]): Promise<Result<Record<string, boolean>>> {
  try {
    const session = await requireAuth();

    if (!session.user.currentOrganizationId) {
      return {
        success: false,
        error: "No current organization selected"
      };
    }

    const { hasPermission } = await import('@/lib/auth');
    const results: Record<string, boolean> = {};

    // Check all permissions in parallel
    await Promise.all(
      permissions.map(async (permissionString) => {
        const hasPermissionResult = await hasPermission(
          session.user.id,
          permissionString,
          session.user.currentOrganizationId!
        );
        results[permissionString] = hasPermissionResult;
      })
    );

    return {
      success: true,
      data: results
    };
  } catch (error) {
    console.error("Error checking permissions:", error);
    return {
      success: false,
      error: "Failed to check permissions"
    };
  }
}

/**
 * Check resource permission (for client-side use)
 */
export async function checkResourcePermission(
  permissionString: string,
  resourceType: string,
  resourceId?: number
): Promise<Result<boolean>> {
  try {
    const session = await requireAuth();

    if (!session.user.currentOrganizationId) {
      return {
        success: false,
        error: "No current organization selected"
      };
    }

    const permission = Permission.fromString(permissionString);
    const rbacRepository = getRBACRepository();

    const hasPermissionResult = await rbacRepository.hasResourcePermission(
      UserId.fromString(session.user.id),
      permission,
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      resourceType,
      resourceId
    );

    return {
      success: true,
      data: hasPermissionResult
    };
  } catch (error) {
    console.error("Error checking resource permission:", error);
    return {
      success: false,
      error: "Failed to check resource permission"
    };
  }
}

export interface ResourcePermissionCheck {
  permission: string;
  resourceType: string;
  resourceId?: number;
}

/**
 * Check multiple resource permissions at once (batch operation for client-side use)
 */
export async function checkResourcePermissions(
  checks: ResourcePermissionCheck[]
): Promise<Result<boolean[]>> {
  try {
    const session = await requireAuth();

    if (!session.user.currentOrganizationId) {
      return {
        success: false,
        error: "No current organization selected"
      };
    }

    const rbacRepository = getRBACRepository();
    const results: boolean[] = [];

    // Check all permissions in parallel
    await Promise.all(
      checks.map(async (check, index) => {
        const permission = Permission.fromString(check.permission);
        const hasPermissionResult = await rbacRepository.hasResourcePermission(
          UserId.fromString(session.user.id),
          permission,
          OrganizationId.fromNumber(session.user.currentOrganizationId!),
          check.resourceType,
          check.resourceId
        );
        results[index] = hasPermissionResult;
      })
    );

    return {
      success: true,
      data: results
    };
  } catch (error) {
    console.error("Error checking resource permissions:", error);
    return {
      success: false,
      error: "Failed to check resource permissions"
    };
  }
}

// AIDEV-NOTE: Functions for permission checking:
// - requireAuth() - Ensures user is authenticated
// - requirePermission() - Throws if user lacks org-level permission
// - requireResourcePermission() - Throws if user lacks resource-specific permission
// - checkPermission() - Returns boolean for single org-level permission (client-side)
// - checkPermissions() - Returns Record for multiple org-level permissions (client-side)
// - checkResourcePermission() - Returns boolean for single resource permission (client-side)
// - checkResourcePermissions() - Returns array of booleans for multiple resource permissions (client-side)