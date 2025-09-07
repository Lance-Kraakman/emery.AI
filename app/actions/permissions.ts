'use server'

// AIDEV-NOTE: Minimal permission/auth functions - only what's actually used
// Most files just import requireAuth and requirePermission

import { auth, hasPermission as authHasPermission, requirePermission as authRequirePermission } from "@/lib/auth";
import { Permission } from "@/ddd/domain/shared/value-objects/permission";
import { revalidatePath } from "next/cache";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getUserRoleApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";
import { UserRole, type UserRoleCapabilities } from "@/ddd/domain/shared/value-objects/user-role";
import { ORGANIZATION_ROLES, type OrganizationRoleType } from "@/ddd/domain/shared/value-objects/organization-role";
import { UserId } from "@/ddd/domain/shared/value-objects";

export async function assignUserRole(userId: string, role: OrganizationRoleType): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    const currentOrg = await requireCurrentOrganization();
    
    if (!userId || !role) {
      return {
        success: false,
        error: "User ID and role are required"
      };
    }

    // Validate role is one of the allowed roles
    if (!Object.values(ORGANIZATION_ROLES).includes(role)) {
      return {
        success: false,
        error: `Invalid role: ${role}. Must be one of: ${Object.values(ORGANIZATION_ROLES).join(', ')}`
      };
    }

    const userRoleService = getUserRoleApplicationService();
    const result = await userRoleService.updateMemberRole({
      userId,
      organizationId: currentOrg.id.value,
      newRole: role,
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

export async function hasCapability(capability: keyof UserRoleCapabilities): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return false;
    }
    
    const currentOrg = await requireCurrentOrganization();
    const userRoleService = getUserRoleApplicationService();
    
    // Get user's role in the organization
    const userRoleString = await userRoleService.getUserOrganizationRole(UserId.fromString(session.user.id), currentOrg.id);
    if (!userRoleString) {
      return false;
    }

    const userRole = UserRole.fromString(userRoleString);
    return userRole.capabilities[capability];
  } catch (error) {
    console.error("Error checking capability:", error);
    return false;
  }
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Authentication required");
  }
  return session;
}

export async function requirePermission(permissionString: string) {
  const session = await requireAuth();
  const currentOrg = await requireCurrentOrganization();
  
  // Convert string permission to Permission object
  const permission = Permission.fromString(permissionString);
  
  // Use the new RBAC requirePermission with organization ID
  await authRequirePermission(session.user.id, permission, currentOrg.id.value);
  
  return session;
}

// AIDEV-NOTE: Only these 4 functions are actually used throughout the app