"use server"

// AIDEV-NOTE: Server Actions for Puck page management using PuckPageApplicationService
// Handles CRUD operations, publishing, and content updates for Puck pages

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requirePermission } from "./permissions"
import { getPuckPageApplicationService } from "@/ddd/application/di/container"
import { ActionError, type Result } from "@/lib/puck/errors"

import { UserId } from "@/ddd/domain/shared/value-objects"
import { PageId } from "@/ddd/domain/puck/value-objects/page-id"
import { AppId } from "@/ddd/domain/puck/value-objects/app-id"
import { PuckPageMapper, type PageDTO } from "@/app/mappers/puck-page-mapper"
import type { ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config"

const createPageSchema = z.object({
  appId: z.number(),
  name: z.string().min(1, "Page name is required").optional(),
  slug: z.string().min(1, "Page slug is required").regex(
    /^[a-z0-9-]+$/,
    "Slug must contain only lowercase letters, numbers, and hyphens"
  ).optional(),
  description: z.string().optional(),
  templateData: z.any().optional(), // Puck JSON structure
})

const updatePageSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Page name is required").optional(),
  slug: z.string().regex(
    /^[a-z0-9-]+$/,
    "Slug must contain only lowercase letters, numbers, and hyphens"
  ).optional(),
  description: z.string().optional(),
  requiresAuth: z.boolean().optional(),
  allowedRoles: z.array(z.string()).optional(),
})

const updatePageContentSchema = z.object({
  id: z.number(),
  templateData: z.any(), // Puck JSON structure - required for content updates
})

const reorderPagesSchema = z.object({
  appId: z.number(),
  pageOrders: z.array(z.object({
    pageId: z.number(),
    order: z.number()
  }))
})

/**
 * Get all pages for an app
 */
export async function getPages(appId: number): Promise<Result<PageDTO[]>> {
  try {
    await requirePermission("apps:view");

    if (!appId) {
      return {
        success: false,
        error: ActionError.validation(['App ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const pages = await pageService.getPagesByApp(AppId.fromNumber(appId));

    return {
      success: true,
      data: PuckPageMapper.toDTOs(pages)
    };
  } catch (error) {
    console.error('[getPages] Error:', error);
    return {
      success: false,
      error: ActionError.database('fetch pages'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Get published pages for an app (for public rendering)
 */
export async function getPublishedPages(appId: number): Promise<Result<PageDTO[]>> {
  try {
    // Note: Published pages are publicly accessible, no auth required
    if (!appId) {
      return {
        success: false,
        error: ActionError.validation(['App ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const pages = await pageService.getPublishedPages(AppId.fromNumber(appId));

    return {
      success: true,
      data: PuckPageMapper.toDTOs(pages)
    };
  } catch (error) {
    console.error('[getPublishedPages] Error:', error);
    return {
      success: false,
      error: ActionError.database('fetch published pages'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Get a single page by ID
 */
export async function getPage(id: number): Promise<Result<PageDTO>> {
  try {
    await requirePermission("apps:view");

    if (!id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPage(PageId.fromNumber(id));

    if (!page) {
      return {
        success: false,
        error: ActionError.notFound('Page', id),
        errorCode: 'NOT_FOUND'
      };
    }

    return {
      success: true,
      data: PuckPageMapper.toDTO(page)
    };
  } catch (error) {
    console.error('[getPage] Error:', error);
    return {
      success: false,
      error: ActionError.database('fetch page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Get a page by slug within an app
 */
export async function getPageBySlug(appId: number, slug: string): Promise<Result<PageDTO>> {
  try {
    // Note: Public pages are accessible without auth, but we'll check permissions for consistency
    await requirePermission("apps:view");

    if (!appId || !slug) {
      return {
        success: false,
        error: ActionError.validation(['App ID and slug required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPageBySlug(AppId.fromNumber(appId), slug);

    if (!page) {
      return {
        success: false,
        error: ActionError.notFound('Page', slug),
        errorCode: 'NOT_FOUND'
      };
    }

    return {
      success: true,
      data: PuckPageMapper.toDTO(page)
    };
  } catch (error) {
    console.error('[getPageBySlug] Error:', error);
    return {
      success: false,
      error: ActionError.database('fetch page by slug'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Create a new Puck page
 * If name/slug not provided, creates "Untitled Page" with auto-generated slug
 */
export async function createPage(data: z.infer<typeof createPageSchema>, revalidateUrl?: string): Promise<Result<PageDTO>> {
  try {
    const session = await requirePermission("apps:create");

    const validatedData = createPageSchema.parse(data);
    const pageService = getPuckPageApplicationService();

    // Generate defaults if not provided
    const name = validatedData.name || "Untitled Page";
    let slug = validatedData.slug;

    if (!slug) {
      const slugResult = await pageService.generateSlugFromName(
        AppId.fromNumber(validatedData.appId),
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

    const result = await pageService.createPage({
      appId: AppId.fromNumber(validatedData.appId),
      name,
      slug,
      description: validatedData.description,
      templateData: validatedData.templateData,
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('create page'),
        errorCode: 'DATABASE'
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath(`/apps/${validatedData.appId}`) // Default path for app pages
    }

    return {
      success: true,
      data: result.data ? PuckPageMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('[createPage] Error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: ActionError.validation(error.errors.map(e => e.message)),
        errorCode: 'VALIDATION'
      };
    }

    return {
      success: false,
      error: ActionError.database('create page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Update page metadata (not content)
 */
export async function updatePage(data: z.infer<typeof updatePageSchema>, revalidateUrl?: string): Promise<Result<PageDTO>> {
  try {
    await requirePermission("apps:manage");

    const validatedData = updatePageSchema.parse(data);

    if (!validatedData.id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();

    const result = await pageService.updatePage({
      id: PageId.fromNumber(validatedData.id),
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description,
      requiresAuth: validatedData.requiresAuth,
      allowedRoles: validatedData.allowedRoles
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('update page'),
        errorCode: 'DATABASE'
      };
    }

    // No revalidatePath() needed - page settings managed in client-side state
    // The page will fetch fresh data on next navigation/refresh

    return {
      success: true,
      data: result.data ? PuckPageMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('[updatePage] Error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: ActionError.validation(error.errors.map(e => e.message)),
        errorCode: 'VALIDATION'
      };
    }

    return {
      success: false,
      error: ActionError.database('update page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Update page content (Puck template data)
 */
export async function updatePageContent(data: z.infer<typeof updatePageContentSchema>, revalidateUrl?: string): Promise<Result<PageDTO>> {
  try {
    await requirePermission("apps:manage");

    const validatedData = updatePageContentSchema.parse(data);

    if (!validatedData.id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();

    const result = await pageService.updatePageContent({
      id: PageId.fromNumber(validatedData.id),
      templateData: validatedData.templateData
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('update page content'),
        errorCode: 'DATABASE'
      };
    }

    // Only revalidate if explicitly requested (prevents unnecessary page reloads during editing)
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    }

    return {
      success: true,
      data: result.data ? PuckPageMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('[updatePageContent] Error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: ActionError.validation(error.errors.map(e => e.message)),
        errorCode: 'VALIDATION'
      };
    }

    return {
      success: false,
      error: ActionError.database('update page content'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Publish a page (make it publicly visible)
 */
export async function publishPage(id: number, revalidateUrl?: string): Promise<Result<PageDTO>> {
  try {
    await requirePermission("apps:publish");

    if (!id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.publishPage(PageId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('publish page'),
        errorCode: 'DATABASE'
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps') // Default path
    }

    return {
      success: true,
      data: result.data ? PuckPageMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('[publishPage] Error:', error);
    return {
      success: false,
      error: ActionError.database('publish page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Unpublish a page (make it a draft)
 */
export async function unpublishPage(id: number, revalidateUrl?: string): Promise<Result<PageDTO>> {
  try {
    await requirePermission("apps:publish");

    if (!id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.unpublishPage(PageId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('unpublish page'),
        errorCode: 'DATABASE'
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps') // Default path
    }

    return {
      success: true,
      data: result.data ? PuckPageMapper.toDTO(result.data) : undefined
    };
  } catch (error) {
    console.error('[unpublishPage] Error:', error);
    return {
      success: false,
      error: ActionError.database('unpublish page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Delete a page
 */
export async function deletePage(id: number, revalidateUrl?: string): Promise<Result<{ message: string }>> {
  try {
    await requirePermission("apps:manage");

    if (!id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.deletePage(PageId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('delete page'),
        errorCode: 'DATABASE'
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath('/apps') // Default path
    }

    return {
      success: true,
      data: { message: "Page deleted successfully" }
    };
  } catch (error) {
    console.error('[deletePage] Error:', error);
    return {
      success: false,
      error: ActionError.database('delete page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Reorder pages within an app
 */
export async function reorderPages(data: z.infer<typeof reorderPagesSchema>, revalidateUrl?: string): Promise<Result<{ message: string }>> {
  try {
    await requirePermission("apps:manage");

    const validatedData = reorderPagesSchema.parse(data);

    if (!validatedData.appId) {
      return {
        success: false,
        error: ActionError.validation(['App ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();

    const result = await pageService.reorderPages({
      appId: AppId.fromNumber(validatedData.appId),
      pageOrders: validatedData.pageOrders
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || ActionError.database('reorder pages'),
        errorCode: 'DATABASE'
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath(`/apps/${validatedData.appId}`) // Default path
    }

    return {
      success: true,
      data: { message: "Pages reordered successfully" }
    };
  } catch (error) {
    console.error('[reorderPages] Error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: ActionError.validation(error.errors.map(e => e.message)),
        errorCode: 'VALIDATION'
      };
    }

    return {
      success: false,
      error: ActionError.database('reorder pages'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Build navigation structure for an app
 */
export async function buildNavigation(appId: number, publishedOnly: boolean = false): Promise<Result<unknown>> {
  try {
    // Navigation is publicly accessible for published pages
    if (!publishedOnly) {
      await requirePermission("data:view");
    }

    if (!appId) {
      return {
        success: false,
        error: ActionError.validation(['App ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const navigation = await pageService.buildNavigation(AppId.fromNumber(appId), publishedOnly);

    return {
      success: true,
      data: navigation
    };
  } catch (error) {
    console.error('[buildNavigation] Error:', error);
    return {
      success: false,
      error: ActionError.database('build navigation'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Generate a unique slug from a page name
 */
export async function generatePageSlug(appId: number, name: string): Promise<Result<{ slug: string }>> {
  try {
    await requirePermission("apps:view");

    if (!appId || !name) {
      return {
        success: false,
        error: ActionError.validation(['App ID and name required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.generateSlugFromName(AppId.fromNumber(appId), name);

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
    console.error('[generatePageSlug] Error:', error);
    return {
      success: false,
      error: ActionError.database('generate slug'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Get page count for an app
 */
export async function getPageCount(appId: number): Promise<Result<number>> {
  try {
    await requirePermission("apps:view");

    if (!appId) {
      return {
        success: false,
        error: ActionError.validation(['App ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();
    const count = await pageService.countPages(AppId.fromNumber(appId));

    return {
      success: true,
      data: count
    };
  } catch (error) {
    console.error('[getPageCount] Error:', error);
    return {
      success: false,
      error: ActionError.database('fetch page count'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Duplicate an existing page
 * Appends " (Copy)" to the page name and generates a new slug
 */
export async function duplicatePage(id: number, revalidateUrl?: string): Promise<Result<PageDTO>> {
  try {
    const session = await requirePermission("apps:create");

    if (!id) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();

    // Get the original page
    const originalPage = await pageService.getPage(PageId.fromNumber(id));
    if (!originalPage) {
      return {
        success: false,
        error: ActionError.notFound('Page', id),
        errorCode: 'NOT_FOUND'
      };
    }

    // Create new name with " (Copy)" suffix
    const newName = `${originalPage.name} (Copy)`;

    // Generate unique slug for the copy
    const slugResult = await pageService.generateSlugFromName(
      originalPage.appId,
      newName
    );
    if (!slugResult.success) {
      return {
        success: false,
        error: ActionError.database('generate slug for duplicate'),
        errorCode: 'DATABASE'
      };
    }

    // Create the duplicated page
    const result = await pageService.createPage({
      appId: originalPage.appId,
      name: newName,
      slug: slugResult.data!,
      description: originalPage.description,
      templateData: originalPage.templateData,
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || ActionError.database('duplicate page'),
        errorCode: 'DATABASE'
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl)
    } else {
      revalidatePath(`/apps/${originalPage.appId.value}`)
    }

    return {
      success: true,
      data: PuckPageMapper.toDTO(result.data)
    };
  } catch (error) {
    console.error('[duplicatePage] Error:', error);
    return {
      success: false,
      error: ActionError.database('duplicate page'),
      errorCode: 'DATABASE'
    };
  }
}

/**
 * Update page theme configuration override
 * Pass undefined/null to clear the override and use app theme
 */
export async function updatePageTheme(
  pageId: number,
  themeConfig: ThemeConfigProps | undefined
): Promise<Result<PageDTO>> {
  try {
    await requirePermission("apps:manage");

    if (!pageId) {
      return {
        success: false,
        error: ActionError.validation(['ID required']),
        errorCode: 'VALIDATION'
      };
    }

    const pageService = getPuckPageApplicationService();

    // Get the page
    const page = await pageService.getPage(PageId.fromNumber(pageId));
    if (!page) {
      return {
        success: false,
        error: ActionError.notFound('Page', pageId),
        errorCode: 'NOT_FOUND'
      };
    }

    // Update theme
    page.updateTheme(themeConfig);

    // Save the page using repository
    const { getPuckPageRepository } = await import("@/ddd/application/di/container");
    const pageRepository = getPuckPageRepository();
    const updatedPage = await pageRepository.update(page);

    // No revalidatePath() needed - theme is managed in client-side state
    // The page will fetch fresh data on next navigation/refresh

    return {
      success: true,
      data: PuckPageMapper.toDTO(updatedPage)
    };
  } catch (error) {
    console.error('[updatePageTheme] Error:', error);
    return {
      success: false,
      error: ActionError.database('update page theme'),
      errorCode: 'DATABASE'
    };
  }
}
