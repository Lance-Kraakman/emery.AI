'use server'

// AIDEV-NOTE: Server Actions for user-organization management using UserOrganizationApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "./permissions";
import { getUserRoleApplicationService, getUserRepository, getOrganizationRepository } from "@/ddd/application/di/container";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result } from "./types";
import { UserId, OrganizationId } from "@/ddd/domain/shared/value-objects";
import { SystemRoleType, SYSTEM_ROLES, SYSTEM_ROLE_IDS } from "@/ddd/domain/rbac/entities/role";
import { contextManager } from '@/lib/db/context-manager';
import { OrganizationMapper, type OrganizationDTO } from "@/app/mappers/organization-mapper";

// Helper to map Role entities to simplified format for OrganizationDTO.userRoles
function mapRoleToSimpleFormat(role: any): {id: number; name: string; isSystem: boolean} {
  return {
    id: role.id,
    name: role.name,
    isSystem: role.isSystem
  };
}

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required
import type { 
  AddUserToOrganizationCommand,
  UpdateMemberRolesCommand,
  SwitchOrganizationCommand,
  RemoveUserFromOrganizationCommand,
  OrganizationMemberFilters
} from "@/ddd/application/services/user-organizations/user-role-application-service";

export async function switchCurrentOrganization(organizationId: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
    
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required"
      };
    }

    const userOrganizationApplicationService = getUserRoleApplicationService();
    
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
  });
}

export async function joinOrganization(organizationId: number, roleIds: number[] = []): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
    
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required"
      };
    }

    const userOrganizationApplicationService = getUserRoleApplicationService();
    
    const command: AddUserToOrganizationCommand = {
      userId: session.user.id,
      organizationId,
      roleIds: roleIds.length > 0 ? roleIds : [SYSTEM_ROLE_IDS.MEMBER]
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
  });
}

export async function leaveOrganization(organizationId: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
    
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID is required"
      };
    }

    const userOrganizationApplicationService = getUserRoleApplicationService();
    
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
  });
}

export async function getUserOrganizations() {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:view");
      
    const userRepository = getUserRepository();
    const organizations = await userRepository.getUserOrganizations(UserId.fromString(session.user.id));

    // Map to expected format and fetch actual roles
    const userRoleApplicationService = getUserRoleApplicationService();
    const organizationsWithRoles = await Promise.all(
      organizations.map(async (org) => {
        const userRoles = await userRoleApplicationService.getUserOrganizationRoles(
          UserId.fromString(session.user.id),
          org.id
        );
        
        if (!userRoles || userRoles.length === 0) {
          console.error(`⚠️ No roles found for user ${session.user.id} in organization ${org.id.value}. This indicates a data integrity issue.`);
        }
        
        return {
          ...org,
          userRoles: Array.isArray(userRoles) ? userRoles.map(mapRoleToSimpleFormat) : [], // Multi-role array as simple format
          isCurrentOrganization: org.id.value === session.user.currentOrganizationId,
          joinedAt: org.createdAt,
          hasRoleError: !userRoles || userRoles.length === 0 // Flag to indicate role loading error
        };
      })
    );
    
    return organizationsWithRoles;
    } catch (error) {
      console.error("Error fetching user organizations:", error);
      throw new Error("Failed to fetch organizations");
    }
  });
}

export async function getCurrentOrganization(): Promise<OrganizationDTO | null> {
  try {
    // FIXED: Cannot use requirePermission here as it causes circular dependency with requireCurrentOrganization
    const session = await requireAuth();
  
  if (!session.user.currentOrganizationId) {
    return null;
  }

  const organizationRepository = getOrganizationRepository();
  const userRoleApplicationService = getUserRoleApplicationService();
  
  const organization = await organizationRepository.findById(OrganizationId.fromNumber(session.user.currentOrganizationId));
  
  if (!organization) {
    return null;
  }

  // Get the user's roles in this organization
  const userRoles = await userRoleApplicationService.getUserOrganizationRoles(
    UserId.fromString(session.user.id), 
    OrganizationId.fromNumber(session.user.currentOrganizationId)
  );
  
  // AIDEV-NOTE: Role lookup for organization context
  
  if (!userRoles || userRoles.length === 0) {
    console.error(`⚠️ No roles found for user ${session.user.id} in current organization ${session.user.currentOrganizationId}. This indicates a data integrity issue.`);
  }

  // Convert to DTO to avoid serialization issues with Value Objects
  return OrganizationMapper.toDTO({
    ...organization,
    userRoles: Array.isArray(userRoles) ? userRoles.map(mapRoleToSimpleFormat) : [],
    hasRoleError: !userRoles || userRoles.length === 0 // Flag to indicate role loading error
  });
  } catch (error) {
    console.error("Error fetching current organization:", error);
    return null;
  }
}

// AIDEV-NOTE: Helper function to check if user has access to current organization context
export async function requireCurrentOrganization() {
  const session = await requireAuth();
  
  // Set RLS context for subsequent database operations
  if (session.user.id && session.user.currentOrganizationId) {
    contextManager.setContext(
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      UserId.fromString(session.user.id)
    );
  }
  
  const org = await getCurrentOrganization();
  if (!org) {
    throw new Error("No current organization selected");
  }
  return org;
}

/**
 * Add another user to an organization (admin function)
 */
export async function addUserToOrganization(userId: string, organizationId: number, systemRole: SystemRoleType = 'Member'): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
    
    if (!userId || !organizationId) {
      return {
        success: false,
        error: "User ID and Organization ID are required"
      };
    }

    const userOrganizationApplicationService = getUserRoleApplicationService();
    
    const command: AddUserToOrganizationCommand = {
      userId,
      organizationId,
      roleIds: [SYSTEM_ROLE_IDS.MEMBER],
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
  });
}

/**
 * Remove another user from organization (admin function)
 */
export async function removeUserFromOrganization(userId: string, organizationId: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
    
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

    const userOrganizationApplicationService = getUserRoleApplicationService();
    
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
  });
}

/**
 * Get organization members (admin function)
 */
export async function getOrganizationMembers(organizationId?: number, searchQuery?: string, systemRole?: SystemRoleType) {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:view");
    const currentOrg = await requireCurrentOrganization();
    
    const userOrganizationApplicationService = getUserRoleApplicationService();
    
    const filters: OrganizationMemberFilters = {
      organizationId: organizationId || currentOrg.id,
      searchQuery,
      systemRole,
      includeUserDetails: true
    };

    const members = await userOrganizationApplicationService.getOrganizationMembers(filters);
    return members.map(OrganizationMapper.memberToDTO);
    } catch (error) {
      console.error("Error fetching organization members:", error);
      throw new Error("Failed to fetch organization members");
    }
  });
}

/**
 * Update user role in organization (admin function)
 */
export async function updateUserRole(userId: string, organizationId: number, roleIds: number[]): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");

      if (!userId || !organizationId || !roleIds) {
        return {
          success: false,
          error: "User ID, organization ID, and role IDs are required"
        };
      }

      const userOrganizationApplicationService = getUserRoleApplicationService();
      
      const command: UpdateMemberRolesCommand = {
        userId,
        organizationId,
        roleIds,
        updatedBy: session.user.id
      };

      const result = await userOrganizationApplicationService.updateMemberRoles(command);

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
  });
}

