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

export async function setupInitialAdmin(data: SetupData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Check if this is the first user
    const allUsers = await db.select().from(users);
    const currentUser = allUsers.find(u => u.id === session.user.id);
    
    if (!currentUser) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Only allow setup if user has no organization/role OR is the only user
    if (currentUser.currentOrganizationId && currentUser.roleId && allUsers.length > 1) {
      return {
        success: false,
        error: "Initial setup already completed",
      };
    }

    const { organizationName, organizationMission } = data;

    if (!organizationName) {
      return {
        success: false,
        error: "Organization name is required",
      };
    }

    // Create the organization
    const [organization] = await db.insert(organizations).values({
      name: organizationName,
      mission: organizationMission || "Building the future with AI-human collaboration",
      sharedTools: ['tables', 'fields', 'data', 'teams', 'workers'],
    }).returning();

    // Create Super Admin role
    const [superAdminRole] = await db.insert(roles).values({
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
        'manage_organization'
      ],
      organizationId: organization.id,
    }).returning();

    // Create standard roles
    const [adminRole] = await db.insert(roles).values({
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
      organizationId: organization.id,
    }).returning();

    const [editorRole] = await db.insert(roles).values({
      name: 'Editor',
      permissions: [
        'create_table',
        'create_fields',
        'manage_data'
      ],
      organizationId: organization.id,
    }).returning();

    const [viewerRole] = await db.insert(roles).values({
      name: 'Viewer',
      permissions: [
        'manage_data' // Read-only data access
      ],
      organizationId: organization.id,
    }).returning();

    // Assign the current user as Super Admin
    await db.update(users)
      .set({
        currentOrganizationId: organization.id,
        roleId: superAdminRole.id,
      })
      .where(eq(users.id, session.user.id));

    // Add user to the organization as owner
    await db.insert(userOrganizations).values({
      userId: session.user.id,
      organizationId: organization.id,
      role: 'owner',
    });

    revalidatePath('/dashboard');
    revalidatePath('/setup');

    return {
      success: true,
      data: {
        organization,
        roles: [superAdminRole, adminRole, editorRole, viewerRole],
        message: "Initial setup completed successfully! You are now the Super Admin.",
      },
    };
  } catch (error) {
    console.error("Error in initial setup:", error);
    return {
      success: false,
      error: "Failed to complete initial setup",
    };
  }
}

export async function checkSetupStatus(): Promise<{ needsSetup: boolean; isFirstUser: boolean }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { needsSetup: false, isFirstUser: false };
    }

    const allUsers = await db.select().from(users);
    const currentUser = allUsers.find(u => u.id === session.user.id);
    
    const needsSetup = !currentUser?.currentOrganizationId || !currentUser?.roleId;
    const isFirstUser = allUsers.length === 1;

    return { needsSetup, isFirstUser };
  } catch (error) {
    console.error("Error checking setup status:", error);
    return { needsSetup: false, isFirstUser: false };
  }
}