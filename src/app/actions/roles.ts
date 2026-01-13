'use server';

// Server Actions for role management in RBAC system
// Handles CRUD operations for organization-specific roles and their permissions

// Export types for use in components
export type { 
  CustomRole, 
  CreateRoleCommand, 
  UpdateRoleCommand, 
  RoleResult, 
  RoleSelectionOption 
} from './types';

import { revalidatePath } from "next/cache";
import { db } from '@/ddd/infrastructure/db/client';
import { roles, permissions, rolePermissions, userRoles } from '@/ddd/infrastructure/db/schema';
import { eq, and, or, isNull, sql, ne } from 'drizzle-orm';
import type { 
  CustomRole, 
  CreateRoleCommand, 
  UpdateRoleCommand, 
  RoleResult as Result, 
  RoleSelectionOption 
} from './types';
import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission } from './permissions';
import { requireCurrentOrganization } from './user-organizations';
import { getAuditApplicationService } from "@/ddd/application/di/container";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";

/**
 * Get all roles for the current organization (system + custom) with counts
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
            eq(roles.organizationId, currentOrg.id)
          )
        );

      // Get permission counts and user counts for each role
      const rolesWithCounts = await Promise.all(
        rolesData.map(async (role: any) => {
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
              eq(userRoles.organizationId, currentOrg.id)
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
 * Get organization roles for EntityMultiSelect component
 */
export async function getOrganizationRolesForSelection(): Promise<RoleSelectionOption[]> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:view");
      const currentOrg = await requireCurrentOrganization();

      const rolesData = await db
        .select({
          id: roles.id,
          name: roles.name,
          description: roles.description,
          isSystem: roles.isSystem,
        })
        .from(roles)
        .where(
          or(
            and(eq(roles.isSystem, true), isNull(roles.organizationId)),
            eq(roles.organizationId, currentOrg.id)
          )
        );

      return rolesData.map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description || '',
        isSystem: role.isSystem ?? false,
      }));
    } catch (error) {
      console.error("Error fetching organization roles for selection:", error);
      return [];
    }
  });
}

/**
 * Get all available permissions for role creation/editing
 */
export async function getAvailablePermissions(): Promise<Array<{id: number; resource: string; action: string; description: string | null}>> {
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
            or(
              eq(roles.organizationId, currentOrg.id),
              and(
                eq(roles.isSystem, true),
                isNull(roles.organizationId)
              )
            )
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

      // Get user count for this role in current organization
      const userCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(userRoles)
        .where(and(
          eq(userRoles.roleId, roleId),
          eq(userRoles.organizationId, currentOrg.id)
        ));
      
      const userCount = userCountResult[0]?.count || 0;

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
      const permissionAssignmentsStr = formData.get("permissionAssignments") as string;

      if (!name?.trim()) {
        return {
          success: false,
          error: "Role name is required"
        };
      }

      // Handle both old and new formats
      let permissionAssignments: Array<{
        permissionId: number;
        resourceType?: 'agent' | 'team' | 'user' | null;
        resourceScope: 'all' | 'specific' | 'owned' | 'team';
        resourceIds?: number[];
      }> = [];

      if (permissionAssignmentsStr) {
        // New format with resource scopes
        permissionAssignments = JSON.parse(permissionAssignmentsStr);
      } else if (permissionIdsStr) {
        // Legacy format - convert to new format with default 'all' scope
        const permissionIds: number[] = JSON.parse(permissionIdsStr);
        permissionAssignments = permissionIds.map(id => ({
          permissionId: id,
          resourceType: null,
          resourceScope: 'all' as const,
          resourceIds: undefined
        }));
      }

      // Check if role name already exists for this organization
      const existingRole = await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.name, name),
            eq(roles.organizationId, currentOrg.id)
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
      const result = await db.transaction(async (tx: any) => {
        // Create role
        const [newRole] = await tx
          .insert(roles)
          .values({
            name: name.trim(),
            description: description?.trim() || null,
            organizationId: currentOrg.id,
            isSystem: false,
          })
          .returning({ id: roles.id });

        // Assign permissions to role with resource-specific information
        if (permissionAssignments.length > 0) {
          for (const assignment of permissionAssignments) {
            await tx
              .insert(rolePermissions)
              .values({
                roleId: newRole.id,
                permissionId: assignment.permissionId,
                resourceType: assignment.resourceType,
                resourceScope: assignment.resourceScope,
                resourceId: assignment.resourceScope === 'specific' && assignment.resourceIds?.length === 1
                  ? assignment.resourceIds[0]
                  : null
              });

            // For specific scope with multiple resources, create separate entries
            if (assignment.resourceScope === 'specific' && assignment.resourceIds && assignment.resourceIds.length > 1) {
              for (const resourceId of assignment.resourceIds.slice(1)) {
                await tx
                  .insert(rolePermissions)
                  .values({
                    roleId: newRole.id,
                    permissionId: assignment.permissionId,
                    resourceType: assignment.resourceType,
                    resourceScope: assignment.resourceScope,
                    resourceId: resourceId
                  });
              }
            }
          }
        }

        return newRole;
      });

      // AUDIT: Log role creation
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'role_crud',
          eventAction: 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'role',
          resourceId: String(result.id),
          resourceName: name,
          eventData: { permissionCount: permissionAssignments.length },
          success: true,
        }
      );

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
      const permissionAssignmentsStr = formData.get("permissionAssignments") as string;

      if (!roleId || !name?.trim()) {
        return {
          success: false,
          error: "Role ID and name are required"
        };
      }

      // Handle both old and new formats
      let permissionAssignments: Array<{
        permissionId: number;
        resourceType?: 'agent' | 'team' | 'user' | null;
        resourceScope: 'all' | 'specific' | 'owned' | 'team';
        resourceIds?: number[];
      }> = [];

      if (permissionAssignmentsStr) {
        // New format with resource scopes
        permissionAssignments = JSON.parse(permissionAssignmentsStr);
      } else if (permissionIdsStr) {
        // Legacy format - convert to new format with default 'all' scope
        const permissionIds: number[] = JSON.parse(permissionIdsStr);
        permissionAssignments = permissionIds.map(id => ({
          permissionId: id,
          resourceType: null,
          resourceScope: 'all' as const,
          resourceIds: undefined
        }));
      }

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
            eq(roles.organizationId, currentOrg.id)
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
            eq(roles.organizationId, currentOrg.id),
            ne(roles.id, roleId) // Exclude current role from name conflict check
          )
        )
        .limit(1);

      if (nameConflict[0]) {
        return {
          success: false,
          error: "A role with this name already exists in your organization"
        };
      }

      // Update role in a transaction
      await db.transaction(async (tx: any) => {
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

        // Add new permissions with resource-specific information
        if (permissionAssignments.length > 0) {
          for (const assignment of permissionAssignments) {
            await tx
              .insert(rolePermissions)
              .values({
                roleId,
                permissionId: assignment.permissionId,
                resourceType: assignment.resourceType,
                resourceScope: assignment.resourceScope,
                resourceId: assignment.resourceScope === 'specific' && assignment.resourceIds?.length === 1
                  ? assignment.resourceIds[0]
                  : null
              });

            // For specific scope with multiple resources, create separate entries
            if (assignment.resourceScope === 'specific' && assignment.resourceIds && assignment.resourceIds.length > 1) {
              for (const resourceId of assignment.resourceIds.slice(1)) {
                await tx
                  .insert(rolePermissions)
                  .values({
                    roleId,
                    permissionId: assignment.permissionId,
                    resourceType: assignment.resourceType,
                    resourceScope: assignment.resourceScope,
                    resourceId: resourceId
                  });
              }
            }
          }
        }
      });

      // AUDIT: Log role update
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'role_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'role',
          resourceId: String(roleId),
          resourceName: name,
          eventData: { permissionCount: permissionAssignments.length },
          success: true,
        }
      );

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
            eq(roles.organizationId, currentOrg.id)
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

      // Check if any users are assigned to this role
      const assignedUsers = await db
        .select({ count: sql<number>`count(*)` })
        .from(userRoles)
        .where(and(
          eq(userRoles.roleId, roleId),
          eq(userRoles.organizationId, currentOrg.id)
        ));

      if (assignedUsers[0]?.count > 0) {
        return {
          success: false,
          error: `Cannot delete role "${existingRole[0].name}" - it is assigned to ${assignedUsers[0]?.count} user(s). Please reassign these users to other roles first.`
        };
      }

      // Delete role and its permissions in transaction
      await db.transaction(async (tx: any) => {
        // Delete role-permission assignments
        await tx
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, roleId));

        // Delete the role
        await tx
          .delete(roles)
          .where(eq(roles.id, roleId));
      });

      // AUDIT: Log role deletion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'role_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'role',
          resourceId: String(roleId),
          resourceName: existingRole[0].name,
          eventData: {},
          success: true,
        }
      );

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