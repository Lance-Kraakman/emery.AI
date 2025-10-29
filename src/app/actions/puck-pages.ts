"use server"

// AIDEV-NOTE: Server Actions for Puck page management using PuckPageApplicationService
// Handles CRUD operations, publishing, and content updates for Puck pages

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requirePermission } from "./permissions"
import { getPuckPageApplicationService } from "@/ddd/application/di/container"
import type { Result } from "./types"

import { UserId } from "@/ddd/domain/shared/value-objects"
import { PageId } from "@/ddd/domain/puck/value-objects/page-id"
import { AppId } from "@/ddd/domain/puck/value-objects/app-id"
import { PuckPageMapper, type PageDTO } from "@/app/mappers/puck-page-mapper"

const createPageSchema = z.object({
  appId: z.number(),
  name: z.string().min(1, "Page name is required"),
  slug: z.string().min(1, "Page slug is required").regex(
    /^\/[a-z0-9-\/]*[a-z0-9]$/,
    "Slug must start with /, contain only lowercase letters, numbers, hyphens, and forward slashes, and end with a letter or number"
  ),
  description: z.string().optional(),
  templateData: z.any().optional(), // Puck JSON structure
})

const updatePageSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Page name is required").optional(),
  slug: z.string().regex(
    /^\/[a-z0-9-\/]*[a-z0-9]$/,
    "Slug must start with /, contain only lowercase letters, numbers, hyphens, and forward slashes, and end with a letter or number"
  ).optional(),
  description: z.string().optional(),
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
export async function getPages(appId: number): Promise<PageDTO[]> {
  try {
    const session = await requirePermission("apps:view");

    if (!appId) {
      throw new Error("App ID is required");
    }

    const pageService = getPuckPageApplicationService();
    const pages = await pageService.getPagesByApp(AppId.fromNumber(appId));

    return PuckPageMapper.toDTOs(pages);
  } catch (error) {
    console.error('Error fetching Puck pages:', error)
    throw new Error('Failed to fetch Puck pages')
  }
}

/**
 * Get published pages for an app (for public rendering)
 */
export async function getPublishedPages(appId: number): Promise<PageDTO[]> {
  try {
    // Note: Published pages are publicly accessible, no auth required
    if (!appId) {
      throw new Error("App ID is required");
    }

    const pageService = getPuckPageApplicationService();
    const pages = await pageService.getPublishedPages(AppId.fromNumber(appId));

    return PuckPageMapper.toDTOs(pages);
  } catch (error) {
    console.error('Error fetching published Puck pages:', error)
    throw new Error('Failed to fetch published Puck pages')
  }
}

/**
 * Get a single page by ID
 */
export async function getPage(id: number): Promise<PageDTO> {
  try {
    const session = await requirePermission("apps:view");

    if (!id) {
      throw new Error("Page ID is required");
    }

    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPage(PageId.fromNumber(id));

    if (!page) {
      throw new Error("Page not found");
    }

    return PuckPageMapper.toDTO(page);
  } catch (error) {
    console.error('Error fetching Puck page:', error)
    throw new Error('Failed to fetch Puck page')
  }
}

/**
 * Get a page by slug within an app
 */
export async function getPageBySlug(appId: number, slug: string): Promise<PageDTO> {
  try {
    // Note: Public pages are accessible without auth, but we'll check permissions for consistency
    const session = await requirePermission("apps:view");

    if (!appId || !slug) {
      throw new Error("App ID and page slug are required");
    }

    const pageService = getPuckPageApplicationService();
    const page = await pageService.getPageBySlug(AppId.fromNumber(appId), slug);

    if (!page) {
      throw new Error("Page not found");
    }

    return PuckPageMapper.toDTO(page);
  } catch (error) {
    console.error('Error fetching Puck page by slug:', error);
    throw new Error('Failed to fetch Puck page by slug');
  }
}

/**
 * Create a new Puck page
 */
export async function createPage(data: z.infer<typeof createPageSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:create");

    const validatedData = createPageSchema.parse(data);

    const pageService = getPuckPageApplicationService();

    const result = await pageService.createPage({
      appId: AppId.fromNumber(validatedData.appId),
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description,
      templateData: validatedData.templateData,
      createdBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create page"
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
    console.error('Error creating Puck page:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to create page" }
  }
}

/**
 * Update page metadata (not content)
 */
export async function updatePage(data: z.infer<typeof updatePageSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    const validatedData = updatePageSchema.parse(data);

    if (!validatedData.id) {
      return { success: false, error: "Page ID is required" };
    }

    const pageService = getPuckPageApplicationService();

    const result = await pageService.updatePage({
      id: PageId.fromNumber(validatedData.id),
      name: validatedData.name,
      slug: validatedData.slug,
      description: validatedData.description
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update page"
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
    console.error('Error updating Puck page:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to update page" }
  }
}

/**
 * Update page content (Puck template data)
 */
export async function updatePageContent(data: z.infer<typeof updatePageContentSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    const validatedData = updatePageContentSchema.parse(data);

    if (!validatedData.id) {
      return { success: false, error: "Page ID is required" };
    }

    const pageService = getPuckPageApplicationService();

    const result = await pageService.updatePageContent({
      id: PageId.fromNumber(validatedData.id),
      templateData: validatedData.templateData
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update page content"
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
    console.error('Error updating Puck page content:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to update page content" }
  }
}

/**
 * Publish a page (make it publicly visible)
 */
export async function publishPage(id: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:publish");

    if (!id) {
      return { success: false, error: "Page ID is required" };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.publishPage(PageId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to publish page"
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
    console.error('Error publishing Puck page:', error)
    return { success: false, error: "Failed to publish page" }
  }
}

/**
 * Unpublish a page (make it a draft)
 */
export async function unpublishPage(id: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:publish");

    if (!id) {
      return { success: false, error: "Page ID is required" };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.unpublishPage(PageId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to unpublish page"
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
    console.error('Error unpublishing Puck page:', error)
    return { success: false, error: "Failed to unpublish page" }
  }
}

/**
 * Delete a page
 */
export async function deletePage(id: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    if (!id) {
      return { success: false, error: "Page ID is required" };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.deletePage(PageId.fromNumber(id));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete page"
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
    console.error('Error deleting Puck page:', error)
    return { success: false, error: "Failed to delete page" }
  }
}

/**
 * Reorder pages within an app
 */
export async function reorderPages(data: z.infer<typeof reorderPagesSchema>, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:manage");

    const validatedData = reorderPagesSchema.parse(data);

    if (!validatedData.appId) {
      return { success: false, error: "App ID is required" };
    }

    const pageService = getPuckPageApplicationService();

    const result = await pageService.reorderPages({
      appId: AppId.fromNumber(validatedData.appId),
      pageOrders: validatedData.pageOrders
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to reorder pages"
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
    console.error('Error reordering Puck pages:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input: " + error.errors.map(e => e.message).join(", ")
      }
    }

    return { success: false, error: "Failed to reorder pages" }
  }
}

/**
 * Build navigation structure for an app
 */
export async function buildNavigation(appId: number, publishedOnly: boolean = false) {
  try {
    // Navigation is publicly accessible for published pages
    if (!publishedOnly) {
      await requirePermission("data:view");
    }

    if (!appId) {
      throw new Error("App ID is required");
    }

    const pageService = getPuckPageApplicationService();
    return await pageService.buildNavigation(AppId.fromNumber(appId), publishedOnly);
  } catch (error) {
    console.error('Error building navigation:', error);
    throw new Error('Failed to build navigation');
  }
}

/**
 * Generate a unique slug from a page name
 */
export async function generatePageSlug(appId: number, name: string): Promise<Result> {
  try {
    const session = await requirePermission("apps:view");

    if (!appId || !name) {
      return { success: false, error: "App ID and page name are required" };
    }

    const pageService = getPuckPageApplicationService();
    const result = await pageService.generateSlugFromName(AppId.fromNumber(appId), name);

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
    console.error('Error generating page slug:', error)
    return { success: false, error: "Failed to generate slug" }
  }
}

/**
 * Get page count for an app
 */
export async function getPageCount(appId: number) {
  try {
    const session = await requirePermission("apps:view");

    if (!appId) {
      throw new Error("App ID is required");
    }

    const pageService = getPuckPageApplicationService();
    return await pageService.countPages(AppId.fromNumber(appId));
  } catch (error) {
    console.error('Error fetching page count:', error);
    throw new Error('Failed to fetch page count');
  }
}
