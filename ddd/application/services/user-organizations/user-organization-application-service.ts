/**
 * User Organization Application Service
 * 
 * Orchestrates user-organization membership operations.
 * Handles business logic for membership management, role assignment, and organization switching.
 */

import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
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

export interface RemoveUserFromOrganizationCommand {
  userId: string;
  organizationId: number;
  removedBy: string;
}

export interface SwitchOrganizationCommand {
  userId: string;
  organizationId: number;
}

export interface OrganizationMemberFilters {
  organizationId: number;
  role?: string;
  searchQuery?: string;
  includeUserDetails?: boolean;
}

export interface UserMembershipsFilters {
  userId: string;
  includeOrganizationDetails?: boolean;
  activeOnly?: boolean;
}

// Use unified Result interface from domain shared types
export type UserOrganizationApplicationResult<T = any> = Result<T>;

export interface OrganizationMember {
  userOrganization: UserOrganization;
  user?: User;
  organization?: Organization;
}

export interface UserMembership {
  userOrganization: UserOrganization;
  organization?: Organization;
  isCurrentOrganization: boolean;
}

export class UserOrganizationApplicationService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly roleRepository: IRoleRepository
  ) {}

  /**
   * Add a user to an organization with business validation
   */
  async addUserToOrganization(command: AddUserToOrganizationCommand): Promise<UserOrganizationApplicationResult<UserOrganization>> {
    try {
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

      // Check if user is already a member
      const existingRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));
      if (existingRole) {
        return {
          success: false,
          error: `User is already a member of this organization with role: ${existingRole}`
        };
      }

      // Validate role if provided
      const role = command.role || 'member';
      const validRoles = ['owner', 'admin', 'member'];
      if (!validRoles.includes(role)) {
        return {
          success: false,
          error: `Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`
        };
      }

      // Add user to organization
      const membershipData: CreateUserOrganizationData = {
        userId: UserId.fromString(command.userId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
        role: OrganizationRole.fromString(role)
      };

      const userOrganization = await this.userRepository.addUserToOrganization(membershipData);

      // If this is the user's first organization, set it as current
      const userOrganizations = await this.userRepository.getUserOrganizations(UserId.fromString(command.userId));
      if (userOrganizations.length === 1) {
        await this.userRepository.switchOrganization(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));
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
   * Update a member's role in an organization
   */
  async updateMemberRole(command: UpdateMemberRoleCommand): Promise<UserOrganizationApplicationResult<UserOrganization>> {
    try {
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

      // Check if user is a member
      const currentRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));
      if (!currentRole) {
        return {
          success: false,
          error: "User is not a member of this organization"
        };
      }

      // Validate new role
      const validRoles = ['owner', 'admin', 'member'];
      if (!validRoles.includes(command.newRole)) {
        return {
          success: false,
          error: `Invalid role: ${command.newRole}. Valid roles are: ${validRoles.join(', ')}`
        };
      }

      // Prevent demoting the last owner
      if (currentRole?.value === 'owner' && command.newRole !== 'owner') {
        const organizationMembers = await this.userRepository.findByOrganizationId(OrganizationId.fromNumber(command.organizationId));
        let ownerCount = 0;
        for (const member of organizationMembers) {
          const memberRole = await this.userRepository.getUserOrganizationRole(member.id, OrganizationId.fromNumber(command.organizationId));
          if (memberRole?.value === 'owner') {
            ownerCount++;
          }
        }

        if (ownerCount <= 1) {
          return {
            success: false,
            error: "Cannot demote the last owner of the organization"
          };
        }
      }

      // Update role
      const updatedUserOrganization = await this.userRepository.updateUserOrganizationRole(
        UserId.fromString(command.userId),
        OrganizationId.fromNumber(command.organizationId),
        OrganizationRole.fromString(command.newRole)
      );

      return {
        success: true,
        data: updatedUserOrganization
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
   * Remove a user from an organization
   */
  async removeUserFromOrganization(command: RemoveUserFromOrganizationCommand): Promise<UserOrganizationApplicationResult<void>> {
    try {
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

      // Check if user is a member
      const currentRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));
      if (!currentRole) {
        return {
          success: false,
          error: "User is not a member of this organization"
        };
      }

      // Prevent removing the last owner
      if (currentRole?.value === 'owner') {
        const organizationMembers = await this.userRepository.findByOrganizationId(OrganizationId.fromNumber(command.organizationId));
        let ownerCount = 0;
        for (const member of organizationMembers) {
          const memberRole = await this.userRepository.getUserOrganizationRole(member.id, OrganizationId.fromNumber(command.organizationId));
          if (memberRole?.value === 'owner') {
            ownerCount++;
          }
        }

        if (ownerCount <= 1) {
          return {
            success: false,
            error: "Cannot remove the last owner of the organization"
          };
        }
      }

      // Remove user from organization
      await this.userRepository.removeUserFromOrganization(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));

      // If this was the user's current organization, switch to another one
      if (user.currentOrganizationId?.value === command.organizationId) {
        const remainingOrganizations = await this.userRepository.getUserOrganizations(UserId.fromString(command.userId));
        if (remainingOrganizations.length > 0) {
          await this.userRepository.switchOrganization(UserId.fromString(command.userId), remainingOrganizations[0].id);
        } else {
          // User has no organizations left, clear current organization
          await this.userRepository.update(UserId.fromString(command.userId), { currentOrganizationId: null });
        }
      }

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
   * Switch user's current organization
   */
  async switchOrganization(command: SwitchOrganizationCommand): Promise<UserOrganizationApplicationResult<void>> {
    try {
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

      // Check if user is a member of the organization
      const userRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));
      if (!userRole) {
        return {
          success: false,
          error: "User is not a member of this organization"
        };
      }

      // Switch to the organization
      await this.userRepository.switchOrganization(UserId.fromString(command.userId), OrganizationId.fromNumber(command.organizationId));

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
   * Get organization members with filtering
   */
  async getOrganizationMembers(filters: OrganizationMemberFilters): Promise<OrganizationMember[]> {
    try {
      let members = await this.userRepository.findByOrganizationId(OrganizationId.fromNumber(filters.organizationId));

      // Apply role filter
      if (filters.role) {
        const filteredMembers = [];
        for (const member of members) {
          const memberRole = await this.userRepository.getUserOrganizationRole(member.id, OrganizationId.fromNumber(filters.organizationId));
          if (memberRole?.value === filters.role) {
            filteredMembers.push(member);
          }
        }
        members = filteredMembers;
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        members = members.filter(member => 
          member.name?.toLowerCase().includes(searchLower) ||
          member.email?.value.toLowerCase().includes(searchLower) ||
          member.jobTitle?.toLowerCase().includes(searchLower)
        );
      }

      // Build result with organization details
      const result: OrganizationMember[] = [];
      for (const user of members) {
        const userRole = await this.userRepository.getUserOrganizationRole(user.id, OrganizationId.fromNumber(filters.organizationId));
        if (userRole) {
          const userOrganization: UserOrganization = {
            id: 0, // This would come from actual user_organizations table
            userId: user.id,
            organizationId: OrganizationId.fromNumber(filters.organizationId),
            role: userRole
          };

          const member: OrganizationMember = {
            userOrganization,
            user: filters.includeUserDetails ? user : undefined
          };

          result.push(member);
        }
      }

      // Sort by role hierarchy (owner > admin > member) then by name
      result.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        const aOrder = roleOrder[a.userOrganization.role.value as keyof typeof roleOrder] ?? 99;
        const bOrder = roleOrder[b.userOrganization.role.value as keyof typeof roleOrder] ?? 99;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        const aName = a.user?.name || '';
        const bName = b.user?.name || '';
        return aName.localeCompare(bName);
      });

      return result;
    } catch (error) {
      console.error("Error fetching organization members:", error);
      throw new Error("Failed to fetch organization members");
    }
  }

  /**
   * Get user's organization memberships
   */
  async getUserMemberships(filters: UserMembershipsFilters): Promise<UserMembership[]> {
    try {
      const user = await this.userRepository.findById(UserId.fromString(filters.userId));
      if (!user) {
        throw new Error(`User with ID ${filters.userId} not found`);
      }

      const organizations = await this.userRepository.getUserOrganizations(UserId.fromString(filters.userId));
      
      const result: UserMembership[] = [];
      for (const organization of organizations) {
        const userRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(filters.userId), organization.id);
        if (userRole) {
          const userOrganization: UserOrganization = {
            id: 0, // This would come from actual user_organizations table
            userId: UserId.fromString(filters.userId),
            organizationId: organization.id,
            role: userRole
          };

          const membership: UserMembership = {
            userOrganization,
            organization: filters.includeOrganizationDetails ? organization : undefined,
            isCurrentOrganization: user.currentOrganizationId?.equals(organization.id) ?? false
          };

          result.push(membership);
        }
      }

      // Sort by current organization first, then by role hierarchy, then by organization name
      result.sort((a, b) => {
        if (a.isCurrentOrganization !== b.isCurrentOrganization) {
          return a.isCurrentOrganization ? -1 : 1;
        }
        
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        const aOrder = roleOrder[a.userOrganization.role.value as keyof typeof roleOrder] ?? 99;
        const bOrder = roleOrder[b.userOrganization.role.value as keyof typeof roleOrder] ?? 99;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        
        const aName = a.organization?.name?.value || '';
        const bName = b.organization?.name?.value || '';
        return aName.localeCompare(bName);
      });

      return result;
    } catch (error) {
      console.error("Error fetching user memberships:", error);
      throw new Error("Failed to fetch user memberships");
    }
  }

  /**
   * Get user's role in a specific organization
   */
  async getUserOrganizationRole(userId: string, organizationId: number): Promise<string | null> {
    try {
      const role = await this.userRepository.getUserOrganizationRole(UserId.fromString(userId), OrganizationId.fromNumber(organizationId));
      return role?.value || null;
    } catch (error) {
      console.error("Error getting user organization role:", error);
      return null;
    }
  }

  /**
   * Check if user can manage members in an organization
   */
  async canManageMembers(userId: string, organizationId: number): Promise<boolean> {
    try {
      const userRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(userId), OrganizationId.fromNumber(organizationId));
      return userRole?.value === 'owner' || userRole?.value === 'admin';
    } catch (error) {
      console.error("Error checking member management permission:", error);
      return false;
    }
  }

  /**
   * Check if user is owner of an organization
   */
  async isOrganizationOwner(userId: string, organizationId: number): Promise<boolean> {
    try {
      const userRole = await this.userRepository.getUserOrganizationRole(UserId.fromString(userId), OrganizationId.fromNumber(organizationId));
      return userRole?.value === 'owner';
    } catch (error) {
      console.error("Error checking organization ownership:", error);
      return false;
    }
  }

  /**
   * Get organization member count by role
   */
  async getOrganizationMemberStats(organizationId: number): Promise<{
    totalMembers: number;
    ownerCount: number;
    adminCount: number;
    memberCount: number;
  }> {
    try {
      const members = await this.userRepository.findByOrganizationId(OrganizationId.fromNumber(organizationId));
      
      let ownerCount = 0;
      let adminCount = 0;
      let memberCount = 0;

      for (const member of members) {
        const role = await this.userRepository.getUserOrganizationRole(member.id, OrganizationId.fromNumber(organizationId));
        switch (role?.value) {
          case 'owner':
            ownerCount++;
            break;
          case 'admin':
            adminCount++;
            break;
          case 'member':
            memberCount++;
            break;
        }
      }

      return {
        totalMembers: members.length,
        ownerCount,
        adminCount,
        memberCount
      };
    } catch (error) {
      console.error("Error getting organization member stats:", error);
      return {
        totalMembers: 0,
        ownerCount: 0,
        adminCount: 0,
        memberCount: 0
      };
    }
  }
}