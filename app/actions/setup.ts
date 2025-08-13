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

async function createStandardRoles(organizationId: number) {
  const standardRoles = [
    {
      name: 'Super Admin',
      permissions: [
        'create_table',
        'manage_tables',
        'create_fields',
        'manage_fields',
        'manage_data',
        'manage_users',
        'manage_teams',
        'manage_agents',
        'view_agents',
        'manage_organization'
      ],
      organizationId: organizationId,
    },
    {
      name: 'Admin',
      permissions: [
        'create_table',
        'manage_tables',
        'create_fields',
        'manage_fields',
        'manage_data',
        'manage_users',
        'manage_teams'
      ],
      organizationId: organizationId,
    },
    {
      name: 'Editor',
      permissions: [
        'create_table',
        'create_fields',
        'manage_data'
      ],
      organizationId: organizationId,
    },
    {
      name: 'Viewer',
      permissions: [
        'manage_data' // Read-only data access
      ],
      organizationId: organizationId,
    }
  ];

  const insertedRoles = await db.insert(roles).values(standardRoles).returning();
  const superAdminRole = insertedRoles.find(role => role.name === 'Super Admin');
  if (!superAdminRole) {
    throw new Error("Super Admin role not created");
  }
  return superAdminRole;
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

    const superAdminRole = await createStandardRoles(newOrg.id);
    console.log("Created roles for organization:", newOrg.id);


    await db.insert(userOrganizations).values({
      userId: user.id,
      organizationId: newOrg.id,
      role: "owner",
    });

    await db
      .update(users)
      .set({
        currentOrganizationId: newOrg.id,
        roleId: superAdminRole.id
      })
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
