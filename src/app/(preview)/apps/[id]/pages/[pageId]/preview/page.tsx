/**
 * Preview Page - Client Component
 *
 * AIDEV-NOTE: Client component to support sessionStorage for previewing unsaved changes.
 * Checks sessionStorage first (unsaved editor state), falls back to database (saved state).
 * Calls resolveAllData on client to execute component resolveData functions.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resolveAllData, type Data } from "@measured/puck";
import { config } from "@/components/puck/config";
import { getPage } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import { PreviewClient } from "./preview-client";
import { Loading } from "@/components/ui/loading";
import { ThemeConfig } from "@/ddd/domain/puck/value-objects/theme-config";
import { ThemeProvider } from "@/components/puck/theme-context";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import { PuckSession } from "@/lib/puck/session-storage";

export default function PreviewPage() {
  const params = useParams();
  const pageId = parseInt(params.pageId as string);
  const appId = parseInt(params.id as string);

  const [resolvedData, setResolvedData] = useState<Data | null>(null);
  const [pageName, setPageName] = useState<string>("");
  const [effectiveTheme, setEffectiveTheme] = useState<ThemeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAndResolveData() {
      try {
        setLoading(true);

        // 1. Fetch app for theme
        const appResult = await getApp(appId);
        if (!appResult.success || !appResult.data) {
          throw new Error("Failed to load app");
        }
        const app = appResult.data;

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
        const appTheme = app.themeConfig
          ? ThemeConfig.create(app.themeConfig)
          : ThemeConfig.default();

        const computedTheme = page.themeConfig
          ? ThemeConfig.merge(appTheme, ThemeConfig.create(page.themeConfig))
          : appTheme;

        setEffectiveTheme(computedTheme);

        // 5. Resolve all component data (calls resolveData functions)
        console.log('[PreviewPage] Resolving component data...');
        const resolved = await resolveAllData(rawData, config, {});
        console.log('[PreviewPage] Data resolved, rendering...');

        setResolvedData(resolved);
      } catch (error) {
        console.error('[PreviewPage] Error loading/resolving data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAndResolveData();
  }, [pageId, appId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loading text="Loading preview..." />
      </div>
    );
  }

  if (!resolvedData || !effectiveTheme) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <h1 className="text-2xl font-bold">No preview data</h1>
      </div>
    );
  }

  return (
    <ThemeProvider value={effectiveTheme}>
      <PreviewClient
        resolvedData={resolvedData}
        pageName={pageName}
      />
    </ThemeProvider>
  );
}
