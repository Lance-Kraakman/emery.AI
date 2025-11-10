"use server"

// AIDEV-NOTE: Server Actions for Puck app management using PuckAppApplicationService
// Handles CRUD operations for Puck visual page builder apps

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requirePermission } from "./permissions"
import { requireCurrentOrganization } from "./user-organizations"
import { getAppApplicationService } from "@/ddd/application/di/container"
import type { Result } from "./types"

import { OrganizationId, UserId } from "@/ddd/domain/shared/value-objects"
import { AppId } from "@/ddd/domain/puck/value-objects/app-id"
import { AppMapper, type AppDTO } from "@/app/mappers/puck-app-mapper"

const createAppSchema = z.object({
  name: z.string().min(1, "App name is required").optional(),
  slug: z.string().min(1, "App slug is required").regex(
    /^[a-z][a-z0-9-]*[a-z0-9]$/,
    "Slug must start with a letter, contain only lowercase letters, numbers, and hyphens, and end with a letter or number"
  ).optional(),
  description: z.string().optional(),
})

const updateAppSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "App name is required").optional(),
  slug: z.string().regex(
    /^[a-z][a-z0-9-]*[a-z0-9]$/,
    "Slug must start with a letter, contain only lowercase letters, numbers, and hyphens, and end with a letter or number"
  ).optional(),
  description: z.string().optional(),
})

/**
 * Get all apps for the current organization
 */
export async function getApps(): Promise<AppDTO[]> {
  try {
    // Check session first
    const session = await auth();
    if (!session?.user) {
      console.log('[getApps] No session found');
      return [];
    }

    // Then check permission
    await requirePermission("apps:view");
    const currentOrg = await requireCurrentOrganization();

    const appService = getAppApplicationService();
    const apps = await appService.getAppsByOrganization(OrganizationId.fromNumber(currentOrg.id));

    return AppMapper.toDTOs(apps);
  } catch (error) {
    console.error('Error fetching Puck apps:', error)
    // Return empty array instead of throwing to prevent page crash
    return []
  }
}

/**
 * Get a single app by ID
 */
export async function getApp(id: number): Promise<AppDTO> {
  try {
    const session = await requirePermission("apps:view");

    if (!id) {
      throw new Error("App ID is required");
    }

    const appService = getAppApplicationService();
    const app = await appService.getApp(AppId.fromNumber(id));

    if (!app) {
      throw new Error("App not found");
    }

    return AppMapper.toDTO(app);
  } catch (error) {
    console.error('Error fetching Puck app:', error)
    throw new Error('Failed to fetch Puck app')
  }
}

/**
 * Get an app by slug
 */
export async function getAppBySlug(slug: string): Promise<AppDTO> {
  try {
    const session = await requirePermission("apps:view");
    const currentOrg = await requireCurrentOrganization();

    if (!slug) {
      throw new Error("App slug is required");
    }

    const appService = getAppApplicationService();
    const app = await appService.getAppBySlug(OrganizationId.fromNumber(currentOrg.id), slug);

    if (!app) {
      throw new Error("App not found");
    }

    return AppMapper.toDTO(app);
  } catch (error) {
    console.error('Error fetching Puck app by slug:', error);
    throw new Error('Failed to fetch Puck app by slug');
  }
}

/**
 * Get an app with its page count
 */
export async function getAppWithPages(id: number) {
  try {
    const session = await requirePermission("apps:view");

    if (!id) {
      throw new Error("App ID is required");
    }

    const appService = getAppApplicationService();
    const result = await appService.getAppWithPages(AppId.fromNumber(id));

    if (!result) {
      throw new Error("App not found");
    }

    return {
      app: AppMapper.toDTO(result.app),
      pageCount: result.pageCount
    };
  } catch (error) {
    console.error('Error fetching Puck app with pages:', error)
    throw new Error('Failed to fetch Puck app with pages')
  }
}

/**
 * Create a new Puck app
 * If no data is provided, creates a default "Untitled App" with auto-generated slug
 */
export async function createApp(data?: z.infer<typeof createAppSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:create");
    const currentOrg = await requireCurrentOrganization();

    const validatedData = createAppSchema.parse(data || {});
    const appService = getAppApplicationService();

    // Generate defaults if not provided
    const name = validatedData.name || "Untitled App";
    let slug = validatedData.slug;

    if (!slug) {
      const slugResult = await appService.generateSlugFromName(
        OrganizationId.fromNumber(currentOrg.id),
        name
      );
      if (!slugResult.success) {
        return { success: false, error: "Failed to generate slug" };
      }
      slug = slugResult.data!;
    }

    const result = await appService.createApp({
      name,
      slug,
      description: validatedData.description,
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create app"
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps') // Default path for Puck apps
    }

    return {
      success: true,
      data: result.data ? AppMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('Error creating Puck app:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to create app" }
  }
}

/**
 * Update an existing Puck app
 */
export async function updateApp(data: z.infer<typeof updateAppSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    const validatedData = updateAppSchema.parse(data);

    if (!validatedData.id) {
      return { success: false, error: "App ID is required" };
    }

    const appService = getAppApplicationService();

    const result = await appService.updateApp({
      id: AppId.fromNumber(validatedData.id),
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update app"
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps') // Default path for Puck apps
    }

    return {
      success: true,
      data: result.data ? AppMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('Error updating Puck app:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to update app" }
  }
}

/**
 * Delete a Puck app (cascades to all pages)
 */
export async function deleteApp(id: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    if (!id) {
      return { success: false, error: "App ID is required" };
    }

    const appService = getAppApplicationService();
    const result = await appService.deleteApp(AppId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete app"
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps') // Default path for Puck apps
    }

    return {
      success: true,
      data: { message: "App deleted successfully" }
    };
  } catch (error) {
    console.error('Error deleting Puck app:', error)
    return { success: false, error: "Failed to delete app" }
  }
}

/**
 * Generate a unique slug from an app name
 */
export async function generateAppSlug(name: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:view");
    const currentOrg = await requireCurrentOrganization();

    if (!name) {
      return { success: false, error: "App name is required" };
    }

    const appService = getAppApplicationService();
    const result = await appService.generateSlugFromName(OrganizationId.fromNumber(currentOrg.id), name);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to generate slug"
      };
    }

    return {
      success: true,
      data: { slug: result.data }
    };
  } catch (error) {
    console.error('Error generating app slug:', error)
    return { success: false, error: "Failed to generate slug" }
  }
}

/**
 * Get app count for the current organization
 */
export async function getAppCount() {
  try {
    const session = await requirePermission("apps:view");
    const currentOrg = await requireCurrentOrganization();

    const appService = getAppApplicationService();
    return await appService.countApps(OrganizationId.fromNumber(currentOrg.id));
  } catch (error) {
    console.error('Error fetching app count:', error);
    throw new Error('Failed to fetch app count');
  }
}

/**
 * Duplicate an existing app with all its pages
 * Appends " (Copy)" to the app name and generates a new slug
 */
export async function duplicateApp(id: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:create");
    const currentOrg = await requireCurrentOrganization();

    if (!id) {
      return { success: false, error: "App ID is required" };
    }

    const appService = getAppApplicationService();

    // Get the original app
    const originalApp = await appService.getApp(AppId.fromNumber(id));
    if (!originalApp) {
      return { success: false, error: "App not found" };
    }

    // Create new name with " (Copy)" suffix
    const newName = `${originalApp.name} (Copy)`;

    // Generate unique slug for the copy
    const slugResult = await appService.generateSlugFromName(
      OrganizationId.fromNumber(currentOrg.id),
      newName
    );
    if (!slugResult.success) {
      return { success: false, error: "Failed to generate slug for duplicate" };
    }

    // Create the duplicated app
    const result = await appService.createApp({
      name: newName,
      slug: slugResult.data!,
      description: originalApp.description,
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to duplicate app"
      };
    }

    // Import pages service
    const { getPuckPageApplicationService } = await import("@/ddd/application/di/container");
    const pageService = getPuckPageApplicationService();

    // Get all pages from the original app
    const pages = await pageService.getPagesByApp(AppId.fromNumber(id));

    // Duplicate each page
    for (const page of pages) {
      await pageService.createPage({
        appId: AppId.fromNumber(result.data.id.value),
        name: page.name,
        slug: page.slug.value, // Extract the value from PageSlug value object
        description: page.description,
        templateData: page.templateData,
        createdBy: UserId.fromString(session.user.id)
      });
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps')
    }

    return {
      success: true,
      data: AppMapper.toDTO(result.data)
    };
  } catch (error) {
    console.error('Error duplicating app:', error)
    return { success: false, error: "Failed to duplicate app" }
  }
}

/**
 * Update app theme configuration
 */
export async function updateAppTheme(
  appId: number,
  themeConfig: any
): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    if (!appId) {
      return { success: false, error: "App ID is required" };
    }

    const appService = getAppApplicationService();

    // Get the app
    const app = await appService.getApp(AppId.fromNumber(appId));
    if (!app) {
      return { success: false, error: "App not found" };
    }

    // Update theme
    app.updateTheme(themeConfig);

    // Save the app using repository
    const { getAppRepository } = await import("@/ddd/application/di/container");
    const appRepository = getAppRepository();
    const updatedApp = await appRepository.update(app);

    // Revalidate app routes
    revalidatePath(`/apps/${appId}`);
    revalidatePath(`/p/${app.slug.value}`);

    return {
      success: true,
      data: AppMapper.toDTO(updatedApp)
    };
  } catch (error) {
    console.error('Error updating app theme:', error);
    return { success: false, error: "Failed to update app theme" };
  }
}
