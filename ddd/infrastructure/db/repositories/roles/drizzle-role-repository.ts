// AIDEV-NOTE: Drizzle implementation of IRoleRepository - handles role and permission management
// Supports enhanced RBAC system with granular permissions and complex business logic

import { eq, and, arrayContains, sql } from 'drizzle-orm';
import type postgres from 'postgres';

import { roles, users } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db/client';
import type { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
import type { 
  Role, 
  CreateRoleData, 
  UpdateRoleData,
  RoleType
} from '@/ddd/domain/roles/entities/role';
import { ROLE_TYPES, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/ddd/domain/roles/entities/role';

export class DrizzleRoleRepository implements IRoleRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

  // Basic CRUD operations
  async findById(id: number): Promise<Role | null> {
    const result = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    const role = result[0];
    if (!role) return null;

    return {
      ...role,
      permissions: role.permissions || [], // Handle null permissions from database
    };
  }

  async findByOrganization(organizationId: number): Promise<Role[]> {
    const result = await this.db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, organizationId))
      .orderBy(roles.name);

    return result.map(role => ({
      ...role,
      permissions: role.permissions || [],
    }));
  }

  async findByName(organizationId: number, name: string): Promise<Role | null> {
    const result = await this.db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organizationId),
          eq(roles.name, name)
        )
      )
      .limit(1);

    const role = result[0];
    if (!role) return null;

    return {
      ...role,
      permissions: role.permissions || [],
    };
  }

  async create(data: CreateRoleData): Promise<Role> {
    const [newRole] = await this.db
      .insert(roles)
      .values(data)
      .returning();

    if (!newRole) {
      throw new Error('Failed to create role');
    }

    return {
      ...newRole,
      permissions: newRole.permissions || [],
    };
  }

  async update(id: number, data: UpdateRoleData): Promise<Role> {
    const [updatedRole] = await this.db
      .update(roles)
      .set(data)
      .where(eq(roles.id, id))
      .returning();

    if (!updatedRole) {
      throw new Error(`Role with id ${id} not found or could not be updated`);
    }

    return {
      ...updatedRole,
      permissions: updatedRole.permissions || [],
    };
  }

  async delete(id: number): Promise<void> {
    // First check if role can be deleted
    const canDelete = await this.canDeleteRole(id);
    if (!canDelete) {
      throw new Error(`Cannot delete role ${id} - it is still assigned to users`);
    }

    // Check if role exists
    const existingRole = await this.findById(id);
    if (!existingRole) {
      throw new Error(`Role with id ${id} not found`);
    }

    await this.db
      .delete(roles)
      .where(eq(roles.id, id));
  }

  // Permission Management
  async hasPermission(roleId: number, permission: string): Promise<boolean> {
    const role = await this.findById(roleId);
    if (!role) {
      return false;
    }

    return role.permissions.includes(permission) || role.permissions.includes(PERMISSIONS.ALL);
  }

  async addPermission(roleId: number, permission: string): Promise<void> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    if (!role.permissions.includes(permission)) {
      const updatedPermissions = [...role.permissions, permission];
      await this.update(roleId, { permissions: updatedPermissions });
    }
  }

  async removePermission(roleId: number, permission: string): Promise<void> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    const updatedPermissions = role.permissions.filter(p => p !== permission);
    await this.update(roleId, { permissions: updatedPermissions });
  }

  async addPermissions(roleId: number, permissions: string[]): Promise<void> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    const existingPermissions = new Set(role.permissions);
    const newPermissions = permissions.filter(p => !existingPermissions.has(p));
    
    if (newPermissions.length > 0) {
      const updatedPermissions = [...role.permissions, ...newPermissions];
      await this.update(roleId, { permissions: updatedPermissions });
    }
  }

  async removePermissions(roleId: number, permissions: string[]): Promise<void> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    const permissionsToRemove = new Set(permissions);
    const updatedPermissions = role.permissions.filter(p => !permissionsToRemove.has(p));
    await this.update(roleId, { permissions: updatedPermissions });
  }

  async updatePermissions(roleId: number, permissions: string[]): Promise<Role> {
    return await this.update(roleId, { permissions });
  }

  // Standard Role Creation and Management
  async createDefaultRoles(organizationId: number): Promise<Role[]> {
    const defaultRoles: CreateRoleData[] = [
      {
        name: ROLE_TYPES.OWNER,
        permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLE_TYPES.OWNER]], // Spread to make mutable
        organizationId,
      },
      {
        name: ROLE_TYPES.ADMIN,
        permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLE_TYPES.ADMIN]], // Spread to make mutable
        organizationId,
      },
      {
        name: ROLE_TYPES.MEMBER,
        permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLE_TYPES.MEMBER]], // Spread to make mutable
        organizationId,
      },
    ];

    const createdRoles: Role[] = [];
    for (const roleData of defaultRoles) {
      const existingRole = await this.findByName(organizationId, roleData.name);
      if (!existingRole) {
        const newRole = await this.create(roleData);
        createdRoles.push(newRole);
      } else {
        createdRoles.push(existingRole);
      }
    }

    return createdRoles;
  }

  async ensureDefaultRoles(organizationId: number): Promise<Role[]> {
    // Check if default roles exist, create if missing
    const existingRoles = await this.findByOrganization(organizationId);
    const existingRoleNames = new Set(existingRoles.map(r => r.name));

    const missingRoles: CreateRoleData[] = [];
    for (const [roleType, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (!existingRoleNames.has(roleType)) {
        missingRoles.push({
          name: roleType,
          permissions: [...permissions], // Spread to make mutable
          organizationId,
        });
      }
    }

    const createdRoles: Role[] = [];
    for (const roleData of missingRoles) {
      const newRole = await this.create(roleData);
      createdRoles.push(newRole);
    }

    return [...existingRoles, ...createdRoles];
  }

  async getDefaultRoleByType(organizationId: number, roleType: RoleType): Promise<Role | null> {
    return await this.findByName(organizationId, roleType);
  }

  // Role Queries
  async findRolesByPermission(organizationId: number, permission: string): Promise<Role[]> {
    const result = await this.db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organizationId),
          arrayContains(roles.permissions, [permission])
        )
      );

    return result.map(role => ({
      ...role,
      permissions: role.permissions || [],
    }));
  }

  async getUsersWithRole(roleId: number): Promise<string[]> {
    const result = await this.db
      .select({ userId: users.id })
      .from(users)
      .where(eq(users.roleId, roleId));

    return result.map(r => r.userId);
  }

  async getOrganizationRoleHierarchy(organizationId: number): Promise<Role[]> {
    // Return roles in hierarchical order: owner, admin, member, custom roles
    const allRoles = await this.findByOrganization(organizationId);
    
    const hierarchyOrder = [ROLE_TYPES.OWNER, ROLE_TYPES.ADMIN, ROLE_TYPES.MEMBER];
    const sortedRoles: Role[] = [];
    
    // Add standard roles in order
    for (const roleType of hierarchyOrder) {
      const role = allRoles.find(r => r.name === roleType);
      if (role) {
        sortedRoles.push(role);
      }
    }
    
    // Add custom roles
    const customRoles = allRoles.filter(r => !hierarchyOrder.includes(r.name as RoleType));
    sortedRoles.push(...customRoles.sort((a, b) => a.name.localeCompare(b.name)));
    
    return sortedRoles;
  }

  // Business Logic Operations
  async canDeleteRole(roleId: number): Promise<boolean> {
    const usersWithRole = await this.getUsersWithRole(roleId);
    return usersWithRole.length === 0;
  }

  async validateRolePermissions(permissions: string[]): Promise<{ valid: boolean; invalidPermissions: string[] }> {
    const validPermissions = new Set(Object.values(PERMISSIONS) as string[]);
    const invalidPermissions = permissions.filter(p => !validPermissions.has(p as any));
    
    return {
      valid: invalidPermissions.length === 0,
      invalidPermissions,
    };
  }

  async getRolePermissionSummary(roleId: number): Promise<{
    role: Role;
    permissionCount: number;
    userCount: number;
    isSystemRole: boolean;
  }> {
    const role = await this.findById(roleId);
    if (!role) {
      throw new Error(`Role with id ${roleId} not found`);
    }

    const usersWithRole = await this.getUsersWithRole(roleId);
    const systemRoles = Object.values(ROLE_TYPES);
    
    return {
      role,
      permissionCount: role.permissions.length,
      userCount: usersWithRole.length,
      isSystemRole: systemRoles.includes(role.name as RoleType),
    };
  }

  // Bulk Operations
  async bulkUpdateRolePermissions(updates: Array<{roleId: number; permissions: string[]}>): Promise<Role[]> {
    const updatedRoles: Role[] = [];
    
    for (const update of updates) {
      const updatedRole = await this.updatePermissions(update.roleId, update.permissions);
      updatedRoles.push(updatedRole);
    }
    
    return updatedRoles;
  }

  async cloneRole(sourceRoleId: number, newName: string, organizationId?: number): Promise<Role> {
    const sourceRole = await this.findById(sourceRoleId);
    if (!sourceRole) {
      throw new Error(`Source role with id ${sourceRoleId} not found`);
    }

    const targetOrgId = organizationId || sourceRole.organizationId;
    if (!targetOrgId) {
      throw new Error('Organization ID is required for role cloning');
    }

    // Check if role with new name already exists in target organization
    const existingRole = await this.findByName(targetOrgId, newName);
    if (existingRole) {
      throw new Error(`Role with name '${newName}' already exists in organization ${targetOrgId}`);
    }

    const cloneData: CreateRoleData = {
      name: newName,
      permissions: [...sourceRole.permissions], // Clone permissions array
      organizationId: targetOrgId,
    };

    return await this.create(cloneData);
  }
}