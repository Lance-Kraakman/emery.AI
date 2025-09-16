"use server";

import { getOrganizationRepository } from "@/ddd/application/di/container";
// import { getOrganizationRepository } from "@/lib/application/di/container";
import { revalidatePath } from "next/cache";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required

export async function updateOrganizationViewConfig(organizationId: number, viewConfig: any, shouldRevalidate: boolean = false) {
  try {
    const orgRepo = getOrganizationRepository();

    await orgRepo.update(OrganizationId.fromNumber(organizationId), { viewConfig });

    // Only revalidate for explicit saves, not auto-saves to prevent reload loops
    if (shouldRevalidate) {
      revalidatePath(`/organization`);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update organization view config:", error);
    return { success: false, error: "Failed to update view configuration." };
  }
}
