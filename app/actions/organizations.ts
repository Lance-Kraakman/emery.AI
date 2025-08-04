'use server'

import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult, CreateOrganizationData } from "./types";

export async function createOrganization(data: CreateOrganizationData): Promise<ActionResult> {
  try {
    const { name, mission, sharedTools } = data;

    if (!name) {
      return {
        success: false,
        error: "Organization name is required",
      };
    }

    const [newOrganization] = await db.insert(organizations).values({
      name,
      mission,
      sharedTools,
    }).returning();

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
    const allOrganizations = await db
      .select()
      .from(organizations);

    return allOrganizations;
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