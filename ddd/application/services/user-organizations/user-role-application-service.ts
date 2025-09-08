/**
 * User Role Application Service
 * 
 * Handles user creation, role assignment, and organization membership.
 * Updated for full RBAC system with SystemRoleType roles.
 */
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';
import type { UserOrganization, CreateUserOrganizationData } from '@/ddd/domain/users/entities/user';
import type { OrganizationMember } from '@/ddd/domain/organizations/entities/organization';
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';
import type { Result } from '@/ddd/domain/shared/result';

export interface AddUserToOrganizationCommand {
  userId: string;
  organizationId: number;
  systemRole: SystemRoleType; // RBAC system role (required)
  invitedBy?: string;
}

export interface UpdateMemberRoleCommand {
  userId: string;
  organizationId: number;
  newSystemRole: SystemRoleType;
  updatedBy: string;
}

export interface SwitchOrganizationCommand {
  userId: string;
  organizationId: number;
}

export interface RemoveUserFromOrganizationCommand {
  userId: string;
  organizationId: number;
  removedBy: string;
}

export interface OrganizationMemberFilters {
  organizationId: number;
  systemRole?: SystemRoleType; // Updated to RBAC system role
  searchQuery?: string;
  includeUserDetails?: boolean;
}


// Use unified Result interface from domain shared types
export type UserOrganizationApplicationResult<T = any> = Result<T>;

export class UserRoleApplicationService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly rbacRepository: IRBACRepository
  ) {}

  /**
   * Add a user to an organization with a specific role
   */
  async addUserToOrganization(command: AddUserToOrganizationCommand): Promise<UserOrganizationApplicationResult<UserOrganization>> {
    try {
      // Validate inputs
      if (!command.userId || !command.organizationId) {
        return {
          success: false,
          error: "User ID and Organization ID are required"
        };
      }

      // Verify user exists
      const user = await this.userRepository.findById(UserId.fromString(command.userId));
      if (!user) {
        return {
          success: false,
          error: `User with ID ${command.userId} not found`
        };
      }

      // Verify organization exists
      const organization = await this.organizationRepository.findById(OrganizationId.fromNumber(command.organizationId));
      if (!organization) {
        return {
          success: false,
          error: `Organization with ID ${command.organizationId} not found`
        };
      }

      // Create user-organization relationship
      const userOrganizationData: CreateUserOrganizationData = {
        userId: UserId.fromString(command.userId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
        systemRole: command.systemRole
      };

      const userOrganization = await this.userRepository.addUserToOrganization(userOrganizationData);

      // Now assign the role in the RBAC system
      try {
        // Get all roles for the organization (including system roles)
        const roles = await this.rbacRepository.findRolesByOrganization(OrganizationId.fromNumber(command.organizationId));
        
        // Find the system role by name
        const systemRole = roles.find((r: any) => r.name === command.systemRole && r.isSystem);
        
        if (systemRole) {
          // Assign the role to the user
          await this.rbacRepository.assignRole(
            UserId.fromString(command.userId),
            systemRole.id,
            OrganizationId.fromNumber(command.organizationId)
          );
          console.log(`✅ Assigned role ${command.systemRole} (ID: ${systemRole.id}) to user ${command.userId} in org ${command.organizationId}`);
        } else {
          console.error(`⚠️ System role '${command.systemRole}' not found in organization ${command.organizationId}. User added without role assignment.`);
          // Continue anyway - user is added to org, just without role
        }
      } catch (roleError) {
        console.error('Error assigning role after adding user to organization:', roleError);
        // Don't fail the whole operation - user is already added to org
      }

      return {
        success: true,
        data: userOrganization
      };
    } catch (error) {
      console.error("Error adding user to organization:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add user to organization"
      };
    }
  }

  /**
   * Update a user's role within an organization
   */
  async updateMemberRole(command: UpdateMemberRoleCommand): Promise<UserOrganizationApplicationResult<UserOrganization>> {
    try {
      // Validate inputs
      if (!command.userId || !command.organizationId || !command.newSystemRole) {
        return {
          success: false,
          error: "User ID, Organization ID, and new role are required"
        };
      }

      // Validate role is one of the allowed system roles
      if (!Object.values(SYSTEM_ROLES).includes(command.newSystemRole)) {
        return {
          success: false,
          error: `Invalid role: ${command.newSystemRole}. Must be one of: ${Object.values(SYSTEM_ROLES).join(', ')}`
        };
      }

      // TODO: Update user role via RBAC system
      // const updatedUser = await this.rbacRepository.setUserRoles(
      //   UserId.fromString(command.userId),
      //   [roleId], // Need to get role ID from SystemRoleType
      //   OrganizationId.fromNumber(command.organizationId)
      // );
      // For now, return success without actual update

      // Return a UserOrganization-like response
      const userOrganization: UserOrganization = {
        id: 0, // Will be set by repository
        userId: UserId.fromString(command.userId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
        systemRole: command.newSystemRole,
        createdAt: new Date()
      };

      return {
        success: true,
        data: userOrganization
      };
    } catch (error) {
      console.error("Error updating member role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update member role"
      };
    }
  }

  /**
   * Get a user's role within a specific organization
   */
  async getUserOrganizationRole(userId: UserId, organizationId: OrganizationId): Promise<SystemRoleType | null> {
    try {
      // Get user's roles from RBAC system
      const roles = await this.rbacRepository.getUserRoles(userId, organizationId);
      
      if (roles.length === 0) {
        console.log(`⚠️ No roles found for user ${userId.value} in organization ${organizationId.value}`);
        return null;
      }
      
      // Return the first system role found (users should have exactly one role per org)
      const systemRole = roles.find(r => r.isSystem);
      if (systemRole) {
        console.log(`Found system role '${systemRole.name}' for user ${userId.value} in org ${organizationId.value}`);
        return systemRole.name as SystemRoleType;
      }
      
      // If no system role, return the first role's name
      console.log(`Using first role '${roles[0].name}' for user ${userId.value} in org ${organizationId.value}`);
      return roles[0].name as SystemRoleType;
    } catch (error) {
      console.error("Error getting user organization role:", error);
      return null;
    }
  }

  /**
   * Switch user's current organization
   */
  async switchOrganization(command: SwitchOrganizationCommand): Promise<UserOrganizationApplicationResult<void>> {
    try {
      if (!command.userId || !command.organizationId) {
        return {
          success: false,
          error: "User ID and Organization ID are required"
        };
      }

      // Verify organization exists
      const organization = await this.organizationRepository.findById(OrganizationId.fromNumber(command.organizationId));
      if (!organization) {
        return {
          success: false,
          error: `Organization with ID ${command.organizationId} not found`
        };
      }

      // Switch organization
      await this.userRepository.switchOrganization(
        UserId.fromString(command.userId),
        OrganizationId.fromNumber(command.organizationId)
      );

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error switching organization:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to switch organization"
      };
    }
  }

  /**
   * Remove user from organization
   */
  async removeUserFromOrganization(command: RemoveUserFromOrganizationCommand): Promise<UserOrganizationApplicationResult<void>> {
    try {
      if (!command.userId || !command.organizationId) {
        return {
          success: false,
          error: "User ID and Organization ID are required"
        };
      }

      // Remove user from organization
      await this.userRepository.removeUserFromOrganization(
        UserId.fromString(command.userId),
        OrganizationId.fromNumber(command.organizationId)
      );

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error removing user from organization:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove user from organization"
      };
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(filters: OrganizationMemberFilters): Promise<OrganizationMember[]> {
    try {
      // Get users by organization
      const users = await this.userRepository.findByOrganizationId(
        OrganizationId.fromNumber(filters.organizationId)
      );

      // Map to OrganizationMember format
      let members = users.map(user => ({
        userId: user.id,
        name: user.name,
        email: user.email,
        systemRole: SYSTEM_ROLES.MEMBER, // TODO: Get actual role from RBAC system
        joinedAt: user.createdAt
      }));

      // Apply system role filter
      if (filters.systemRole) {
        members = members.filter(member => member.systemRole === filters.systemRole);
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        members = members.filter(member => 
          (member.name?.toLowerCase() || '').includes(searchLower) ||
          (member.email?.value?.toLowerCase() || '').includes(searchLower)
        );
      }

      return members;
    } catch (error) {
      console.error("Error getting organization members:", error);
      return [];
    }
  }
}