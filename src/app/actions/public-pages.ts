"use server"

// AIDEV-NOTE: Server Actions for public Puck pages (no authentication required)
// Handles fetching published pages for public viewing

import { db } from "@/lib/db/client"
import { apps, pages, organizations, userRoles, roles } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { ActionError, type Result } from "@/lib/puck/errors"
import { PuckPageMapper, type PageDTO } from "@/app/mappers/puck-page-mapper"
import { AppMapper, type AppDTO } from "@/app/mappers/puck-app-mapper"
import { PuckPage } from "@/ddd/domain/puck/entities/puck-page"
import { App } from "@/ddd/domain/puck/entities/app"

/**
 * Get a public app by organization slug and app slug
 * No authentication required - only returns apps with public pages
 */
export async function getPublicApp(
  orgSlug: string,
  appSlug: string
): Promise<Result<AppDTO>> {
  try {
    if (!orgSlug || !appSlug) {
      return {
        success: false,
        error: ActionError.validation(['Organization slug and app slug are required']),
        errorCode: 'VALIDATION'
      };
    }

    // Find organization by slug
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug)
    });

    if (!org) {
      return {
        success: false,
        error: ActionError.notFound('Organization', orgSlug),
        errorCode: 'NOT_FOUND'
      };
    }

    // Find app by slug and organization
    const appRecord = await db.query.apps.findFirst({
      where: and(
        eq(apps.slug, appSlug),
        eq(apps.organizationId, org.id)
      )
    });

    if (!appRecord) {
      return {
        success: false,
        error: ActionError.notFound('App', appSlug),
        errorCode: 'NOT_FOUND'
      };
    }

    // Check if app has any public pages
    const publicPages = await db.query.pages.findMany({
      where: and(
        eq(pages.appId, appRecord.id),
        eq(pages.isPublic, true)
      )
    });

    if (publicPages.length === 0) {
      return {
        success: false,
        error: 'This app has no published pages',
        errorCode: 'NOT_FOUND'
      };
    }

    // Convert to domain entity and then to DTO
    const app = App.fromPersistence({
      id: appRecord.id,
      organizationId: appRecord.organizationId,
      name: appRecord.name,
      slug: appRecord.slug,
      description: appRecord.description,
      themeConfig: appRecord.themeConfig,
      homePageId: appRecord.homePageId ?? undefined,
      ownerId: appRecord.ownerId,
      createdAt: appRecord.createdAt,
      updatedAt: appRecord.updatedAt
    });

    // Fetch home page slug if homePageId is set
    let homePageSlug: string | undefined;
    if (appRecord.homePageId) {
      const homePageRecord = await db.query.pages.findFirst({
        where: eq(pages.id, appRecord.homePageId)
      });
      homePageSlug = homePageRecord?.slug;
    }

    const appDTO = AppMapper.toDTO(app);
    return {
      success: true,
      data: {
        ...appDTO,
        homePageSlug
      }
    };
  } catch (error) {
    console.error('[getPublicApp] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch app',
      errorCode: 'UNKNOWN'
    };
  }
}

/**
 * Get a public page by organization slug, app slug, and page slug
 * No authentication required - only returns public pages
 */
export async function getPublicPage(
  orgSlug: string,
  appSlug: string,
  pageSlug: string
): Promise<Result<PageDTO>> {
  try {
    if (!orgSlug || !appSlug || !pageSlug) {
      return {
        success: false,
        error: ActionError.validation(['Organization slug, app slug, and page slug are required']),
        errorCode: 'VALIDATION'
      };
    }

    // Find organization by slug
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug)
    });

    if (!org) {
      return {
        success: false,
        error: ActionError.notFound('Organization', orgSlug),
        errorCode: 'NOT_FOUND'
      };
    }

    // Find app by slug and organization
    const appRecord = await db.query.apps.findFirst({
      where: and(
        eq(apps.slug, appSlug),
        eq(apps.organizationId, org.id)
      )
    });

    if (!appRecord) {
      return {
        success: false,
        error: ActionError.notFound('App', appSlug),
        errorCode: 'NOT_FOUND'
      };
    }

    // Find page by slug and app
    const pageRecord = await db.query.pages.findFirst({
      where: and(
        eq(pages.slug, pageSlug),
        eq(pages.appId, appRecord.id),
        eq(pages.isPublic, true) // Only public pages
      )
    });

    if (!pageRecord) {
      return {
        success: false,
        error: ActionError.notFound('Page', pageSlug),
        errorCode: 'NOT_FOUND'
      };
    }

    // Convert to domain entity and then to DTO
    const page = PuckPage.fromPersistence({
      id: pageRecord.id,
      appId: pageRecord.appId,
      name: pageRecord.name,
      slug: pageRecord.slug,
      description: pageRecord.description,
      order: pageRecord.order,
      templateData: pageRecord.templateData,
      themeConfig: pageRecord.themeConfig,
      isPublic: pageRecord.isPublic,
      requiresAuth: pageRecord.requiresAuth,
      allowedRoles: pageRecord.allowedRoles,
      ownerId: pageRecord.ownerId,
      createdAt: pageRecord.createdAt,
      updatedAt: pageRecord.updatedAt
    });

    return {
      success: true,
      data: PuckPageMapper.toDTO(page)
    };
  } catch (error) {
    console.error('[getPublicPage] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch page',
      errorCode: 'UNKNOWN'
    };
  }
}

/**
 * Get user's roles for a specific app context
 * Used by PublicAppAuthProvider to check role-based access
 */
export async function getUserRolesForApp(
  orgSlug: string,
  userId: string
): Promise<string[]> {
  try {
    // Find organization by slug
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug)
    });

    if (!org) {
      console.warn('[getUserRolesForApp] Organization not found:', orgSlug);
      return [];
    }

    // Get user's roles in this organization
    const userRolesData = await db
      .select({
        roleName: roles.name
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(
        eq(userRoles.userId, userId),
        eq(userRoles.organizationId, org.id)
      ));

    return userRolesData.map((r: { roleName: string }) => r.roleName);
  } catch (error) {
    console.error('[getUserRolesForApp] Error:', error);
    return [];
  }
}

/**
 * Check if a user can access a published page
 * Validates authentication requirements and role-based access
 *
 * Returns:
 * - allowed: true if user can access
 * - redirectToLogin: true if user needs to sign in
 * - reason: explanation if access is denied
 */
export async function checkPageAccess(
  pageId: number,
  userId: string | null
): Promise<{ allowed: boolean; redirectToLogin: boolean; reason?: string }> {
  try {
    // Get page data
    const pageRecord = await db.query.pages.findFirst({
      where: eq(pages.id, pageId)
    });

    if (!pageRecord) {
      return { allowed: false, redirectToLogin: false, reason: 'Page not found' };
    }

    // Page must be published
    if (!pageRecord.isPublic) {
      return { allowed: false, redirectToLogin: false, reason: 'Page not published' };
    }

    // Public pages (no auth required)
    if (!pageRecord.requiresAuth) {
      return { allowed: true, redirectToLogin: false };
    }

    // Auth required but no user
    if (!userId) {
      return { allowed: false, redirectToLogin: true, reason: 'Authentication required' };
    }

    // No role restrictions = all authenticated users allowed
    if (!pageRecord.allowedRoles || pageRecord.allowedRoles.length === 0) {
      return { allowed: true, redirectToLogin: false };
    }

    // Check user roles
    const userRolesData = await db
      .select({
        roleName: roles.name
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    const userRoleNames = userRolesData.map((r: { roleName: string }) => r.roleName);
    const hasAllowedRole = pageRecord.allowedRoles.some((role: string) => userRoleNames.includes(role));

    if (!hasAllowedRole) {
      return {
        allowed: false,
        redirectToLogin: false,
        reason: 'Insufficient permissions. Required roles: ' + pageRecord.allowedRoles.join(', ')
      };
    }

    return { allowed: true, redirectToLogin: false };
  } catch (error) {
    console.error('[checkPageAccess] Error:', error);
    return { allowed: false, redirectToLogin: false, reason: 'Internal error' };
  }
}
