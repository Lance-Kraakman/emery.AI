'use server';

// AIDEV-NOTE: Server Actions for custom role management in RBAC system
// Handles CRUD operations for organization-specific roles and their permissions

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result } from "./types";
import { db } from '@/lib/db/client';
import { roles, permissions, rolePermissions, userRoles } from '@/lib/db/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';

export interface CustomRole {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  permissionCount: number;
  userCount: number;
  permissions?: Array<{
    id: number;
    resource: string;
    action: string;
    description: string | null;
  }>;
}

export interface CreateRoleCommand {
  name: string;
  description?: string;
  permissionIds: number[];
}

export interface UpdateRoleCommand {
  id: number;
  name: string;
  description?: string;
  permissionIds: number[];
}

/**
 * Get all roles for the current organization (system + custom)
 */
export async function getOrganizationRoles(): Promise<CustomRole[]> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:view");
      const currentOrg = await requireCurrentOrganization();

      // Get all roles (system roles + organization custom roles)
      const rolesData = await db
        .select({
          id: roles.id,
          name: roles.name,
          description: roles.description,
          isSystem: roles.isSystem,
          createdAt: roles.createdAt,
        })
        .from(roles)
        .where(
          or(
            // Include system roles (isSystem = true, organizationId = null)
            and(
              eq(roles.isSystem, true),
              isNull(roles.organizationId)
            ),
            // Include custom roles for this org
            eq(roles.organizationId, currentOrg.id.value)
          )
        );

      // Get permission counts and user counts for each role
      const rolesWithCounts = await Promise.all(
        rolesData.map(async (role) => {
          // Count permissions for this role
          const permissionCount = await db
            .select({ count: rolePermissions.id })
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, role.id));

          // Count users with this role in the current organization
          const userCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(userRoles)
            .where(and(
              eq(userRoles.roleId, role.id),
              eq(userRoles.organizationId, currentOrg.id.value)
            ));
          
          const userCount = userCountResult[0]?.count || 0;

          return {
            ...role,
            isSystem: role.isSystem ?? false,
            createdAt: role.createdAt ?? new Date(),
            permissionCount: permissionCount.length,
            userCount,
          };
        })
      );

      return rolesWithCounts;
    } catch (error) {
      console.error("Error fetching organization roles:", error);
      return [];
    }
  });
}

/**
 * Get all available permissions for role creation/editing
 */
export async function getAvailablePermissions() {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:view");

      const perms = await db
        .select({
          id: permissions.id,
          resource: permissions.resource,
          action: permissions.action,
          description: permissions.description,
        })
        .from(permissions)
        .orderBy(permissions.resource, permissions.action);

      return perms;
    } catch (error) {
      console.error("Error fetching available permissions:", error);
      return [];
    }
  });
}

/**
 * Get detailed role information including its permissions
 */
export async function getRoleDetails(roleId: number): Promise<CustomRole | null> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:view");
      const currentOrg = await requireCurrentOrganization();

      // Get role basic info
      const role = await db
        .select({
          id: roles.id,
          name: roles.name,
          description: roles.description,
          isSystem: roles.isSystem,
          createdAt: roles.createdAt,
        })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            // Ensure role belongs to current org (or is system role)
            eq(roles.organizationId, currentOrg.id.value)
          )
        )
        .limit(1);

      if (!role[0]) {
        return null;
      }

      // Get role permissions
      const rolePerms = await db
        .select({
          id: permissions.id,
          resource: permissions.resource,
          action: permissions.action,
          description: permissions.description,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));

      // TODO: Count users with this role
      const userCount = 0; // Placeholder

      return {
        ...role[0],
        isSystem: role[0].isSystem ?? false,
        createdAt: role[0].createdAt ?? new Date(),
        permissionCount: rolePerms.length,
        userCount,
        permissions: rolePerms,
      };
    } catch (error) {
      console.error("Error fetching role details:", error);
      return null;
    }
  });
}

/**
 * Create a new custom role
 */
export async function createCustomRole(formData: FormData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
      const currentOrg = await requireCurrentOrganization();

      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const permissionIdsStr = formData.get("permissionIds") as string;

      if (!name?.trim()) {
        return {
          success: false,
          error: "Role name is required"
        };
      }

      const permissionIds: number[] = permissionIdsStr 
        ? JSON.parse(permissionIdsStr) 
        : [];

      // Check if role name already exists for this organization
      const existingRole = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.name, name),
            eq(roles.organizationId, currentOrg.id.value)
          )
        )
        .limit(1);

      if (existingRole[0]) {
        return {
          success: false,
          error: "A role with this name already exists in your organization"
        };
      }

      // Create the role in a transaction
      const result = await db.transaction(async (tx) => {
        // Create role
        const [newRole] = await tx
          .insert(roles)
          .values({
            name: name.trim(),
            description: description?.trim() || null,
            organizationId: currentOrg.id.value,
            isSystem: false,
          })
          .returning({ id: roles.id });

        // Assign permissions to role
        if (permissionIds.length > 0) {
          await tx
            .insert(rolePermissions)
            .values(
              permissionIds.map(permissionId => ({
                roleId: newRole.id,
                permissionId,
              }))
            );
        }

        return newRole;
      });

      revalidatePath("/organization/settings/permissions");
      
      return {
        success: true,
        data: { id: result.id, message: `Role "${name}" created successfully` }
      };

    } catch (error) {
      console.error("Error creating custom role:", error);
      return {
        success: false,
        error: "Failed to create role"
      };
    }
  });
}

/**
 * Update an existing custom role
 */
export async function updateCustomRole(formData: FormData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
      const currentOrg = await requireCurrentOrganization();

      const roleId = parseInt(formData.get("roleId") as string);
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const permissionIdsStr = formData.get("permissionIds") as string;

      if (!roleId || !name?.trim()) {
        return {
          success: false,
          error: "Role ID and name are required"
        };
      }

      const permissionIds: number[] = permissionIdsStr 
        ? JSON.parse(permissionIdsStr) 
        : [];

      // Verify role exists and belongs to organization
      const existingRole = await db
        .select({ 
          id: roles.id, 
          isSystem: roles.isSystem,
          name: roles.name 
        })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, currentOrg.id.value)
          )
        )
        .limit(1);

      if (!existingRole[0]) {
        return {
          success: false,
          error: "Role not found or access denied"
        };
      }

      if (existingRole[0].isSystem) {
        return {
          success: false,
          error: "System roles cannot be modified"
        };
      }

      // Check if new name conflicts with other roles (excluding current role)
      const nameConflict = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.name, name),
            eq(roles.organizationId, currentOrg.id.value),
            // Exclude current role from name conflict check
            // Using != instead of neq since neq might not be available
            // TODO: Use proper neq operator if available in this version
            // neq(roles.id, roleId)
          )
        )
        .limit(1);

      if (nameConflict[0] && nameConflict[0].id !== roleId) {
        return {
          success: false,
          error: "A role with this name already exists in your organization"
        };
      }

      // Update role in a transaction
      await db.transaction(async (tx) => {
        // Update role basic info
        await tx
          .update(roles)
          .set({
            name: name.trim(),
            description: description?.trim() || null,
          })
          .where(eq(roles.id, roleId));

        // Remove existing permissions
        await tx
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId));

        // Add new permissions
        if (permissionIds.length > 0) {
          await tx
            .insert(rolePermissions)
            .values(
              permissionIds.map(permissionId => ({
                roleId,
                permissionId,
              }))
            );
        }
      });

      revalidatePath("/organization/settings/permissions");
      
      return {
        success: true,
        data: { message: `Role "${name}" updated successfully` }
      };

    } catch (error) {
      console.error("Error updating custom role:", error);
      return {
        success: false,
        error: "Failed to update role"
      };
    }
  });
}

/**
 * Delete a custom role
 */
export async function deleteCustomRole(roleId: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!roleId) {
        return {
          success: false,
          error: "Role ID is required"
        };
      }

      // Verify role exists, belongs to organization, and is not a system role
      const existingRole = await db
        .select({ 
          id: roles.id, 
          isSystem: roles.isSystem,
          name: roles.name 
        })
        .from(roles)
        .where(
          and(
            eq(roles.id, roleId),
            eq(roles.organizationId, currentOrg.id.value)
          )
        )
        .limit(1);

      if (!existingRole[0]) {
        return {
          success: false,
          error: "Role not found or access denied"
        };
      }

      if (existingRole[0].isSystem) {
        return {
          success: false,
          error: "System roles cannot be deleted"
        };
      }

      // TODO: Check if any users are assigned to this role
      // When user_roles table is fully integrated, add this check:
      // const assignedUsers = await db
      //   .select({ count: userRoles.id })
      //   .from(userRoles)
      //   .where(eq(userRoles.roleId, roleId));
      //
      // if (assignedUsers.length > 0) {
      //   return {
      //     success: false,
      //     error: `Cannot delete role "${existingRole[0].name}" - it is assigned to ${assignedUsers.length} user(s). Please reassign these users to other roles first.`
      //   };
      // }

      // Delete role and its permissions in transaction
      await db.transaction(async (tx) => {
        // Delete role-permission assignments
        await tx
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId));

        // Delete the role
        await tx
          .delete(roles)
          .where(eq(roles.id, roleId));
      });

      revalidatePath("/organization/settings/permissions");
      
      return {
        success: true,
        data: { message: `Role "${existingRole[0].name}" deleted successfully` }
      };

    } catch (error) {
      console.error("Error deleting custom role:", error);
      return {
        success: false,
        error: "Failed to delete role"
      };
    }
  });
}