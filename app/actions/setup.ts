'use server'

import { db } from "@/lib/db/client";
import { organizations, roles, users, userOrganizations } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./types";

interface SetupData {
  organizationName: string;
  organizationMission?: string;
}

export async function createOrganization(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  const name = formData.get("organizationName") as string;
  const mission = formData.get("organizationMission") as string | null;

  if (!name) {
    return { success: false, error: "Organization name is required" };
  }

  try {
    const [newOrg] = await db
      .insert(organizations)
      .values({ name, mission })
      .returning();

    await db.insert(userOrganizations).values({
      userId: user.id,
      organizationId: newOrg.id,
      role: "owner",
    });

    await db
      .update(users)
      .set({ currentOrganizationId: newOrg.id })
      .where(eq(users.id, user.id));

    revalidatePath("/");
    return { success: true, data: newOrg };
  } catch (error) {
    console.error("Failed to create organization:", error);
    return { success: false, error: "Failed to create organization." };
  }
}

export async function checkSetupStatus(): Promise<{ needsSetup: boolean; isFirstUser: boolean }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { needsSetup: false, isFirstUser: false };
    }
    return {
      needsSetup: session.user.needsSetup || false,
      isFirstUser: session.user.isFirstUser || false,
    };
  } catch (error) {
    console.error("Error checking setup status:", error);
    return { needsSetup: false, isFirstUser: false };
  }
}
