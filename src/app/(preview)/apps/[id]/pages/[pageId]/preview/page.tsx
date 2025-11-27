/**
 * Preview Page - Client Component
 *
 * AIDEV-NOTE: Client component to support sessionStorage for previewing unsaved changes.
 * Checks sessionStorage first (unsaved editor state), falls back to database (saved state).
 * Calls resolveAllData on client to execute component resolveData functions.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { resolveAllData, type Data } from "@measured/puck";
import { config } from "@/components/puck/config";
import { getPage, getPages } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import { getCurrentOrganization } from "@/app/actions/user-organizations";
import { PreviewClient } from "./preview-client";
import { Loading } from "@/components/ui/loading";
import { ThemeConfig } from "@/ddd/domain/puck/value-objects/theme-config";
import { ThemeProvider } from "@/components/puck/theme-context";
import { LinkContextProvider } from "@/components/puck/link-context";
import { QueryParamProvider } from "@/components/puck/contexts/QueryParamContext";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { OrganizationDTO } from "@/app/mappers/organization-mapper";
import { PuckSession } from "@/lib/puck/session-storage";

export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = parseInt(params.pageId as string);
  const appId = parseInt(params.id as string);

  const [resolvedData, setResolvedData] = useState<Data | null>(null);
  const [pageName, setPageName] = useState<string>("");
  const [effectiveTheme, setEffectiveTheme] = useState<ThemeConfig | null>(null);
  const [app, setApp] = useState<AppDTO | null>(null);
  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [pages, setPages] = useState<PageDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Convert URLSearchParams to Record for QueryParamContext
  const queryParamsObject: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    const existing = queryParamsObject[key];
    if (existing) {
      // Multiple values for same key - convert to array
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        queryParamsObject[key] = [existing, value];
      }
    } else {
      queryParamsObject[key] = value;
    }
  });

  useEffect(() => {
    async function loadAndResolveData() {
      try {
        setLoading(true);

        // 1. Fetch app, organization, and pages for link resolution
        const [appResult, orgResult, pagesResult] = await Promise.all([
          getApp(appId),
          getCurrentOrganization(),
          getPages(appId)
        ]);

        if (!appResult.success || !appResult.data) {
          throw new Error("Failed to load app");
        }
        const appData = appResult.data;
        setApp(appData);
        setOrganization(orgResult);
        setPages(pagesResult.success && pagesResult.data ? pagesResult.data : []);

        // 2. Check sessionStorage first (unsaved changes from editor)
        const savedData = PuckSession.getData(pageId);
        let rawData: Data;
        let page: PageDTO;

        if (savedData) {
          console.log('[PreviewPage] Loading unsaved data from sessionStorage');
          rawData = savedData;
          // Still need page for name and theme
          const pageResult = await getPage(pageId);
          if (!pageResult.success || !pageResult.data) {
            throw new Error("Failed to load page");
          }
          page = pageResult.data;
          setPageName(page.name);
        } else {
          // 3. Fall back to database (saved state)
          console.log('[PreviewPage] Loading saved data from database');
          const pageResult = await getPage(pageId);
          if (!pageResult.success || !pageResult.data) {
            throw new Error("Failed to load page");
          }
          page = pageResult.data;
          rawData = page.templateData || { content: [], root: {}, zones: {} };
          setPageName(page.name);
        }

        // 4. Compute effective theme (page overrides app)
        const appTheme = appData.themeConfig
          ? ThemeConfig.create(appData.themeConfig)
          : ThemeConfig.default();

        const computedTheme = page.themeConfig
          ? ThemeConfig.merge(appTheme, ThemeConfig.create(page.themeConfig))
          : appTheme;

        setEffectiveTheme(computedTheme);

        // 5. Resolve all component data (calls resolveData functions)
        console.log('[PreviewPage] Resolving component data with query params:', queryParamsObject);
        const resolved = await resolveAllData(rawData, config, queryParamsObject);
        console.log('[PreviewPage] Data resolved, rendering...');

        setResolvedData(resolved);
      } catch (error) {
        console.error('[PreviewPage] Error loading/resolving data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAndResolveData();
  }, [pageId, appId, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loading text="Loading preview..." />
      </div>
    );
  }

  if (!resolvedData || !effectiveTheme || !app) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <h1 className="text-2xl font-bold">No preview data</h1>
      </div>
    );
  }

  return (
    <QueryParamProvider params={queryParamsObject}>
      <LinkContextProvider
        value={{
          orgSlug: organization?.slug ?? undefined,
          appSlug: app.slug,
          appId: app.id,
          pages,
          isEditing: false,
          isPreview: true,
        }}
      >
        <ThemeProvider value={effectiveTheme}>
          <PreviewClient
            resolvedData={resolvedData}
            pageName={pageName}
          />
        </ThemeProvider>
      </LinkContextProvider>
    </QueryParamProvider>
  );
}
