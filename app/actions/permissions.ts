'use server'

// AIDEV-NOTE: Server Actions for permission management using PermissionApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { auth, hasPermission as authHasPermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requireCurrentOrganization } from "./user-organizations";
import { getPermissionApplicationService, getUserRepository } from "@/ddd/application/di/container";
import type { Result } from "./types";
import type { UpdateUserData } from "./types";
import type {
  AssignRoleCommand,
  CreateRoleCommand,
  UpdateRoleCommand,
  RoleFilters
} from "@/ddd/application/services/permissions/permission-application-service";
import { UserId, EmailAddress } from "@/ddd/domain/shared/value-objects";

export async function assignUserRole(userId: string, roleId: number): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    const currentOrg = await requireCurrentOrganization();
    
    if (!userId || !roleId) {
      return {
        success: false,
        error: "User ID and Role ID are required"
      };
    }

    const permissionApplicationService = getPermissionApplicationService();
    
    const command: AssignRoleCommand = {
      userId,
      roleId,
      organizationId: currentOrg.id.value
    };

    const result = await permissionApplicationService.assignRole(command);

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
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error assigning user role:", error);
    return {
      success: false,
      error: "Failed to assign user role",
    };
  }
}

export async function updateUserProfile(userId: string, data: UpdateUserData): Promise<Result> {
  try {
    const session = await requireAuth();
    
    if (!userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    // Check if user is updating their own profile or has manage_users permission
    if (session.user.id !== userId) {
      const hasAccess = await authHasPermission(session.user.id, "manage_users");
      if (!hasAccess) {
        return {
          success: false,
          error: "Permission denied: can only update own profile or need manage_users permission",
        };
      }
    }

    const userRepo = getUserRepository();
    
    // Convert action types to domain types
    const domainUpdateData = {
      ...data,
      email: data.email ? EmailAddress.fromString(data.email) : undefined
    };
    
    const updatedUser = await userRepo.update(UserId.fromString(userId), domainUpdateData);

    revalidatePath('/dashboard');
    revalidatePath('/organization/settings/users');
    
    return {
      success: true,
      data: updatedUser,
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: "Failed to update user profile",
    };
  }
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const session = await requirePermission("view_users");
    
    if (!userId) {
      return [];
    }

    const permissionApplicationService = getPermissionApplicationService();
    return await permissionApplicationService.getUserPermissions(userId);
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

export async function hasPermission(permission: string): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return false;
    }

    const permissionApplicationService = getPermissionApplicationService();
    return await permissionApplicationService.checkUserPermission(session.user.id, permission);
  } catch (error) {
    console.error("Error checking permission:", error);
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

export async function requirePermission(permission: string) {
  const session = await requireAuth();
  const hasAccess = await authHasPermission(session.user.id, permission);
  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return session;
}

/**
 * Create a new role in the organization
 */
export async function createRole(name: string, permissions: string[]): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    const currentOrg = await requireCurrentOrganization();
    
    if (!name?.trim() || !permissions || permissions.length === 0) {
      return {
        success: false,
        error: "Role name and permissions are required"
      };
    }

    const permissionApplicationService = getPermissionApplicationService();
    
    const command: CreateRoleCommand = {
      name: name.trim(),
      permissions,
      organizationId: currentOrg.id.value
    };

    const result = await permissionApplicationService.createRole(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create role"
      };
    }

    revalidatePath('/organization/settings/roles');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error creating role:", error);
    return {
      success: false,
      error: "Failed to create role",
    };
  }
}

/**
 * Update an existing role
 */
export async function updateRole(roleId: number, name?: string, permissions?: string[]): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!roleId) {
      return {
        success: false,
        error: "Role ID is required"
      };
    }

    const permissionApplicationService = getPermissionApplicationService();
    
    const command: UpdateRoleCommand = {
      roleId,
      name: name?.trim(),
      permissions
    };

    const result = await permissionApplicationService.updateRole(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update role"
      };
    }

    revalidatePath('/organization/settings/roles');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error updating role:", error);
    return {
      success: false,
      error: "Failed to update role",
    };
  }
}

/**
 * Delete a role
 */
export async function deleteRole(roleId: number): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    const currentOrg = await requireCurrentOrganization();
    
    if (!roleId) {
      return {
        success: false,
        error: "Role ID is required"
      };
    }

    const permissionApplicationService = getPermissionApplicationService();
    const result = await permissionApplicationService.deleteRole(roleId, currentOrg.id.value);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete role"
      };
    }

    revalidatePath('/organization/settings/roles');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Role deleted successfully" },
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error deleting role:", error);
    return {
      success: false,
      error: "Failed to delete role",
    };
  }
}

/**
 * Get all roles for the current organization
 */
export async function getOrganizationRoles(searchQuery?: string, hasPermission?: string) {
  try {
    const session = await requirePermission("view_users");
    const currentOrg = await requireCurrentOrganization();
    
    const permissionApplicationService = getPermissionApplicationService();
    
    const filters: RoleFilters = {
      organizationId: currentOrg.id.value,
      searchQuery,
      hasPermission
    };

    return await permissionApplicationService.getRoles(filters);
  } catch (error) {
    console.error("Error fetching organization roles:", error);
    throw new Error("Failed to fetch organization roles");
  }
}

/**
 * Get role details by ID
 */
export async function getRole(roleId: number) {
  try {
    const session = await requirePermission("view_users");
    
    if (!roleId) {
      throw new Error("Role ID is required");
    }

    const permissionApplicationService = getPermissionApplicationService();
    const role = await permissionApplicationService.getRole(roleId);
    
    if (!role) {
      throw new Error("Role not found");
    }

    return role;
  } catch (error) {
    console.error("Error fetching role:", error);
    throw new Error("Failed to fetch role");
  }
}

/**
 * Get role summary with usage statistics
 */
export async function getRoleSummary(roleId: number) {
  try {
    const session = await requirePermission("view_users");
    
    if (!roleId) {
      throw new Error("Role ID is required");
    }

    const permissionApplicationService = getPermissionApplicationService();
    const result = await permissionApplicationService.getRoleSummary(roleId);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to get role summary");
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching role summary:", error);
    throw new Error("Failed to fetch role summary");
  }
}

/**
 * Get all available permissions
 */
export async function getAvailablePermissions() {
  try {
    const session = await requirePermission("view_users");
    
    const permissionApplicationService = getPermissionApplicationService();
    return await permissionApplicationService.getAvailablePermissions();
  } catch (error) {
    console.error("Error fetching available permissions:", error);
    throw new Error("Failed to fetch available permissions");
  }
}

/**
 * Initialize default roles for organization
 */
export async function initializeDefaultRoles(): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    const currentOrg = await requireCurrentOrganization();
    
    const permissionApplicationService = getPermissionApplicationService();
    const result = await permissionApplicationService.initializeDefaultRoles(currentOrg.id.value);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to initialize default roles"
      };
    }

    revalidatePath('/organization/settings/roles');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error initializing default roles:", error);
    return {
      success: false,
      error: "Failed to initialize default roles",
    };
  }
}

/**
 * Add permission to role
 */
export async function addPermissionToRole(roleId: number, permission: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!roleId || !permission) {
      return {
        success: false,
        error: "Role ID and permission are required"
      };
    }

    const permissionApplicationService = getPermissionApplicationService();
    const result = await permissionApplicationService.addPermissionToRole(roleId, permission);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to add permission to role"
      };
    }

    revalidatePath('/organization/settings/roles');
    
    return {
      success: true,
      data: { message: "Permission added to role successfully" },
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error adding permission to role:", error);
    return {
      success: false,
      error: "Failed to add permission to role",
    };
  }
}

/**
 * Remove permission from role
 */
export async function removePermissionFromRole(roleId: number, permission: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!roleId || !permission) {
      return {
        success: false,
        error: "Role ID and permission are required"
      };
    }

    const permissionApplicationService = getPermissionApplicationService();
    const result = await permissionApplicationService.removePermissionFromRole(roleId, permission);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to remove permission from role"
      };
    }

    revalidatePath('/organization/settings/roles');
    
    return {
      success: true,
      data: { message: "Permission removed from role successfully" },
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error removing permission from role:", error);
    return {
      success: false,
      error: "Failed to remove permission from role",
    };
  }
}