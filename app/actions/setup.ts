'use server'

import { getOrganizationRepository } from "@/ddd/application/di/container";
import type { CreateOrganizationData } from "./types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./types";

// Import the DI setup to ensure container is initialized
import "@/ddd/application/di/setup";

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
    const orgRepo = getOrganizationRepository();
    
    const orgData: CreateOrganizationData = {
      name,
      mission: mission || undefined
    };

    // Use the repository's createWithOwner method which handles:
    // - Organization creation
    // - Default role creation  
    // - User-organization relationship
    // - Setting user's current organization
    // All in a single atomic transaction
    const newOrg = await orgRepo.createWithOwner(orgData, user.id);

    console.log("Created organization with owner:", newOrg.id);

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
