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
import { getViewApplicationService } from "@/ddd/application/di/container"
import { ViewId } from "@/ddd/domain/views/value-objects/view-id"
import { FilterConfig } from "@/ddd/domain/views/value-objects/filter-config"
import { PaginationConfig } from "@/ddd/domain/views/value-objects/pagination-config"
import type { PuckResolveContext } from "@/components/puck/types/puck-context"

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
      pageState: pageRecord.pageState,
      pageDialogs: pageRecord.pageDialogs,
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

/**
 * Substitute filter variables like {params.user_id} with values from context
 * Used by executePublicView for dynamic filtering
 */
function substituteFilterVariable(
  value: string | number | boolean | null | undefined,
  context?: PuckResolveContext
): string | number | boolean | null | undefined {
  if (typeof value !== 'string') {
    return value;
  }

  // Match {params.varName} pattern - full match
  const paramMatch = value.match(/^\{params\.(\w+)\}$/);
  if (paramMatch && context) {
    const paramName = paramMatch[1];
    const paramValue = context[paramName];
    if (paramValue !== undefined) {
      // Return the param value, handling arrays by taking first element
      if (Array.isArray(paramValue)) {
        return paramValue[0] ?? '';
      }
      return paramValue;
    }
    // Variable not found in context - return empty string
    return '';
  }

  // For partial substitutions (e.g., "prefix_{params.id}_suffix"), do inline replacement
  if (value.includes('{params.') && context) {
    return value.replace(/\{params\.(\w+)\}/g, (_, name) => {
      const paramValue = context[name];
      return paramValue !== undefined ? String(paramValue) : '';
    });
  }

  return value;
}

/**
 * Execute a view for public pages without authentication
 *
 * SECURITY: This function validates that the page is published before executing.
 * It's designed for public page rendering where user authentication may not be present.
 *
 * @param viewId - The view ID to execute
 * @param pageId - The page ID (used to verify the page is published)
 * @param context - Optional context for dynamic filtering (query params, etc.)
 * @param pagination - Optional pagination override
 * @param additionalFilters - Optional runtime filters with variable substitution support
 */
export async function executePublicView(
  viewId: number,
  pageId: number,
  context?: PuckResolveContext,
  pagination?: { pageSize: number; offset: number },
  additionalFilters?: Array<{ field: string; operator: string; value: unknown }>
): Promise<{
  rows: Array<Record<string, unknown>>;
  fields: Array<{ id: number; name: string; type: string }>;
  totalCount: number;
  pageSize: number;
  offset: number;
} | null> {
  try {
    if (!viewId || !pageId) {
      console.warn('[executePublicView] Missing viewId or pageId');
      return null;
    }

    // 1. Verify the page is published
    const pageRecord = await db.query.pages.findFirst({
      where: and(
        eq(pages.id, pageId),
        eq(pages.isPublic, true)
      )
    });

    if (!pageRecord) {
      console.warn('[executePublicView] Page not found or not published:', pageId);
      return null;
    }

    // 2. Get view service and execute
    const viewService = getViewApplicationService();

    // Get the view first to access its tableId for field lookup
    const viewResult = await viewService.getView(ViewId.fromNumber(viewId));
    if (!viewResult.success || !viewResult.data) {
      console.error('[executePublicView] Failed to get view:', viewResult.error);
      return null;
    }
    const view = viewResult.data;

    // 3. Build runtime filters if provided
    let runtimeFilters: FilterConfig[] | undefined;
    let rowIdFilter: { operator: 'eq' | 'ne'; value: string } | undefined;

    if (additionalFilters && additionalFilters.length > 0) {
      // Fetch fields to convert field names to IDs
      // Pass viaViewId so RLS can check public access via fields_public_via_view policy
      const { getFields } = await import('./fields');
      const fields = await getFields(view.tableId.value, { viaViewId: viewId });
      const fieldNameToIdMap = new Map(fields.map(f => [f.name, f.id]));

      // Operator mapping
      const uiToDomainOperatorMap: Record<string, string> = {
        'eq': 'equals',
        'ne': 'not_equals',
        'ilike': 'contains',
        'like': 'contains',
        'gt': 'greater_than',
        'gte': 'greater_than_or_equal',
        'lt': 'less_than',
        'lte': 'less_than_or_equal',
        'is_null': 'is_empty',
        'is_not_null': 'is_not_empty',
      };

      runtimeFilters = [];
      for (const filter of additionalFilters) {
        // Substitute variables in the filter value first
        const substitutedValue = substituteFilterVariable(filter.value as string, context);

        // Skip filters where variable wasn't found (empty string)
        if (substitutedValue === '') {
          console.warn(`[executePublicView] Variable in filter for field "${filter.field}" not found in context, skipping`);
          continue;
        }

        // Handle 'id' field specially - bypass FilterConfig (which requires fieldId > 0)
        // The synthetic 'id' field has fieldId=0, so we use rowIdFilter instead
        if (filter.field === 'id') {
          const op = filter.operator === 'ne' ? 'ne' : 'eq';
          rowIdFilter = { operator: op, value: String(substitutedValue) };
          continue;
        }

        const fieldId = fieldNameToIdMap.get(filter.field);
        if (fieldId === undefined) {
          console.warn(`[executePublicView] Field "${filter.field}" not found, skipping filter`);
          continue;
        }

        const domainOperator = uiToDomainOperatorMap[filter.operator] || filter.operator;

        runtimeFilters.push(
          FilterConfig.create({
            fieldId,
            operator: domainOperator as Parameters<typeof FilterConfig.create>[0]['operator'],
            value: substitutedValue,
          })
        );
      }
    }

    // 4. Execute the view with optional pagination and filters
    const result = await viewService.executeView({
      dataSourceId: ViewId.fromNumber(viewId),
      overridePagination: pagination
        ? PaginationConfig.create(pagination)
        : undefined,
      additionalFilters: runtimeFilters,
      rowIdFilter,
    });

    if (!result.success || !result.data) {
      console.error('[executePublicView] Failed to execute view:', result.error);
      return null;
    }

    // 5. Get the schema
    const schemaResult = await viewService.getViewSchema(ViewId.fromNumber(viewId));

    if (!schemaResult.success || !schemaResult.data) {
      console.error('[executePublicView] Failed to get view schema:', schemaResult.error);
      return null;
    }

    const fields = schemaResult.data;

    // Convert Row entities to plain objects with field IDs as keys
    // (useFieldValue looks up by fieldId, e.g., rowData["42"])
    const plainRows = result.data.rows.map((row) => row.toPlainObject(fields));

    // Convert TableField VOs to plain objects
    const plainFields = fields.map((field) => ({
      id: field.id.value,
      name: field.name,
      type: field.type,
    }));

    return {
      rows: plainRows,
      fields: plainFields,
      totalCount: result.data.totalCount,
      pageSize: result.data.pageSize,
      offset: result.data.offset,
    };
  } catch (error) {
    console.error('[executePublicView] Error:', error);
    return null;
  }
}
