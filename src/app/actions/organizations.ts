"use server";

import { getOrganizationRepository } from "@/ddd/application/di/container";
// import { getOrganizationRepository } from "@/lib/application/di/container";
import { revalidatePath } from "next/cache";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import { requireResourcePermission } from "./permissions";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result } from "./types";

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

/**
 * Update organization settings (model configuration, billing, etc.)
 * Requires organizations:manage permission for the specified organization
 */
export async function updateOrganizationSettings(data: {
  organizationId: number;
  defaultModel?: string | null;
  tokenQuotaMonthly?: number | null;
  availableModels?: string[];
}): Promise<Result> {
  return withAuthContext(async () => {
    try {
      // Check permission to manage organization settings
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        data.organizationId
      );

      const orgRepo = getOrganizationRepository();

      // Update organization with billing/model configuration fields
      const updatedOrg = await orgRepo.update(
        OrganizationId.fromNumber(data.organizationId),
        {
          defaultModel: data.defaultModel,
          tokenQuotaMonthly: data.tokenQuotaMonthly,
          availableModels: data.availableModels,
        }
      );

      // Revalidate the usage settings page
      revalidatePath('/settings/usage');

      return {
        success: true,
        data: {
          id: updatedOrg.id.value,
          defaultModel: updatedOrg.defaultModel,
          tokenQuotaMonthly: updatedOrg.tokenQuotaMonthly,
          availableModels: updatedOrg.availableModels,
        }
      };
    } catch (error) {
      console.error("Failed to update organization settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save settings"
      };
    }
  });
}
