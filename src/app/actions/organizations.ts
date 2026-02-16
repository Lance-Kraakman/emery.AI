"use server";

import { getOrganizationRepository } from "@/ddd/application/di/container";
// import { getOrganizationRepository } from "@/lib/application/di/container";
import { revalidatePath } from "next/cache";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import { requireResourcePermission } from "./permissions";
import { withAuthContext } from '@/lib/auth/with-context';
import { auth } from '@/lib/auth';
import type { Result } from "./types";
import type { OrgChartCanvasMetadata } from '@/components/org-chart/types';

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required

export async function updateOrganizationViewConfig(organizationId: number, viewConfig: any, shouldRevalidate: boolean = false) {
  return withAuthContext(async () => {
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
  });
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

      // Revalidate the system settings page
      revalidatePath('/settings/system');

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

/**
 * Save org chart canvas metadata (sticky notes, positions, expanded states)
 * Stores in organization.viewConfig.orgChartCanvas
 */
export async function saveOrgChartCanvasMetadata(
  canvasMetadata: OrgChartCanvasMetadata
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.currentOrganizationId) {
        return { success: false, error: "Not authenticated" };
      }

      const organizationId = session.user.currentOrganizationId;
      const orgRepo = getOrganizationRepository();

      // Get current org to preserve other viewConfig properties
      const org = await orgRepo.findById(OrganizationId.fromNumber(organizationId));
      if (!org) {
        return { success: false, error: "Organization not found" };
      }

      // Merge canvas metadata into viewConfig
      const updatedViewConfig = {
        ...org.viewConfig,
        orgChartCanvas: canvasMetadata,
      };

      await orgRepo.update(OrganizationId.fromNumber(organizationId), {
        viewConfig: updatedViewConfig,
      });

      // Don't revalidate to prevent reload loops during auto-save
      return { success: true };
    } catch (error) {
      console.error("Failed to save org chart canvas metadata:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save canvas metadata"
      };
    }
  });
}

/**
 * Get organization settings for the current organization
 * Used by settings/system/page.tsx Server Component
 */
export interface OrganizationSettingsDTO {
  id: number;
  plan: string | null;
  defaultModel: string | null;
  availableModels: string[];
}

export async function getOrganizationSettings(): Promise<Result<OrganizationSettingsDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.currentOrganizationId) {
        return { success: false, error: "Not authenticated" };
      }

      const organizationId = session.user.currentOrganizationId;
      const orgRepo = getOrganizationRepository();

      const org = await orgRepo.findById(OrganizationId.fromNumber(organizationId));
      if (!org) {
        return { success: false, error: "Organization not found" };
      }

      return {
        success: true,
        data: {
          id: org.id.value,
          plan: org.plan || null,
          defaultModel: org.defaultModel || null,
          availableModels: org.availableModels || [],
        }
      };
    } catch (error) {
      console.error("Failed to get organization settings:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get organization settings"
      };
    }
  });
}

/**
 * Get org chart canvas metadata from organization.viewConfig
 */
export async function getOrgChartCanvasMetadata(): Promise<Result<OrgChartCanvasMetadata | null>> {
  return withAuthContext(async () => {
    try {
      const session = await auth();
      if (!session?.user?.currentOrganizationId) {
        return { success: false, error: "Not authenticated" };
      }

      const organizationId = session.user.currentOrganizationId;
      const orgRepo = getOrganizationRepository();

      const org = await orgRepo.findById(OrganizationId.fromNumber(organizationId));
      if (!org) {
        return { success: false, error: "Organization not found" };
      }

      const canvasMetadata = org.viewConfig?.orgChartCanvas as OrgChartCanvasMetadata | undefined;
      return { success: true, data: canvasMetadata ?? null };
    } catch (error) {
      console.error("Failed to get org chart canvas metadata:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get canvas metadata"
      };
    }
  });
}
