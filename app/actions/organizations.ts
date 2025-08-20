"use server";

import { getOrganizationRepository } from "@/lib/application/di/container";
import { revalidatePath } from "next/cache";

// Import the DI setup to ensure container is initialized
import "@/lib/application/di/setup";

export async function updateOrganizationViewConfig(organizationId: number, viewConfig: any) {
  try {
    const orgRepo = getOrganizationRepository();
    
    await orgRepo.update(organizationId, { viewConfig });

    revalidatePath(`/organization`);
    
    return { success: true };
  } catch (error) {
    console.error("Failed to update organization view config:", error);
    return { success: false, error: "Failed to update view configuration." };
  }
}
