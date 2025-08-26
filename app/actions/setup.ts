'use server'

import { getOrganizationRepository } from "@/ddd/application/di/container";
import type { CreateOrganizationData } from "@/ddd/domain/organizations/entities/organization";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Result } from "./types";
import { OrganizationName, UserId } from "@/ddd/domain/shared/value-objects";

export async function createOrganization(formData: FormData): Promise<Result> {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return { success: false, error: "User  not authenticated" };
  }

  const name = formData.get("organizationName") as string;
  const mission = formData.get("organizationMission") as string | null;

  if (!name) {
    return { success: false, error: "Organization name is required" };
  }

  try {
    const orgRepo = getOrganizationRepository();
    
    const orgData: CreateOrganizationData = {
      name: OrganizationName.fromString(name),
      mission: mission || undefined
    };

    // Use the repository's createWithOwner method which handles:
    // - Organization creation
    // - Default role creation  
    // - User-organization relationship
    // - Setting user's current organization
    // All in a single atomic transaction
    const newOrg = await orgRepo.createWithOwner(orgData, UserId.fromString(user.id));

    console.log("Created organization with owner:", newOrg.id);

    // Serialize Value Objects for client components
    const serializedOrg = {
      id: newOrg.id.value,
      name: newOrg.name.value,
      mission: newOrg.mission,
      sharedTools: newOrg.sharedTools,
      sharedServers: newOrg.sharedServers,
      databaseId: newOrg.databaseId,
      viewConfig: newOrg.viewConfig,
      analysisCapabilities: newOrg.analysisCapabilities,
      plan: newOrg.plan,
      stripeCustomerId: newOrg.stripeCustomerId,
      stripeSubscriptionId: newOrg.stripeSubscriptionId,
      stripeSubscriptionStatus: newOrg.stripeSubscriptionStatus,
      createdAt: newOrg.createdAt
    };

    revalidatePath("/");
    return { success: true, data: serializedOrg };
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
