'use server'

import { getOrganizationRepository } from "@/ddd/application/di/container";
import type { CreateOrganizationData } from "@/ddd/domain/organizations/entities/organization";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Result } from "./types";
import { OrganizationName, UserId } from "@/ddd/domain/shared/value-objects";
import { stripe } from "@/ddd/infrastructure/external/stripe/client";

export async function createOrganization(formData: FormData): Promise<Result> {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return { success: false, error: "User  not authenticated" };
  }

  const name = formData.get("organizationName") as string;
  const slug = formData.get("organizationSlug") as string;
  const mission = formData.get("organizationMission") as string | null;

  if (!name) {
    return { success: false, error: "Organization name is required" };
  }

  if (!slug) {
    return { success: false, error: "Organization slug is required" };
  }

  // Validate slug format server-side
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { success: false, error: "Slug can only contain lowercase letters, numbers, and hyphens" };
  }

  if (slug.length < 2 || slug.length > 50) {
    return { success: false, error: "Slug must be between 2 and 50 characters" };
  }

  try {
    const orgRepo = getOrganizationRepository();

    const orgData: CreateOrganizationData = {
      name: OrganizationName.fromString(name),
      slug: slug, // Use user-provided slug instead of auto-generating
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

    // Auto-create Stripe customer for new organization
    // AIDEV-NOTE: This is non-blocking - we log errors but don't fail signup
    try {
      if (stripe && !newOrg.stripeCustomerId) {
        console.log("Creating Stripe customer for organization:", newOrg.id.value);

        const customer = await stripe.customers.create({
          email: user.email!,
          name: newOrg.name.value,
          metadata: {
            organizationId: newOrg.id.value.toString(),
            organizationName: newOrg.name.value,
            userId: user.id,
          },
        });

        console.log("Created Stripe customer:", customer.id);

        // Update organization with Stripe customer ID (use updateRaw since user has no RLS context yet)
        await orgRepo.updateRaw(newOrg.id, {
          stripeCustomerId: customer.id
        });

        // Update local object for serialization
        newOrg.stripeCustomerId = customer.id;
      }
    } catch (stripeError) {
      // Log error but don't block organization creation
      console.error("Failed to create Stripe customer (non-blocking):", stripeError);
      // TODO: Consider adding to a retry queue for production
    }

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

    // Parse specific error types for better user messages
    if (error instanceof Error) {
      // Check for slug uniqueness error
      if (error.message.startsWith('SLUG_TAKEN:')) {
        const takenSlug = error.message.split(':')[1];
        // Suggest alternative slugs
        const suggestions = [
          `${takenSlug}-2`,
          `${takenSlug}-inc`,
          `${takenSlug}-corp`
        ].join(', ');

        return {
          success: false,
          error: `The slug "${takenSlug}" is already taken. Try one of these: ${suggestions}`
        };
      }
    }

    // Generic fallback error
    return { success: false, error: "Failed to create organization. Please try again." };
  }
}

export async function generateOrganizationSlug(name: string): Promise<Result<{ slug: string }>> {
  if (!name || name.trim().length === 0) {
    return { success: false, error: "Name is required to generate slug" };
  }

  try {
    // Generate base slug from name (lowercase, replace non-alphanumeric with hyphens)
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .replace(/--+/g, '-') // Replace consecutive hyphens with single hyphen
      .substring(0, 50); // Enforce max length

    // Validate the base slug format
    if (!baseSlug || !/^[a-z0-9-]+$/.test(baseSlug)) {
      return { success: false, error: "Could not generate a valid slug from the provided name" };
    }

    if (baseSlug.length < 2) {
      return { success: false, error: "Slug must be at least 2 characters" };
    }

    const orgRepo = getOrganizationRepository();

    // Check if base slug is available
    const baseExists = await orgRepo.existsBySlug(baseSlug);

    if (!baseExists) {
      return { success: true, data: { slug: baseSlug } };
    }

    // If base slug exists, try appending numbers
    for (let i = 2; i <= 100; i++) {
      const candidateSlug = `${baseSlug}-${i}`.substring(0, 50);

      if (!/^[a-z0-9-]+$/.test(candidateSlug)) {
        continue;
      }

      const exists = await orgRepo.existsBySlug(candidateSlug);

      if (!exists) {
        return { success: true, data: { slug: candidateSlug } };
      }
    }

    return {
      success: false,
      error: "Could not generate a unique slug after 100 attempts. Please try a different name."
    };
  } catch (error) {
    console.error("Error generating organization slug:", error);
    return { success: false, error: "Failed to generate slug" };
  }
}

export async function checkOrganizationSlugAvailability(slug: string): Promise<Result<{ available: boolean }>> {
  if (!slug) {
    return { success: false, error: "Slug is required" };
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { success: false, error: "Slug can only contain lowercase letters, numbers, and hyphens" };
  }

  if (slug.length < 2 || slug.length > 50) {
    return { success: false, error: "Slug must be between 2 and 50 characters" };
  }

  try {
    const orgRepo = getOrganizationRepository();
    const exists = await orgRepo.existsBySlug(slug);

    return { success: true, data: { available: !exists } };
  } catch (error) {
    console.error("Error checking slug availability:", error);
    return { success: false, error: "Failed to check slug availability" };
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
