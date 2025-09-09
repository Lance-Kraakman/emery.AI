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

export async function assignUserRole(userId: string, role: SystemRoleType): Promise<Result> {
  try {
    const session = await requireAuth();
    
    if (!session.user.currentOrganizationId) {
      return {
        success: false,
        error: "No current organization selected"
      };
    }
    
    // Check permission with explicit context instead of using wrapper
    const permission = Permission.fromString("users:manage");
    await authRequirePermission(session.user.id, permission, session.user.currentOrganizationId);
    
    const currentOrgId = session.user.currentOrganizationId;
    
    if (!userId || !role) {
      return {
        success: false,
        error: "User ID and role are required"
      };
    }

    // Validate role is one of the allowed roles
    if (!Object.values(SYSTEM_ROLES).includes(role)) {
      return {
        success: false,
        error: `Invalid role: ${role}. Must be one of: ${Object.values(SYSTEM_ROLES).join(', ')}`
      };
    }

    const userRoleService = getUserRoleApplicationService();
    const result = await userRoleService.updateMemberRole({
      userId,
      organizationId: currentOrgId,
      newSystemRole: role,
      updatedBy: session.user.id
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to assign user role"
      };
    }

    revalidatePath('/dashboard');
    revalidatePath('/organization/settings/users');
    
    return {
      success: true,
      data: { message: `Role ${role} assigned successfully` }
    };
  } catch (error) {
    console.error("Error assigning user role:", error);
    return {
      success: false,
      error: "Failed to assign user role",
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

export async function requireAuth() {
  const session = await auth();
  console.log("🔐 requireAuth() - Session check:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    currentOrgId: session?.user?.currentOrganizationId
  });
  
  if (!session?.user) {
    console.error("🚫 requireAuth() - Authentication failed: No session or user");
    throw new Error("Authentication required");
  }
  
  console.log("✅ requireAuth() - Authentication successful");
  return session;
}

export async function requirePermission(permissionString: string) {
  console.log("🛡️ requirePermission() - Starting permission check for:", permissionString);
  
  const session = await requireAuth();
  
  if (!session.user.currentOrganizationId) {
    throw new Error("No current organization selected");
  }
  
  console.log("🛡️ requirePermission() - Context:", {
    userId: session.user.id,
    organizationId: session.user.currentOrganizationId,
    permission: permissionString
  });
  
  
  // Convert string permission to Permission object
  const permission = Permission.fromString(permissionString);
  
  console.log("🛡️ requirePermission() - About to call RBAC requirePermission...");
  
  try {
    // Use explicit organization context from session instead of requireCurrentOrganization
    await authRequirePermission(session.user.id, permission, session.user.currentOrganizationId);
    
    console.log("✅ requirePermission() - Permission check PASSED");
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
  console.log("🛡️ requireResourcePermission() - Starting resource permission check:", {
    permissionString,
    resourceType,
    resourceId
  });
  
  const session = await requireAuth();
  
  if (!session.user.currentOrganizationId) {
    throw new Error("No current organization selected");
  }
  
  // Convert string permission to Permission object
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
    
    console.log("✅ requireResourcePermission() - Resource permission check PASSED");
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

// AIDEV-NOTE: Only these 4 functions are actually used throughout the app