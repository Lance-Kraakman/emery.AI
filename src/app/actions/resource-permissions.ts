'use server'

import { revalidatePath } from 'next/cache';
import { requireAuth, requireResourcePermission } from './permissions';
import type { Result } from './types';
import { getRBACRepository } from '@/ddd/application/di/getters';
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { Permission } from '@/ddd/domain/shared/value-objects/permission';
import { db } from '@/lib/db/client';
import { users, teams, roles, userRoles, rolePermissions, permissions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Server Actions for Resource-Specific Permission Management
 *
 * These actions handle assigning, removing, and fetching permissions
 * for specific resources (apps, agents, databases, etc.)
 */

export interface AssignResourcePermissionsData {
  resourceType: string;
  resourceId: number;
  userIds?: (number | string)[]; // number for numeric IDs, string for UUIDs
  teamIds?: (number | string)[]; // number for numeric IDs, string for UUIDs
  permissions: string[]; // e.g., ['view', 'manage']
  scope: 'specific'; // For resource-specific permissions
}

export interface AccessEntry {
  id: string;
  type: 'user' | 'team';
  name: string;
  permissions: string[];
}

/**
 * Helper: Get or create a personal role for a user
 * Each user needs their own role for resource-specific permissions
 * to avoid granting access to all users with the same system role
 */
async function getOrCreateUserPersonalRole(
  userId: string,
  organizationId: number
): Promise<number> {
  const rbacRepository = getRBACRepository();

  // Check if user already has a personal role using new efficient lookup
  const personalRole = await rbacRepository.findPersonalRole(
    UserId.fromString(userId),
    OrganizationId.fromNumber(organizationId)
  );

  if (personalRole) {
    // Ensure user is assigned to this role
    await rbacRepository.assignRole(
      UserId.fromString(userId),
      personalRole.id,
      OrganizationId.fromNumber(organizationId)
    );
    return personalRole.id;
  }

  // Create new personal role with user-friendly name
  const newRole = await rbacRepository.createRole({
    name: `Personal permissions`,
    description: `Personal role for resource-specific permissions`,
    organizationId: OrganizationId.fromNumber(organizationId),
    permissions: [], // No base permissions
    type: 'personal',
    ownerId: UserId.fromString(userId)
  });

  // Assign to user
  await rbacRepository.assignRole(
    UserId.fromString(userId),
    newRole.id,
    OrganizationId.fromNumber(organizationId)
  );

  return newRole.id;
}

/**
 * Helper: Get or create a role for a team
 * Teams may share a role, but we create one per team for resource-specific permissions
 */
async function getOrCreateTeamRole(
  teamId: number | string,
  organizationId: number
): Promise<number> {
  const rbacRepository = getRBACRepository();
  const numericTeamId = typeof teamId === 'string' ? parseInt(teamId) : teamId;

  // Check if team already has a role using new efficient lookup
  const teamRole = await rbacRepository.findTeamRole(
    numericTeamId,
    OrganizationId.fromNumber(organizationId)
  );

  if (teamRole) {
    return teamRole.id;
  }

  // Create new team role with user-friendly name
  const newRole = await rbacRepository.createRole({
    name: `Team permissions`,
    description: `Team role for resource-specific permissions`,
    organizationId: OrganizationId.fromNumber(organizationId),
    permissions: [], // No base permissions
    type: 'team',
    teamId: numericTeamId
  });

  return newRole.id;
}

/**
 * Assign permissions to users/teams for a specific resource
 *
 * @param data - Permission assignment data
 * @returns Result indicating success or failure
 *
 * @example
 * ```ts
 * await assignResourcePermissions({
 *   resourceType: 'app',
 *   resourceId: 123,
 *   userIds: [1, 2],
 *   permissions: ['view', 'manage'],
 *   scope: 'specific'
 * });
 * ```
 */
export async function assignResourcePermissions(
  data: AssignResourcePermissionsData
): Promise<Result> {
  try {
    const session = await requireAuth();
    const organizationId = session.user.currentOrganizationId!;

    // Verify user has manage permission on the resource
    await requireResourcePermission(
      `${data.resourceType}s:manage`,
      data.resourceType,
      data.resourceId
    );

    const rbacRepository = getRBACRepository();

    // Assign permissions to users
    if (data.userIds && data.userIds.length > 0) {
      for (const userId of data.userIds) {
        // Get or create personal role for this user
        const roleId = await getOrCreateUserPersonalRole(userId.toString(), organizationId);

        // Assign each permission to the role
        for (const permissionString of data.permissions) {
          const permission = Permission.fromString(`${data.resourceType}s:${permissionString}`);

          await rbacRepository.assignResourcePermissionToRole(
            roleId,
            permission,
            data.resourceType,
            'specific',
            data.resourceId
          );
        }
      }
    }

    // Assign permissions to teams
    if (data.teamIds && data.teamIds.length > 0) {
      for (const teamId of data.teamIds) {
        // Get or create role for this team
        const roleId = await getOrCreateTeamRole(teamId, organizationId);

        // Assign each permission to the role
        for (const permissionString of data.permissions) {
          const permission = Permission.fromString(`${data.resourceType}s:${permissionString}`);

          await rbacRepository.assignResourcePermissionToRole(
            roleId,
            permission,
            data.resourceType,
            'specific',
            data.resourceId
          );
        }
      }
    }

    // Revalidate relevant paths
    revalidatePath(`/${data.resourceType}s`);
    revalidatePath(`/${data.resourceType}s/${data.resourceId}`);

    return {
      success: true,
      data: {
        message: `Permissions assigned successfully`
      }
    };
  } catch (error) {
    console.error('[assignResourcePermissions] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign permissions'
    };
  }
}

/**
 * Remove permissions from a user/team for a specific resource
 *
 * @param data - Permission removal data
 * @returns Result indicating success or failure
 *
 * @example
 * ```ts
 * await removeResourcePermission({
 *   resourceType: 'app',
 *   resourceId: 123,
 *   entityType: 'user',
 *   entityId: '550e8400-e29b-41d4-a716-446655440000'
 * });
 * ```
 */
export async function removeResourcePermission(data: {
  resourceType: string;
  resourceId: number;
  entityType: 'user' | 'team';
  entityId: string;
}): Promise<Result> {
  try {
    const session = await requireAuth();
    const organizationId = session.user.currentOrganizationId!;

    // Verify user has manage permission on the resource
    await requireResourcePermission(
      `${data.resourceType}s:manage`,
      data.resourceType,
      data.resourceId
    );

    // Find the role for the user/team using new efficient lookups
    const rbacRepository = getRBACRepository();
    let roleId: number | null = null;

    if (data.entityType === 'user') {
      const personalRole = await rbacRepository.findPersonalRole(
        UserId.fromString(data.entityId),
        OrganizationId.fromNumber(organizationId)
      );
      roleId = personalRole?.id || null;
    } else {
      const numericTeamId = parseInt(data.entityId);
      const teamRole = await rbacRepository.findTeamRole(
        numericTeamId,
        OrganizationId.fromNumber(organizationId)
      );
      roleId = teamRole?.id || null;
    }

    if (!roleId) {
      // No role means no permissions to remove
      return {
        success: true,
        data: {
          message: `No permissions to remove`
        }
      };
    }

    // Delete all permissions for this role on this specific resource
    await db
      .delete(rolePermissions)
      .where(and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.resourceType, data.resourceType),
        eq(rolePermissions.resourceId, data.resourceId)
      ));

    // Revalidate relevant paths
    revalidatePath(`/${data.resourceType}s`);
    revalidatePath(`/${data.resourceType}s/${data.resourceId}`);

    return {
      success: true,
      data: {
        message: `Access removed successfully`
      }
    };
  } catch (error) {
    console.error('[removeResourcePermission] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove permission'
    };
  }
}

/**
 * Get access list for a resource (who has permissions)
 *
 * @param resourceType - Type of resource ('app', 'agent', etc.)
 * @param resourceId - ID of the resource
 * @returns List of users/teams with their permissions
 *
 * @example
 * ```ts
 * const result = await getResourceAccessList('app', 123);
 * if (result.success) {
 *   console.log(result.data); // [{ id: '...', type: 'user', name: 'John', permissions: ['view', 'manage'] }]
 * }
 * ```
 */
export async function getResourceAccessList(
  resourceType: string,
  resourceId: number
): Promise<Result<AccessEntry[]>> {
  try {
    const session = await requireAuth();
    const organizationId = session.user.currentOrganizationId!;

    // Verify user has at least view permission on the resource
    await requireResourcePermission(
      `${resourceType}s:view`,
      resourceType,
      resourceId
    );

    // Query for users with permissions on this resource
    const userResults = await db
      .select({
        userId: users.id,
        userName: users.name,
        action: permissions.action
      })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .innerJoin(userRoles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(userRoles.userId, users.id))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(rolePermissions.resourceType, resourceType),
        eq(rolePermissions.resourceId, resourceId),
        eq(rolePermissions.resourceScope, 'specific'),
        eq(userRoles.organizationId, organizationId),
        eq(roles.type, 'personal') // Only personal roles
      ));

    // Query for teams with permissions on this resource
    const teamResults = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        action: permissions.action
      })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .innerJoin(teams, eq(teams.id, roles.teamId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(rolePermissions.resourceType, resourceType),
        eq(rolePermissions.resourceId, resourceId),
        eq(rolePermissions.resourceScope, 'specific'),
        eq(teams.organizationId, organizationId),
        eq(roles.type, 'team') // Only team roles
      ));

    // Aggregate permissions by user
    const userMap = new Map<string, { name: string; permissions: Set<string> }>();
    for (const row of userResults) {
      const key = row.userId;
      if (!userMap.has(key)) {
        userMap.set(key, { name: row.userName || 'Unknown User', permissions: new Set() });
      }
      userMap.get(key)!.permissions.add(row.action);
    }

    // Aggregate permissions by team
    const teamMap = new Map<number, { name: string; permissions: Set<string> }>();
    for (const row of teamResults) {
      const key = row.teamId;
      if (!teamMap.has(key)) {
        teamMap.set(key, { name: row.teamName, permissions: new Set() });
      }
      teamMap.get(key)!.permissions.add(row.action);
    }

    // Convert to AccessEntry format
    const accessList: AccessEntry[] = [
      ...Array.from(userMap.entries()).map(([id, data]) => ({
        id,
        type: 'user' as const,
        name: data.name,
        permissions: Array.from(data.permissions)
      })),
      ...Array.from(teamMap.entries()).map(([id, data]) => ({
        id: id.toString(),
        type: 'team' as const,
        name: data.name,
        permissions: Array.from(data.permissions)
      }))
    ];

    return {
      success: true,
      data: accessList
    };
  } catch (error) {
    console.error('[getResourceAccessList] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch access list'
    };
  }
}
