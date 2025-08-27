'use server'

// AIDEV-NOTE: Server Actions for user-organization management using UserOrganizationApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { getUserOrganizationApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required
import type { 
  AddUserToOrganizationCommand, 
  SwitchOrganizationCommand,
  RemoveUserFromOrganizationCommand,
  OrganizationMemberFilters,
  UserMembershipsFilters 
} from "@/ddd/application/services/user-organizations/user-organization-application-service";

export async function switchCurrentOrganization(organizationId: number): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required"
      };
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const command: SwitchOrganizationCommand = {
      userId: session.user.id,
      organizationId
    };

    const result = await userOrganizationApplicationService.switchOrganization(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to switch organization"
      };
    }

    // Revalidate to refresh session data
    revalidatePath('/');
    
    return {
      success: true,
      data: { organizationId },
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error switching organization:", error);
    return {
      success: false,
      error: "Failed to switch organization",
    };
  }
}

export async function joinOrganization(organizationId: number, role: string = 'member'): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required"
      };
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const command: AddUserToOrganizationCommand = {
      userId: session.user.id,
      organizationId,
      role
    };

    const result = await userOrganizationApplicationService.addUserToOrganization(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to join organization"
      };
    }

    revalidatePath('/');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error joining organization:", error);
    return {
      success: false,
      error: "Failed to join organization",
    };
  }
}

export async function leaveOrganization(organizationId: number): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required"
      };
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const command: RemoveUserFromOrganizationCommand = {
      userId: session.user.id,
      organizationId,
      removedBy: session.user.id // User is removing themselves
    };

    const result = await userOrganizationApplicationService.removeUserFromOrganization(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to leave organization"
      };
    }

    revalidatePath('/');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Left organization successfully" },
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error leaving organization:", error);
    return {
      success: false,
      error: "Failed to leave organization",
    };
  }
}

export async function getUserOrganizations() {
  try {
    const session = await requirePermission("view_users");
    
    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const filters: UserMembershipsFilters = {
      userId: session.user.id,
      includeOrganizationDetails: true,
      activeOnly: true
    };

    const memberships = await userOrganizationApplicationService.getUserMemberships(filters);

    // Map to expected format for backwards compatibility
    return memberships.map(membership => ({
      ...membership.organization,
      userRole: membership.userOrganization.role,
      isCurrentOrganization: membership.isCurrentOrganization,
      joinedAt: membership.organization?.createdAt
    }));
  } catch (error) {
    console.error("Error fetching user organizations:", error);
    throw new Error("Failed to fetch organizations");
  }
}

export async function getCurrentOrganization() {
  try {
    const session = await requirePermission("view_users");
    
    if (!session.user.currentOrganizationId) {
      return null;
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const filters: UserMembershipsFilters = {
      userId: session.user.id,
      includeOrganizationDetails: true,
      activeOnly: true
    };

    const memberships = await userOrganizationApplicationService.getUserMemberships(filters);
    const currentMembership = memberships.find(m => m.isCurrentOrganization);

    if (!currentMembership || !currentMembership.organization) {
      return null;
    }

    return {
      ...currentMembership.organization,
      userRole: currentMembership.userOrganization.role
    };
  } catch (error) {
    console.error("Error fetching current organization:", error);
    return null;
  }
}

// AIDEV-NOTE: Helper function to check if user has access to current organization context
export async function requireCurrentOrganization() {
  const org = await getCurrentOrganization();
  if (!org) {
    throw new Error("No current organization selected");
  }
  return org;
}

/**
 * Add another user to an organization (admin function)
 */
export async function addUserToOrganization(userId: string, organizationId: number, role: string = 'member'): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!userId || !organizationId) {
      return {
        success: false,
        error: "User ID and Organization ID are required"
      };
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const command: AddUserToOrganizationCommand = {
      userId,
      organizationId,
      role,
      invitedBy: session.user.id
    };

    const result = await userOrganizationApplicationService.addUserToOrganization(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to add user to organization"
      };
    }

    revalidatePath('/organization/settings/users');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error adding user to organization:", error);
    return {
      success: false,
      error: "Failed to add user to organization",
    };
  }
}

/**
 * Remove another user from organization (admin function)
 */
export async function removeUserFromOrganization(userId: string, organizationId: number): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!userId || !organizationId) {
      return {
        success: false,
        error: "User ID and Organization ID are required"
      };
    }

    // Don't allow removing yourself via this function
    if (userId === session.user.id) {
      return {
        success: false,
        error: "Use leaveOrganization to remove yourself from an organization"
      };
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const command: RemoveUserFromOrganizationCommand = {
      userId,
      organizationId,
      removedBy: session.user.id
    };

    const result = await userOrganizationApplicationService.removeUserFromOrganization(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to remove user from organization"
      };
    }

    revalidatePath('/organization/settings/users');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "User removed from organization successfully" },
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error removing user from organization:", error);
    return {
      success: false,
      error: "Failed to remove user from organization",
    };
  }
}

/**
 * Get organization members (admin function)
 */
export async function getOrganizationMembers(organizationId?: number, searchQuery?: string, role?: string) {
  try {
    const session = await requirePermission("view_users");
    const currentOrg = await requireCurrentOrganization();
    
    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const filters: OrganizationMemberFilters = {
      organizationId: organizationId || currentOrg.id.value,
      searchQuery,
      role,
      includeUserDetails: true
    };

    return await userOrganizationApplicationService.getOrganizationMembers(filters);
  } catch (error) {
    console.error("Error fetching organization members:", error);
    throw new Error("Failed to fetch organization members");
  }
}

/**
 * Update user role in organization (admin function)
 */
export async function updateUserRole(userId: string, organizationId: number, newRole: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_users");
    
    if (!userId || !organizationId || !newRole) {
      return {
        success: false,
        error: "User ID, Organization ID, and new role are required"
      };
    }

    const userOrganizationApplicationService = getUserOrganizationApplicationService();
    
    const command = {
      userId,
      organizationId,
      newRole,
      updatedBy: session.user.id
    };

    const result = await userOrganizationApplicationService.updateMemberRole(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update user role"
      };
    }

    revalidatePath('/organization/settings/users');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error updating user role:", error);
    return {
      success: false,
      error: "Failed to update user role",
    };
  }
}

