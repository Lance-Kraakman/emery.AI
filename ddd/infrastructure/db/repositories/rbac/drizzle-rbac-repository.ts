// AIDEV-NOTE: Drizzle implementation of RBAC repository
// Handles permission checking, role management, and user-role assignments

import { eq, and, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { 
  permissions, 
  roles, 
  rolePermissions, 
  userRoles 
} from '@/lib/db/schema';
import { Permission, ACTIONS, RESOURCES } from '@/ddd/domain/shared/value-objects/permission';
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { 
  Role, 
  CreateRoleData, 
  UpdateRoleData,
  SYSTEM_ROLES 
} from '@/ddd/domain/rbac/entities/role';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';

export class DrizzleRBACRepository implements IRBACRepository {
  constructor(private db: DbClient) {}

  // Core permission checking
  async hasPermission(userId: UserId, permission: Permission, organizationId: OrganizationId): Promise<boolean> {
    console.log("🔍 DrizzleRBACRepository.hasPermission() - Checking permission:", {
      userId: userId.value,
      organizationId: organizationId.value,
      permission: permission.toString(),
      resource: permission.resource,
      action: permission.action
    });

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(userRoles.userId, userId.value),
        eq(userRoles.organizationId, organizationId.value),
        eq(permissions.resource, permission.resource),
        eq(permissions.action, permission.action)
      ));

    const hasPermission = result[0]?.count > 0;
    console.log("🔍 DrizzleRBACRepository.hasPermission() - Query result:", {
      count: result[0]?.count,
      hasPermission,
      query: "userRoles -> rolePermissions -> permissions"
    });

    return hasPermission;
  }

  async requirePermission(userId: UserId, permission: Permission, organizationId: OrganizationId): Promise<void> {
    console.log("🛡️ DrizzleRBACRepository.requirePermission() - Starting check");
    
    // DEBUG: Show user's current roles and permissions
    await this.debugUserPermissions(userId, organizationId);
    
    const hasAccess = await this.hasPermission(userId, permission, organizationId);
    
    if (!hasAccess) {
      console.error("🚫 DrizzleRBACRepository.requirePermission() - ACCESS DENIED");
      throw new Error(`Permission denied: ${permission.toString()}`);
    }
    
    console.log("✅ DrizzleRBACRepository.requirePermission() - ACCESS GRANTED");
  }
  
  // DEBUG method to show user's roles and permissions
  private async debugUserPermissions(userId: UserId, organizationId: OrganizationId): Promise<void> {
    console.log("🔍 DEBUG - User roles and permissions:");
    
    // Get user roles
    const userRolesResult = await this.db
      .select({
        roleId: userRoles.roleId,
        roleName: roles.name,
        isSystem: roles.isSystem
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(
        eq(userRoles.userId, userId.value),
        eq(userRoles.organizationId, organizationId.value)
      ));
      
    console.log("🔍 DEBUG - User roles:", userRolesResult);
    
    // Get user permissions
    const userPermissionsResult = await this.db
      .select({
        resource: permissions.resource,
        action: permissions.action,
        roleName: roles.name
      })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(
        eq(userRoles.userId, userId.value),
        eq(userRoles.organizationId, organizationId.value)
      ));
      
    console.log("🔍 DEBUG - User permissions:", userPermissionsResult);
  }

  // User permission queries
  async getUserPermissions(userId: UserId, organizationId: OrganizationId): Promise<Permission[]> {
    const result = await this.db
      .select({
        resource: permissions.resource,
        action: permissions.action
      })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(userRoles.userId, userId.value),
        eq(userRoles.organizationId, organizationId.value)
      ));

    return result.map(r => new Permission(r.resource as any, r.action as any));
  }

  async getUserRoles(userId: UserId, organizationId: OrganizationId): Promise<Role[]> {
    const result = await this.db
      .select({
        role: roles,
        permissions: sql<string[]>`array_agg(${permissions.resource} || ':' || ${permissions.action})`
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(userRoles.userId, userId.value),
        eq(userRoles.organizationId, organizationId.value)
      ))
      .groupBy(roles.id);

    return result.map(r => this.mapToRoleEntity(r.role, r.permissions || []));
  }

  // Role management
  async createRole(data: CreateRoleData): Promise<Role> {
    return await this.db.transaction(async (tx) => {
      // Create role
      const [newRole] = await tx
        .insert(roles)
        .values({
          name: data.name,
          description: data.description,
          organizationId: data.organizationId.value,
          isSystem: false
        })
        .returning();

      // Add permissions
      if (data.permissions.length > 0) {
        const permissionIds = await this.getPermissionIds(data.permissions, tx);
        await tx
          .insert(rolePermissions)
          .values(permissionIds.map(id => ({
            roleId: newRole.id,
            permissionId: id
          })));
      }

      return this.mapToRoleEntity(newRole, data.permissions.map(p => p.toString()));
    });
  }

  async updateRole(roleId: number, data: UpdateRoleData): Promise<Role> {
    return await this.db.transaction(async (tx) => {
      // Update role metadata
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      if (Object.keys(updateData).length > 0) {
        await tx
          .update(roles)
          .set(updateData)
          .where(eq(roles.id, roleId));
      }

      // Update permissions if provided
      if (data.permissions) {
        await this.setRolePermissions(roleId, data.permissions);
      }

      // Return updated role
      const role = await this.findRoleById(roleId);
      if (!role) {
        throw new Error(`Role with id ${roleId} not found after update`);
      }
      return role;
    });
  }

  async deleteRole(roleId: number): Promise<void> {
    // Check if it's a system role
    const role = await this.findRoleById(roleId);
    if (role?.isSystem) {
      throw new Error('Cannot delete system role');
    }

    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  async findRoleById(id: number): Promise<Role | null> {
    const result = await this.db
      .select({
        role: roles,
        permissions: sql<string[]>`array_agg(${permissions.resource} || ':' || ${permissions.action})`
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.id, id))
      .groupBy(roles.id);

    if (!result[0]) return null;

    return this.mapToRoleEntity(result[0].role, result[0].permissions || []);
  }

  async findRolesByOrganization(organizationId: OrganizationId): Promise<Role[]> {
    const result = await this.db
      .select({
        role: roles,
        permissions: sql<string[]>`array_agg(${permissions.resource} || ':' || ${permissions.action})`
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.organizationId, organizationId.value))
      .groupBy(roles.id);

    return result.map(r => this.mapToRoleEntity(r.role, r.permissions || []));
  }

  async getSystemRoles(): Promise<Role[]> {
    const result = await this.db
      .select({
        role: roles,
        permissions: sql<string[]>`array_agg(${permissions.resource} || ':' || ${permissions.action})`
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.isSystem, true))
      .groupBy(roles.id);

    return result.map(r => this.mapToRoleEntity(r.role, r.permissions || []));
  }

  // Role-permission assignment
  async addPermissionsToRole(roleId: number, permissionsToAdd: Permission[]): Promise<void> {
    const permissionIds = await this.getPermissionIds(permissionsToAdd);
    await this.db
      .insert(rolePermissions)
      .values(permissionIds.map(id => ({
        roleId,
        permissionId: id
      })))
      .onConflictDoNothing();
  }

  async removePermissionsFromRole(roleId: number, permissionsToRemove: Permission[]): Promise<void> {
    const permissionIds = await this.getPermissionIds(permissionsToRemove);
    await this.db
      .delete(rolePermissions)
      .where(and(
        eq(rolePermissions.roleId, roleId),
        inArray(rolePermissions.permissionId, permissionIds)
      ));
  }

  async setRolePermissions(roleId: number, newPermissions: Permission[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Remove all existing permissions
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      
      // Add new permissions
      if (newPermissions.length > 0) {
        const permissionIds = await this.getPermissionIds(newPermissions, tx);
        await tx
          .insert(rolePermissions)
          .values(permissionIds.map(id => ({
            roleId,
            permissionId: id
          })));
      }
    });
  }

  // User-role assignment
  async assignRole(userId: UserId, roleId: number, organizationId: OrganizationId): Promise<void> {
    await this.db
      .insert(userRoles)
      .values({
        userId: userId.value,
        roleId,
        organizationId: organizationId.value
      })
      .onConflictDoNothing();
  }

  async removeRole(userId: UserId, roleId: number, organizationId: OrganizationId): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(
        eq(userRoles.userId, userId.value),
        eq(userRoles.roleId, roleId),
        eq(userRoles.organizationId, organizationId.value)
      ));
  }

  async setUserRoles(userId: UserId, roleIds: number[], organizationId: OrganizationId): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Remove all existing roles
      await tx
        .delete(userRoles)
        .where(and(
          eq(userRoles.userId, userId.value),
          eq(userRoles.organizationId, organizationId.value)
        ));
      
      // Add new roles
      if (roleIds.length > 0) {
        await tx
          .insert(userRoles)
          .values(roleIds.map(roleId => ({
            userId: userId.value,
            roleId,
            organizationId: organizationId.value
          })));
      }
    });
  }

  // Permission and role seeding
  async getAllPermissions(): Promise<Permission[]> {
    const result = await this.db
      .select({
        resource: permissions.resource,
        action: permissions.action
      })
      .from(permissions);

    return result.map(r => new Permission(r.resource as any, r.action as any));
  }

  async seedPermissions(): Promise<void> {
    const allPermissions = Permission.getAll();
    
    for (const permission of allPermissions) {
      await this.db
        .insert(permissions)
        .values({
          resource: permission.resource,
          action: permission.action,
          description: `${permission.action} ${permission.resource}`
        })
        .onConflictDoNothing();
    }
  }

  async seedSystemRoles(): Promise<void> {
    // Implementation depends on system role definitions
    // This would create the predefined system roles with their default permissions
    // TODO: Implement based on SYSTEM_ROLES constants
  }

  // Helper methods
  private async getPermissionIds(perms: Permission[], tx?: any): Promise<number[]> {
    const db = tx || this.db;
    const result = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(
        sql`(${permissions.resource}, ${permissions.action}) IN (${sql.join(
          perms.map(p => sql`(${p.resource}, ${p.action})`),
          sql`, `
        )})`
      );

    return result.map((r: any) => r.id);
  }

  private mapToRoleEntity(roleData: any, permissionStrings: string[]): Role {
    const rolePermissions = permissionStrings
      .filter(p => p && p !== '') // Filter out null/empty strings
      .map(p => Permission.fromString(p));

    return {
      id: roleData.id,
      name: roleData.name,
      description: roleData.description,
      organizationId: roleData.organizationId ? OrganizationId.fromNumber(roleData.organizationId) : undefined,
      isSystem: roleData.isSystem,
      permissions: rolePermissions,
      createdAt: roleData.createdAt
    };
  }
}