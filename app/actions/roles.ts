'use server'

import { db } from "@/lib/db/client";
import { roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult, CreateRoleData } from "./types";

export async function createRole(data: CreateRoleData): Promise<ActionResult> {
  try {
    const { name, permissions, organizationId } = data;

    if (!name || !permissions || permissions.length === 0) {
      return {
        success: false,
        error: "Role name and permissions are required",
      };
    }

    const [newRole] = await db.insert(roles).values({
      name,
      permissions,
      organizationId,
    }).returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newRole,
    };
  } catch (error) {
    console.error("Error creating role:", error);
    return {
      success: false,
      error: "Failed to create role",
    };
  }
}

export async function createRoleAction(formData: FormData) {
  const name = formData.get('name') as string;
  const permissionsStr = formData.get('permissions') as string;
  
  const permissions = permissionsStr ? permissionsStr.split(',').map(p => p.trim()) : [];

  const result = await createRole({ name, permissions });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getRoles() {
  try {
    const allRoles = await db
      .select()
      .from(roles);

    return allRoles;
  } catch (error) {
    console.error("Error fetching roles:", error);
    throw new Error("Failed to fetch roles");
  }
}

export async function getRole(roleId: number) {
  try {
    if (!roleId) {
      throw new Error("roleId is required");
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    return role;
  } catch (error) {
    console.error("Error fetching role:", error);
    throw new Error("Failed to fetch role");
  }
}

export async function updateRole(roleId: number, data: Partial<CreateRoleData>): Promise<ActionResult> {
  try {
    if (!roleId) {
      return {
        success: false,
        error: "roleId is required",
      };
    }

    const [updatedRole] = await db
      .update(roles)
      .set(data)
      .where(eq(roles.id, roleId))
      .returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedRole,
    };
  } catch (error) {
    console.error("Error updating role:", error);
    return {
      success: false,
      error: "Failed to update role",
    };
  }
}

export async function deleteRole(roleId: number): Promise<ActionResult> {
  try {
    if (!roleId) {
      return {
        success: false,
        error: "roleId is required",
      };
    }

    await db.delete(roles).where(eq(roles.id, roleId));

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Role deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting role:", error);
    return {
      success: false,
      error: "Failed to delete role",
    };
  }
}