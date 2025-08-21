'use server'

import { auth, hasPermission as authHasPermission } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./types";
import type { UpdateUserData } from "@/lib/domain/entities/user";
import { getUserRepository } from "@/lib/application/di/container";

export async function assignUserRole(userId: string, roleId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const hasAccess = await authHasPermission(session.user.id, "manage_users");
    if (!hasAccess) {
      return {
        success: false,
        error: "Permission denied: manage_users required",
      };
    }

    const userRepo = getUserRepository();
    const updatedUser = await userRepo.update(userId, { roleId });

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedUser,
    };
  } catch (error) {
    console.error("Error assigning user role:", error);
    return {
      success: false,
      error: "Failed to assign user role",
    };
  }
}

export async function updateUserProfile(userId: string, data: UpdateUserData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    if (session.user.id !== userId) {
      const hasAccess = await authHasPermission(session.user.id, "manage_users");
      if (!hasAccess) {
        return {
          success: false,
          error: "Permission denied: can only update own profile or need manage_users permission",
        };
      }
    }

    const userRepo = getUserRepository();
    const updatedUser = await userRepo.update(userId, data);

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedUser,
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: "Failed to update user profile",
    };
  }
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const userQuery = await db
      .select({
        user: users,
        role: roles,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    const user = userQuery[0];
    return user?.role?.permissions || [];
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

export async function hasPermission(permission: string): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return false;
    }

    return await authHasPermission(session.user.id, permission);
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Authentication required");
  }
  return session;
}

export async function requirePermission(permission: string) {
  const session = await requireAuth();
  const hasAccess = await authHasPermission(session.user.id, permission);
  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return session;
}