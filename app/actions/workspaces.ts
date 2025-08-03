'use server'

// AIDEV-NOTE: Server Actions for workspace management - replaces /api/workspaces route
// AIDEV-TODO: Add transaction support for complex workspace operations

import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult, CreateWorkspaceData } from "./types";

export async function createWorkspace(data: CreateWorkspaceData): Promise<ActionResult> {
  try {
    const { userId, name } = data;

    if (!userId || !name) {
      return {
        success: false,
        error: "userId and name are required",
      };
    }

    const [newWorkspace] = await db.insert(workspaces).values({
      userId,
      name,
    }).returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newWorkspace,
    };
  } catch (error) {
    console.error("Error creating workspace:", error);
    return {
      success: false,
      error: "Failed to create workspace",
    };
  }
}

export async function createWorkspaceAction(formData: FormData) {
  const userId = formData.get('userId') as string;
  const name = formData.get('name') as string;

  const result = await createWorkspace({ userId, name });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function getWorkspaces(userId: string) {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const userWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.userId, userId));

    return userWorkspaces;
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    throw new Error("Failed to fetch workspaces");
  }
}

export async function deleteWorkspace(workspaceId: number): Promise<ActionResult> {
  try {
    if (!workspaceId) {
      return {
        success: false,
        error: "workspaceId is required",
      };
    }

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Workspace deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return {
      success: false,
      error: "Failed to delete workspace",
    };
  }
}