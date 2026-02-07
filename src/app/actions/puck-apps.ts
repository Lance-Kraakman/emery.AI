"use server"

// AIDEV-NOTE: Server Actions for Puck app management using PuckAppApplicationService
// Handles CRUD operations for Puck visual page builder apps

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission, requireResourcePermission } from "./permissions"
import { requireCurrentOrganization } from "./user-organizations"
import { getAppApplicationService } from "@/ddd/application/di/container"
import { ActionError, type Result, type ErrorCode } from "@/lib/puck/errors"

import { OrganizationId, UserId } from "@/ddd/domain/shared/value-objects"
import { AppId } from "@/ddd/domain/puck/value-objects/app-id"
import { AppMapper, type AppDTO } from "@/app/mappers/puck-app-mapper"
import type { ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config"

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
export async function getApps(): Promise<Result<AppDTO[]>> {
  return withAuthContext(async () => {
    try {
      // Check session first
      const session = await auth();
      if (!session?.user) {
        console.log('[getApps] No session found');
        return {
          success: false,
          error: ActionError.permission('view apps'),
          errorCode: 'PERMISSION'
        };
      }

      // Then check permission
      await requirePermission("apps:view");
      const currentOrg = await requireCurrentOrganization();

      const appService = getAppApplicationService();
      const apps = await appService.getAppsByOrganization(OrganizationId.fromNumber(currentOrg.id));

      return {
        success: true,
        data: AppMapper.toDTOs(apps)
      };
    } catch (error) {
      console.error('[getApps] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch apps'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Get a single app by ID
 */
export async function getApp(id: number): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requireResourcePermission("apps:view", "app", id);

      const appService = getAppApplicationService();
      const app = await appService.getApp(AppId.fromNumber(id));

      if (!app) {
        return {
          success: false,
          error: ActionError.notFound('App', id),
          errorCode: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        data: AppMapper.toDTO(app)
      };
    } catch (error) {
      console.error('[getApp] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch app'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Get an app by slug
 */
export async function getAppBySlug(slug: string): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
    try {
      await requirePermission("apps:view");
      const currentOrg = await requireCurrentOrganization();

      if (!slug) {
        return {
          success: false,
          error: ActionError.validation(['Slug required']),
          errorCode: 'VALIDATION'
        };
      }

      const appService = getAppApplicationService();
      const app = await appService.getAppBySlug(OrganizationId.fromNumber(currentOrg.id), slug);

      if (!app) {
        return {
          success: false,
          error: ActionError.notFound('App', slug),
          errorCode: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        data: AppMapper.toDTO(app)
      };
    } catch (error) {
      console.error('[getAppBySlug] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch app by slug'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Get an app with its page count
 */
export async function getAppWithPages(id: number): Promise<Result<{ app: AppDTO; pageCount: number }>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requireResourcePermission("apps:view", "app", id);

      const appService = getAppApplicationService();
      const result = await appService.getAppWithPages(AppId.fromNumber(id));

      if (!result) {
        return {
          success: false,
          error: ActionError.notFound('App', id),
          errorCode: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        data: {
          app: AppMapper.toDTO(result.app),
          pageCount: result.pageCount
        }
      };
    } catch (error) {
      console.error('[getAppWithPages] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch app with pages'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Create a new Puck app
 * If no data is provided, creates a default "Untitled App" with auto-generated slug
 */
export async function createApp(data?: z.infer<typeof createAppSchema>, revalidateUrl?: string): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
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
          return {
            success: false,
            error: ActionError.database('generate slug'),
            errorCode: 'DATABASE'
          };
        }
        slug = slugResult.data!;
      }

      const result = await appService.createApp({
        name,
        slug,
        description: validatedData.description,
        organizationId: OrganizationId.fromNumber(currentOrg.id),
        ownerId: UserId.fromString(session.user.id)
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || ActionError.database('create app'),
          errorCode: 'DATABASE'
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
      console.error('[createApp] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: ActionError.validation(error.errors.map(e => e.message)),
          errorCode: 'VALIDATION'
        };
      }

      return {
        success: false,
        error: ActionError.database('create app'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Update an existing Puck app
 */
export async function updateApp(data: z.infer<typeof updateAppSchema>, revalidateUrl?: string): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
    try {
      const validatedData = updateAppSchema.parse(data);

      if (!validatedData.id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requireResourcePermission("apps:manage", "app", validatedData.id);

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
          error: result.error || ActionError.database('update app'),
          errorCode: 'DATABASE'
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
      console.error('[updateApp] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: ActionError.validation(error.errors.map(e => e.message)),
          errorCode: 'VALIDATION'
        };
      }

      return {
        success: false,
        error: ActionError.database('update app'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Delete a Puck app (cascades to all pages)
 */
export async function deleteApp(id: number, revalidateUrl?: string): Promise<Result<{ message: string }>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requireResourcePermission("apps:manage", "app", id);

      const appService = getAppApplicationService();
      const result = await appService.deleteApp(AppId.fromNumber(id));

      if (!result.success) {
        return {
          success: false,
          error: result.error || ActionError.database('delete app'),
          errorCode: 'DATABASE'
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
      console.error('[deleteApp] Error:', error);
      return {
        success: false,
        error: ActionError.database('delete app'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Generate a unique slug from an app name
 */
export async function generateAppSlug(name: string): Promise<Result<{ slug: string }>> {
  return withAuthContext(async () => {
    try {
      await requirePermission("apps:view");
      const currentOrg = await requireCurrentOrganization();

      if (!name) {
        return {
          success: false,
          error: ActionError.validation(['Name required']),
          errorCode: 'VALIDATION'
        };
      }

      const appService = getAppApplicationService();
      const result = await appService.generateSlugFromName(OrganizationId.fromNumber(currentOrg.id), name);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || ActionError.database('generate slug'),
          errorCode: 'DATABASE'
        };
      }

      return {
        success: true,
        data: { slug: result.data }
      };
    } catch (error) {
      console.error('[generateAppSlug] Error:', error);
      return {
        success: false,
        error: ActionError.database('generate slug'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Get app count for the current organization
 */
export async function getAppCount(): Promise<Result<number>> {
  return withAuthContext(async () => {
    try {
      await requirePermission("apps:view");
      const currentOrg = await requireCurrentOrganization();

      const appService = getAppApplicationService();
      const count = await appService.countApps(OrganizationId.fromNumber(currentOrg.id));

      return {
        success: true,
        data: count
      };
    } catch (error) {
      console.error('[getAppCount] Error:', error);
      return {
        success: false,
        error: ActionError.database('fetch app count'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Duplicate an existing app with all its pages
 * Appends " (Copy)" to the app name and generates a new slug
 */
export async function duplicateApp(id: number, revalidateUrl?: string): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
    try {
      if (!id) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      // Need to view the original app to duplicate it
      await requireResourcePermission("apps:view", "app", id);
      // Need create permission for the new app
      const session = await requirePermission("apps:create");
      const currentOrg = await requireCurrentOrganization();

    const appService = getAppApplicationService();

    // Get the original app
    const originalApp = await appService.getApp(AppId.fromNumber(id));
    if (!originalApp) {
      return {
        success: false,
        error: ActionError.notFound('App', id),
        errorCode: 'NOT_FOUND'
      };
    }

    // Create new name with " (Copy)" suffix
    const newName = `${originalApp.name} (Copy)`;

    // Generate unique slug for the copy
    const slugResult = await appService.generateSlugFromName(
      OrganizationId.fromNumber(currentOrg.id),
      newName
    );
    if (!slugResult.success) {
      return {
        success: false,
        error: ActionError.database('generate slug for duplicate'),
        errorCode: 'DATABASE'
      };
    }

    // Create the duplicated app
    const result = await appService.createApp({
      name: newName,
      slug: slugResult.data!,
      description: originalApp.description,
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      ownerId: UserId.fromString(session.user.id)
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || ActionError.database('duplicate app'),
        errorCode: 'DATABASE'
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
        ownerId: UserId.fromString(session.user.id)
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
      console.error('[duplicateApp] Error:', error);
      return {
        success: false,
        error: ActionError.database('duplicate app'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Update app theme configuration
 */
export async function updateAppTheme(
  appId: number,
  themeConfig: ThemeConfigProps | undefined
): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
    try {
      if (!appId) {
        return {
          success: false,
          error: ActionError.validation(['ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requireResourcePermission("apps:manage", "app", appId);

      const appService = getAppApplicationService();

      // Get the app
      const app = await appService.getApp(AppId.fromNumber(appId));
      if (!app) {
        return {
          success: false,
          error: ActionError.notFound('App', appId),
          errorCode: 'NOT_FOUND'
        };
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
      console.error('[updateAppTheme] Error:', error);
      return {
        success: false,
        error: ActionError.database('update app theme'),
        errorCode: 'DATABASE'
      };
    }
  });
}

/**
 * Set the home page for an app
 */
export async function setAppHomePage(
  appId: number,
  pageId: number | null,
  revalidateUrl?: string
): Promise<Result<AppDTO>> {
  return withAuthContext(async () => {
    try {
      if (!appId) {
        return {
          success: false,
          error: ActionError.validation(['App ID required']),
          errorCode: 'VALIDATION'
        };
      }

      await requireResourcePermission("apps:manage", "app", appId);

      const appService = getAppApplicationService();

      // Get the app
      const app = await appService.getApp(AppId.fromNumber(appId));
      if (!app) {
        return {
          success: false,
          error: ActionError.notFound('App', appId),
          errorCode: 'NOT_FOUND'
        };
      }

      // Set the home page
      const { PageId } = await import("@/ddd/domain/puck/value-objects/page-id");
      app.setHomePage(pageId ? PageId.fromNumber(pageId) : undefined);

      // Save the app using repository
      const { getAppRepository } = await import("@/ddd/application/di/container");
      const appRepository = getAppRepository();
      const updatedApp = await appRepository.update(app);

      // Revalidate app routes
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      }
      revalidatePath(`/apps/${appId}`);
      revalidatePath(`/public/${app.organizationId.value}/${app.slug.value}`);

      return {
        success: true,
        data: AppMapper.toDTO(updatedApp)
      };
    } catch (error) {
      console.error('[setAppHomePage] Error:', error);
      return {
        success: false,
        error: ActionError.database('set app home page'),
        errorCode: 'DATABASE'
      };
    }
  });
}
