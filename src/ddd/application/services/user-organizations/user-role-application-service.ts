/**
 * User Role Application Service
 *
 * Handles user creation, role assignment, and organization membership.
 * Updated for full RBAC system with SystemRoleType roles.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';

const logger = createDebugLogger('UserRoleService');
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';
import type { UserOrganization, CreateUserOrganizationData } from '@/ddd/domain/users/entities/user';
import type { OrganizationMember } from '@/ddd/domain/organizations/entities/organization';
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType, SYSTEM_ROLES, SYSTEM_ROLE_IDS } from '@/ddd/domain/rbac/entities/role';
import type { Result } from '@/ddd/domain/shared/result';
import { RoleDTO } from '@/app/mappers/permission-mapper';

export interface AddUserToOrganizationCommand {
  userId: string;
  organizationId: number;
  roleIds: number[]; // Array of role IDs for multi-role assignment
  invitedBy?: string;
}

export interface UpdateMemberRolesCommand {
  userId: string;
  organizationId: number;
  roleIds: number[];
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
  systemRole?: SystemRoleType; // Optional filter for specific role name (works with multiple roles)
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
   * Add a user to an organization with specific roles
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

      // Validate all roles exist and belong to organization or are system roles
      const orgRoles = await this.rbacRepository.findRolesByOrganization(OrganizationId.fromNumber(command.organizationId));
      const systemRoles = await this.rbacRepository.getSystemRoles();
      const validRoleIds = [...orgRoles, ...systemRoles].map((r: any) => r.id);

      for (const roleId of command.roleIds) {
        if (!validRoleIds.includes(roleId)) {
          return {
            success: false,
            error: `Role ID ${roleId} is not valid for this organization`
          };
        }
      }



      // Create user-organization relationship
      const userOrganizationData: CreateUserOrganizationData = {
        userId: UserId.fromString(command.userId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
      };

      const userOrganization = await this.userRepository.addUserToOrganization(userOrganizationData);

      // Assign all specified roles in the RBAC system
      try {
        for (const roleId of command.roleIds) {
          await this.rbacRepository.assignRole(
            UserId.fromString(command.userId),
            roleId,
            OrganizationId.fromNumber(command.organizationId)
          );
        }
        console.log(`✅ Assigned ${command.roleIds.length} roles to user ${command.userId} in org ${command.organizationId}`);
      } catch (roleError) {
        console.error('Error assigning roles after adding user to organization:', roleError);
        return {
          success: false,
          error: "Failed to assign roles to user"
        };
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
   * Update a user's multiple roles within an organization
   */
  async updateMemberRoles(command: UpdateMemberRolesCommand): Promise<UserOrganizationApplicationResult<UserOrganization>> {
    try {
      logger.debug('updateMemberRoles called', { command });

      // Validate inputs
      if (!command.userId || !command.organizationId) {
        logger.debug('updateMemberRoles: Missing userId or organizationId');
        return {
          success: false,
          error: "User ID and Organization ID are required"
        };
      }

      // Validate all roles exist and belong to organization or are system roles
      const orgRoles = await this.rbacRepository.findRolesByOrganization(OrganizationId.fromNumber(command.organizationId));
      const systemRoles = await this.rbacRepository.getSystemRoles();
      const validRoleIds = [...orgRoles, ...systemRoles].map((r: any) => r.id);
      logger.debug('updateMemberRoles: Valid role IDs for org', { validRoleIds, requestedRoleIds: command.roleIds });

      for (const roleId of command.roleIds) {
        if (!validRoleIds.includes(roleId)) {
          logger.debug('updateMemberRoles: Invalid role ID', { roleId, validRoleIds });
          return {
            success: false,
            error: `Role ID ${roleId} is not valid for this organization`
          };
        }
      }

      // Business rule: Organization must always have at least one Owner
      const organizationId = OrganizationId.fromNumber(command.organizationId);
      const currentRoles = await this.rbacRepository.getUserRoles(
        UserId.fromString(command.userId),
        organizationId
      );
      const currentRoleIds = currentRoles.map(r => r.id);
      const isRemovingOwner = currentRoleIds.includes(SYSTEM_ROLE_IDS.ORGANIZATION_OWNER) &&
                              !command.roleIds.includes(SYSTEM_ROLE_IDS.ORGANIZATION_OWNER);

      if (isRemovingOwner) {
        const ownerCount = await this.rbacRepository.countUsersWithRole(
          SYSTEM_ROLE_IDS.ORGANIZATION_OWNER,
          organizationId
        );

        if (ownerCount <= 1) {
          logger.debug('updateMemberRoles: Cannot remove last Organization Owner');
          return {
            success: false,
            error: "Cannot remove the Organization Owner role. At least one member must have this role. Please assign another member as Owner first."
          };
        }
      }

      logger.debug('updateMemberRoles: Calling setUserRoles', {
        userId: command.userId,
        roleIds: command.roleIds,
        organizationId: command.organizationId
      });

      // Set user roles (replaces existing roles)
      await this.rbacRepository.setUserRoles(
        UserId.fromString(command.userId),
        command.roleIds,
        OrganizationId.fromNumber(command.organizationId)
      );

      logger.debug('updateMemberRoles: setUserRoles completed successfully');

      // Return a UserOrganization-like response
      const userOrganization: UserOrganization = {
        id: 0, // Will be set by repository
        userId: UserId.fromString(command.userId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
        systemRole: SYSTEM_ROLES.MEMBER, // Placeholder for display purposes - actual roles stored in user_roles
        createdAt: new Date()
      };

      return {
        success: true,
        data: userOrganization
      };
    } catch (error) {
      logger.error("Error updating member roles:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update member roles"
      };
    }
  }

  /**
   * Get a user's multiple roles within a specific organization
   */
  async getUserOrganizationRoles(userId: UserId, organizationId: OrganizationId): Promise<RoleDTO[]> {
    try {
      const roles = await this.rbacRepository.getUserRolesDTO(userId, organizationId);
      return roles;
    } catch (error) {
      console.error("Error getting user organization roles:", error);
      return [];
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

      // Map to OrganizationMember format and fetch actual roles from RBAC
      const organizationId = OrganizationId.fromNumber(filters.organizationId);
      
      let members = await Promise.all(
        users.map(async (user) => {
          // Get the user's actual roles from RBAC system
          const userRoles = await this.getUserOrganizationRoles(user.id, organizationId);
          
          if (!userRoles.length) {
            console.error(`⚠️ No roles found for user ${user.id.value} in organization ${organizationId.value}. This indicates a data integrity issue.`);
          }
          
          return {
            userId: user.id,
            name: user.name,
            email: user.email,
            joinedAt: user.createdAt,
            roles: userRoles.map(role => ({
              id: role.id,
              name: role.name,
              isSystem: role.isSystem
            }))
          };
        })
      );

      // Apply role filter (works with multiple roles)
      if (filters.systemRole) {
        members = members.filter(member => 
          member.roles.some(role => role.name === filters.systemRole)
        );
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