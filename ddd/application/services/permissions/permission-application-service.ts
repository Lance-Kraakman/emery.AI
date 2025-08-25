/**
 * Permission Application Service
 * 
 * Orchestrates role and permission management operations.
 * Handles business logic for RBAC system including role assignment and permission checking.
 */

import type { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { Role, CreateRoleData, UpdateRoleData, RoleType, Permission } from '@/ddd/domain/roles/entities/role';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/ddd/domain/roles/entities/role';
import type { Result } from '@/ddd/domain/shared/result';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';

export interface CreateRoleCommand {
  name: string;
  permissions: string[];
  organizationId: number;
}

export interface UpdateRoleCommand {
  roleId: number;
  name?: string;
  permissions?: string[];
}

export interface AssignRoleCommand {
  userId: string;
  roleId: number;
  organizationId: number;
}

export interface RoleFilters {
  organizationId: number;
  hasPermission?: string;
  searchQuery?: string;
  roleType?: RoleType;
}

// Use unified Result interface from domain shared types
export type PermissionApplicationResult<T = any> = Result<T>;

export interface RolePermissionSummary {
  role: Role;
  permissionCount: number;
  userCount: number;
  isSystemRole: boolean;
  isDefaultRole: boolean;
}

export class PermissionApplicationService {
  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly userRepository: IUserRepository
  ) {}

  /**
   * Create a new role with business validation
   */
  async createRole(command: CreateRoleCommand): Promise<PermissionApplicationResult<Role>> {
    try {
      // Business validation
      if (!command.name?.trim()) {
        return {
          success: false,
          error: "Role name is required"
        };
      }

      if (!command.permissions || command.permissions.length === 0) {
        return {
          success: false,
          error: "At least one permission is required"
        };
      }

      // Check for duplicate role name in organization
      const existingRole = await this.roleRepository.findByName(command.organizationId, command.name.trim());
      if (existingRole) {
        return {
          success: false,
          error: `Role with name '${command.name}' already exists in this organization`
        };
      }

      // Validate permissions
      const permissionValidation = await this.roleRepository.validateRolePermissions(command.permissions);
      if (!permissionValidation.valid) {
        return {
          success: false,
          error: `Invalid permissions: ${permissionValidation.invalidPermissions.join(', ')}`
        };
      }

      // Create role
      const roleConfig: CreateRoleData = {
        name: command.name.trim(),
        permissions: command.permissions,
        organizationId: command.organizationId
      };

      const createdRole = await this.roleRepository.create(roleConfig);

      return {
        success: true,
        data: createdRole
      };
    } catch (error) {
      console.error("Error creating role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create role"
      };
    }
  }

  /**
   * Update an existing role
   */
  async updateRole(command: UpdateRoleCommand): Promise<PermissionApplicationResult<Role>> {
    try {
      // Load existing role
      const existingRole = await this.roleRepository.findById(command.roleId);
      if (!existingRole) {
        return {
          success: false,
          error: `Role with ID ${command.roleId} not found`
        };
      }

      // Validate name uniqueness if name is being changed
      if (command.name && command.name !== existingRole.name) {
        const duplicateRole = await this.roleRepository.findByName(
          existingRole.organizationId || 0, 
          command.name.trim()
        );
        if (duplicateRole && duplicateRole.id !== command.roleId) {
          return {
            success: false,
            error: `Role with name '${command.name}' already exists in this organization`
          };
        }
      }

      // Validate permissions if being updated
      if (command.permissions) {
        const permissionValidation = await this.roleRepository.validateRolePermissions(command.permissions);
        if (!permissionValidation.valid) {
          return {
            success: false,
            error: `Invalid permissions: ${permissionValidation.invalidPermissions.join(', ')}`
          };
        }
      }

      // Update role
      const updateData: UpdateRoleData = {
        name: command.name?.trim(),
        permissions: command.permissions
      };

      const updatedRole = await this.roleRepository.update(command.roleId, updateData);

      return {
        success: true,
        data: updatedRole
      };
    } catch (error) {
      console.error("Error updating role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update role"
      };
    }
  }

  /**
   * Delete a role with safety checks
   */
  async deleteRole(roleId: number, organizationId: number): Promise<PermissionApplicationResult<void>> {
    try {
      // Verify role exists and belongs to organization
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        return {
          success: false,
          error: `Role with ID ${roleId} not found`
        };
      }

      if (role.organizationId !== organizationId) {
        return {
          success: false,
          error: "Access denied: Role does not belong to your organization"
        };
      }

      // Check if role can be deleted (no users assigned)
      const canDelete = await this.roleRepository.canDeleteRole(roleId);
      if (!canDelete) {
        return {
          success: false,
          error: "Cannot delete role: Users are still assigned to this role"
        };
      }

      // Delete role
      await this.roleRepository.delete(roleId);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error deleting role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete role"
      };
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(command: AssignRoleCommand): Promise<PermissionApplicationResult<any>> {
    try {
      // Verify role exists and belongs to organization
      const role = await this.roleRepository.findById(command.roleId);
      if (!role) {
        return {
          success: false,
          error: `Role with ID ${command.roleId} not found`
        };
      }

      if (role.organizationId !== command.organizationId) {
        return {
          success: false,
          error: "Role does not belong to the specified organization"
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

      // Update user role
      const updatedUser = await this.userRepository.update(UserId.fromString(command.userId), { 
        roleId: command.roleId 
      });

      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      console.error("Error assigning role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to assign role"
      };
    }
  }

  /**
   * Get roles with filtering
   */
  async getRoles(filters: RoleFilters): Promise<Role[]> {
    try {
      let roles = await this.roleRepository.findByOrganization(filters.organizationId);

      // Apply permission filter
      if (filters.hasPermission) {
        roles = roles.filter(role => role.permissions.includes(filters.hasPermission!));
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        roles = roles.filter(role => 
          role.name.toLowerCase().includes(searchLower)
        );
      }

      // Apply role type filter
      if (filters.roleType) {
        roles = roles.filter(role => 
          role.name.toLowerCase() === filters.roleType!.toLowerCase()
        );
      }

      // Sort by name
      roles.sort((a, b) => a.name.localeCompare(b.name));

      return roles;
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw new Error("Failed to fetch roles");
    }
  }

  /**
   * Get single role by ID
   */
  async getRole(roleId: number): Promise<Role | null> {
    return await this.roleRepository.findById(roleId);
  }

  /**
   * Get detailed role summary including usage statistics
   */
  async getRoleSummary(roleId: number): Promise<PermissionApplicationResult<RolePermissionSummary>> {
    try {
      const roleSummary = await this.roleRepository.getRolePermissionSummary(roleId);
      
      // Determine if this is a default role by checking name against standard types
      const isDefaultRole = ['owner', 'admin', 'member'].includes(roleSummary.role.name.toLowerCase());

      const enhancedSummary: RolePermissionSummary = {
        ...roleSummary,
        isDefaultRole
      };

      return {
        success: true,
        data: enhancedSummary
      };
    } catch (error) {
      console.error("Error getting role summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get role summary"
      };
    }
  }

  /**
   * Check if a user has a specific permission
   */
  async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(UserId.fromString(userId));
      if (!user || !user.roleId) {
        return false;
      }

      return await this.roleRepository.hasPermission(user.roleId, permission);
    } catch (error) {
      console.error("Error checking user permission:", error);
      return false;
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await this.userRepository.findById(UserId.fromString(userId));
      if (!user || !user.roleId) {
        return [];
      }

      const role = await this.roleRepository.findById(user.roleId);
      return role?.permissions || [];
    } catch (error) {
      console.error("Error getting user permissions:", error);
      return [];
    }
  }

  /**
   * Initialize default roles for an organization
   */
  async initializeDefaultRoles(organizationId: number): Promise<PermissionApplicationResult<Role[]>> {
    try {
      const defaultRoles = await this.roleRepository.ensureDefaultRoles(organizationId);

      return {
        success: true,
        data: defaultRoles
      };
    } catch (error) {
      console.error("Error initializing default roles:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize default roles"
      };
    }
  }

  /**
   * Add permission to a role
   */
  async addPermissionToRole(roleId: number, permission: string): Promise<PermissionApplicationResult<void>> {
    try {
      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        return {
          success: false,
          error: `Role with ID ${roleId} not found`
        };
      }

      // Check if permission is already assigned
      if (role.permissions.includes(permission)) {
        return {
          success: false,
          error: `Permission '${permission}' is already assigned to this role`
        };
      }

      // Validate permission
      const permissionValidation = await this.roleRepository.validateRolePermissions([permission]);
      if (!permissionValidation.valid) {
        return {
          success: false,
          error: `Invalid permission: ${permission}`
        };
      }

      // Add permission
      await this.roleRepository.addPermission(roleId, permission);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error adding permission to role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add permission to role"
      };
    }
  }

  /**
   * Remove permission from a role
   */
  async removePermissionFromRole(roleId: number, permission: string): Promise<PermissionApplicationResult<void>> {
    try {
      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        return {
          success: false,
          error: `Role with ID ${roleId} not found`
        };
      }

      // Check if permission is assigned
      if (!role.permissions.includes(permission)) {
        return {
          success: false,
          error: `Permission '${permission}' is not assigned to this role`
        };
      }

      // Remove permission
      await this.roleRepository.removePermission(roleId, permission);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error removing permission from role:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove permission from role"
      };
    }
  }

  /**
   * Get all available permissions
   */
  async getAvailablePermissions(): Promise<Permission[]> {
    // Return all available permissions from the permission constants
    return Object.values(PERMISSIONS);
  }

  /**
   * Get role hierarchy for an organization
   */
  async getOrganizationRoleHierarchy(organizationId: number): Promise<Role[]> {
    try {
      return await this.roleRepository.getOrganizationRoleHierarchy(organizationId);
    } catch (error) {
      console.error("Error getting role hierarchy:", error);
      throw new Error("Failed to get role hierarchy");
    }
  }
}