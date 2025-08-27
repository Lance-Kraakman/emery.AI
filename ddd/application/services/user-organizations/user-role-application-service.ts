/**
 * User Role Application Service
 * 
 * Handles user creation, role assignment, and organization membership.
 * Simplified service for 3-role RBAC system (owner/admin/member).
 */
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { UserOrganization, CreateUserOrganizationData } from '@/ddd/domain/users/entities/user';
import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import type { User } from '@/ddd/domain/users/entities/user';
import { UserId, OrganizationId, OrganizationRole } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';

export interface AddUserToOrganizationCommand {
  userId: string;
  organizationId: number;
  role?: string; // defaults to 'member'
  invitedBy?: string;
}

export interface UpdateMemberRoleCommand {
  userId: string;
  organizationId: number;
  newRole: string;
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
  role?: string;
  searchQuery?: string;
  includeUserDetails?: boolean;
}

export interface OrganizationMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
}

// Use unified Result interface from domain shared types
export type UserOrganizationApplicationResult<T = any> = Result<T>;

export class UserRoleApplicationService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly organizationRepository: IOrganizationRepository
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
        role: OrganizationRole.fromString(command.role || 'member')
      };

      const userOrganization = await this.userRepository.addUserToOrganization(userOrganizationData);

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
      if (!command.userId || !command.organizationId || !command.newRole) {
        return {
          success: false,
          error: "User ID, Organization ID, and new role are required"
        };
      }

      // Validate role is one of the allowed roles
      const validRoles = ['owner', 'admin', 'member'];
      if (!validRoles.includes(command.newRole)) {
        return {
          success: false,
          error: `Invalid role: ${command.newRole}. Must be one of: ${validRoles.join(', ')}`
        };
      }

      // Update the user's organization role
      const updatedUser = await this.userRepository.updateUserRole(
        UserId.fromString(command.userId), 
        command.newRole
      );

      // Return a UserOrganization-like response
      const userOrganization: UserOrganization = {
        id: 0, // Will be set by repository
        userId: UserId.fromString(command.userId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
        role: OrganizationRole.fromString(command.newRole),
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
  async getUserOrganizationRole(userId: UserId, organizationId: OrganizationId): Promise<string | null> {
    try {
      return await this.userRepository.getUserOrganizationRole(userId, organizationId);
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
        userId: user.id.value,
        name: user.name || 'Unknown',
        email: user.email?.value || '',
        role: user.organizationRole || 'member',
        joinedAt: user.createdAt || new Date()
      }));

      // Apply role filter
      if (filters.role) {
        members = members.filter(member => member.role === filters.role);
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        members = members.filter(member => 
          member.name.toLowerCase().includes(searchLower) ||
          member.email.toLowerCase().includes(searchLower)
        );
      }

      return members;
    } catch (error) {
      console.error("Error getting organization members:", error);
      return [];
    }
  }
}