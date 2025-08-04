'use server'

import { db } from "@/lib/db/client";
import { databaseAcl, tableAcl, roles, users, teams, workers } from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult, GrantPermissionData } from "./types";

export async function grantPermission(data: GrantPermissionData): Promise<ActionResult> {
  try {
    const { resourceType, resourceId, principalType, principalId, roleId } = data;

    if (!resourceType || !resourceId || !principalType || !principalId || !roleId) {
      return {
        success: false,
        error: "All permission fields are required",
      };
    }

    let newPermission;
    
    if (resourceType === 'database') {
      [newPermission] = await db.insert(databaseAcl).values({
        databaseId: resourceId,
        principalType,
        principalId,
        roleId,
      }).returning();
    } else if (resourceType === 'table') {
      [newPermission] = await db.insert(tableAcl).values({
        tableId: resourceId,
        principalType,
        principalId,
        roleId,
      }).returning();
    } else {
      return {
        success: false,
        error: "Invalid resource type",
      };
    }

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newPermission,
    };
  } catch (error) {
    console.error("Error granting permission:", error);
    return {
      success: false,
      error: "Failed to grant permission",
    };
  }
}

export async function revokePermission(resourceType: 'database' | 'table', permissionId: number): Promise<ActionResult> {
  try {
    if (!resourceType || !permissionId) {
      return {
        success: false,
        error: "resourceType and permissionId are required",
      };
    }

    if (resourceType === 'database') {
      await db.delete(databaseAcl).where(eq(databaseAcl.id, permissionId));
    } else if (resourceType === 'table') {
      await db.delete(tableAcl).where(eq(tableAcl.id, permissionId));
    } else {
      return {
        success: false,
        error: "Invalid resource type",
      };
    }

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Permission revoked successfully" },
    };
  } catch (error) {
    console.error("Error revoking permission:", error);
    return {
      success: false,
      error: "Failed to revoke permission",
    };
  }
}

export async function getResourcePermissions(resourceType: 'database' | 'table', resourceId: number) {
  try {
    if (!resourceType || !resourceId) {
      throw new Error("resourceType and resourceId are required");
    }

    let permissions;
    
    if (resourceType === 'database') {
      permissions = await db
        .select({
          id: databaseAcl.id,
          principalType: databaseAcl.principalType,
          principalId: databaseAcl.principalId,
          role: roles,
        })
        .from(databaseAcl)
        .leftJoin(roles, eq(databaseAcl.roleId, roles.id))
        .where(eq(databaseAcl.databaseId, resourceId));
    } else {
      permissions = await db
        .select({
          id: tableAcl.id,
          principalType: tableAcl.principalType,
          principalId: tableAcl.principalId,
          role: roles,
        })
        .from(tableAcl)
        .leftJoin(roles, eq(tableAcl.roleId, roles.id))
        .where(eq(tableAcl.tableId, resourceId));
    }

    return permissions;
  } catch (error) {
    console.error("Error fetching resource permissions:", error);
    throw new Error("Failed to fetch resource permissions");
  }
}

export async function hasPermission(
  principalType: 'user' | 'team' | 'worker',
  principalId: string,
  resourceType: 'database' | 'table',
  resourceId: number,
  permission: string
): Promise<boolean> {
  try {
    if (!principalType || !principalId || !resourceType || !resourceId || !permission) {
      return false;
    }

    let userTeamIds: number[] = [];
    
    if (principalType === 'user') {
      const userTeams = await db
        .select({ teamId: teams.id })
        .from(teams)
        .leftJoin(users, eq(users.organizationId, teams.organizationId))
        .where(eq(users.id, principalId));
      
      userTeamIds = userTeams.map(t => t.teamId);
    }

    let aclTable = resourceType === 'database' ? databaseAcl : tableAcl;
    let resourceColumn = resourceType === 'database' ? databaseAcl.databaseId : tableAcl.tableId;

    const directPermissions = await db
      .select({ permissions: roles.permissions })
      .from(aclTable)
      .leftJoin(roles, eq(aclTable.roleId, roles.id))
      .where(
        and(
          eq(resourceColumn, resourceId),
          or(
            and(
              eq(aclTable.principalType, principalType),
              eq(aclTable.principalId, principalId)
            ),
            principalType === 'user' && userTeamIds.length > 0 ? 
              and(
                eq(aclTable.principalType, 'team'),
                inArray(aclTable.principalId, userTeamIds.map(id => id.toString()))
              ) : undefined
          )
        )
      );

    const hasDirectPermission = directPermissions.some(p => 
      p.permissions && p.permissions.includes(permission)
    );

    return hasDirectPermission;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

export async function getEffectivePermissions(
  principalType: 'user' | 'team' | 'worker',
  principalId: string,
  resourceType: 'database' | 'table',
  resourceId: number
): Promise<string[]> {
  try {
    if (!principalType || !principalId || !resourceType || !resourceId) {
      return [];
    }

    let userTeamIds: number[] = [];
    
    if (principalType === 'user') {
      const userTeams = await db
        .select({ teamId: teams.id })
        .from(teams)
        .leftJoin(users, eq(users.organizationId, teams.organizationId))
        .where(eq(users.id, principalId));
      
      userTeamIds = userTeams.map(t => t.teamId);
    }

    let aclTable = resourceType === 'database' ? databaseAcl : tableAcl;
    let resourceColumn = resourceType === 'database' ? databaseAcl.databaseId : tableAcl.tableId;

    const allPermissions = await db
      .select({ permissions: roles.permissions })
      .from(aclTable)
      .leftJoin(roles, eq(aclTable.roleId, roles.id))
      .where(
        and(
          eq(resourceColumn, resourceId),
          or(
            and(
              eq(aclTable.principalType, principalType),
              eq(aclTable.principalId, principalId)
            ),
            principalType === 'user' && userTeamIds.length > 0 ? 
              and(
                eq(aclTable.principalType, 'team'),
                inArray(aclTable.principalId, userTeamIds.map(id => id.toString()))
              ) : undefined
          )
        )
      );

    const effectivePermissions = new Set<string>();
    
    allPermissions.forEach(p => {
      if (p.permissions) {
        p.permissions.forEach(permission => effectivePermissions.add(permission));
      }
    });

    return Array.from(effectivePermissions);
  } catch (error) {
    console.error("Error getting effective permissions:", error);
    return [];
  }
}