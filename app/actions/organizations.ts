'use server'

import { db } from "@/lib/db/client";
import { organizations, users, userOrganizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import type { ActionResult, CreateOrganizationData } from "./types";

export async function createOrganization(data: CreateOrganizationData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const { name, mission, sharedTools } = data;

    if (!name) {
      return {
        success: false,
        error: "Organization name is required",
      };
    }

    // Create organization
    const [newOrganization] = await db.insert(organizations).values({
      name,
      mission,
      sharedTools,
    }).returning();

    // Add creator as owner of the organization
    await db.insert(userOrganizations).values({
      userId: session.user.id,
      organizationId: newOrganization.id,
      role: 'owner',
    });

    // If user doesn't have a current organization, set this as current
    if (!session.user.currentOrganizationId) {
      await db
        .update(users)
        .set({ currentOrganizationId: newOrganization.id })
        .where(eq(users.id, session.user.id));
    }

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newOrganization,
    };
  } catch (error) {
    console.error("Error creating organization:", error);
    return {
      success: false,
      error: "Failed to create organization",
    };
  }
}

export async function createOrganizationAction(formData: FormData) {
  const name = formData.get('name') as string;
  const mission = formData.get('mission') as string;
  const sharedToolsStr = formData.get('sharedTools') as string;
  
  const sharedTools = sharedToolsStr ? sharedToolsStr.split(',').map(t => t.trim()) : undefined;

  const result = await createOrganization({ name, mission, sharedTools });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getOrganizations() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Not authenticated");
    }

    // Return only organizations the user is a member of
    const userOrgs = await db
      .select({
        organization: organizations,
        userOrg: userOrganizations
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, session.user.id));

    return userOrgs.map(uo => ({
      ...uo.organization,
      userRole: uo.userOrg.role
    }));
  } catch (error) {
    console.error("Error fetching organizations:", error);
    throw new Error("Failed to fetch organizations");
  }
}

export async function getOrganization(organizationId: number) {
  try {
    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    return organization;
  } catch (error) {
    console.error("Error fetching organization:", error);
    throw new Error("Failed to fetch organization");
  }
}

export async function updateOrganization(organizationId: number, data: Partial<CreateOrganizationData>): Promise<ActionResult> {
  try {
    if (!organizationId) {
      return {
        success: false,
        error: "organizationId is required",
      };
    }

    const [updatedOrganization] = await db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, organizationId))
      .returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedOrganization,
    };
  } catch (error) {
    console.error("Error updating organization:", error);
    return {
      success: false,
      error: "Failed to update organization",
    };
  }
}

export async function deleteOrganization(organizationId: number): Promise<ActionResult> {
  try {
    if (!organizationId) {
      return {
        success: false,
        error: "organizationId is required",
      };
    }

    await db.delete(organizations).where(eq(organizations.id, organizationId));

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Organization deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting organization:", error);
    return {
      success: false,
      error: "Failed to delete organization",
    };
  }
}