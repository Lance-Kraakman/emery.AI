/**
 * Preview Frame Page - Content for iframe viewport simulation
 *
 * This page renders just the Puck content without any toolbar/controls.
 * It's loaded inside an iframe by the preview-client to enable proper
 * CSS media query behavior at different viewport widths.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { resolveAllData, Render, type Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/components/puck/config";
import { getPage, getPages } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import { getCurrentOrganization } from "@/app/actions/user-organizations";
import { Loading } from "@/components/ui/loading";
import { ThemeConfig } from "@/ddd/domain/puck/value-objects/theme-config";
import { PageContextProvider } from "@/components/puck/contexts/PageContext";
import { StateProvider } from "@/components/puck/contexts/StateContext";
import { PageDialogsRenderer } from "@/components/puck/components/PageDialogsRenderer";
import type { PageDialogsConfig } from "@/ddd/domain/puck/value-objects/page-dialogs";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { OrganizationDTO } from "@/app/mappers/organization-mapper";
import type { PageStateConfig } from "@/components/puck/types/state";
import { PuckSession } from "@/lib/puck/session-storage";

export default function PreviewFramePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = parseInt(params.pageId as string);
  const appId = parseInt(params.id as string);

  const [resolvedData, setResolvedData] = useState<Data | null>(null);
  const [effectiveTheme, setEffectiveTheme] = useState<ThemeConfig | null>(null);
  const [app, setApp] = useState<AppDTO | null>(null);
  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [pages, setPages] = useState<PageDTO[]>([]);
  const [pageState, setPageState] = useState<PageStateConfig | undefined>(undefined);
  const [pageDialogs, setPageDialogs] = useState<PageDialogsConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Convert URLSearchParams to Record for QueryParamContext
  const queryParamsObject: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    const existing = queryParamsObject[key];
    if (existing) {
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

        // Fetch app, organization, and pages for link resolution
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

        // Check sessionStorage first (unsaved changes from editor)
        const savedData = PuckSession.getData(pageId);
        let rawData: Data;
        let page: PageDTO;

        if (savedData) {
          rawData = savedData;
          const pageResult = await getPage(pageId);
          if (!pageResult.success || !pageResult.data) {
            throw new Error("Failed to load page");
          }
          page = pageResult.data;
        } else {
          const pageResult = await getPage(pageId);
          if (!pageResult.success || !pageResult.data) {
            throw new Error("Failed to load page");
          }
          page = pageResult.data;
          rawData = page.templateData || { content: [], root: {}, zones: {} };
        }

        // Compute effective theme (page overrides app)
        const appTheme = appData.themeConfig
          ? ThemeConfig.create(appData.themeConfig)
          : ThemeConfig.default();

        const computedTheme = page.themeConfig
          ? ThemeConfig.merge(appTheme, ThemeConfig.create(page.themeConfig))
          : appTheme;

        setEffectiveTheme(computedTheme);
        setPageState(page.pageState);
        setPageDialogs(page.pageDialogs);

        // Resolve all component data
        const resolved = await resolveAllData(rawData, config, {
          ...queryParamsObject,
          isPreview: true,        // Add this for Template component
        });
        setResolvedData(resolved);
      } catch (error) {
        console.error('[PreviewFrame] Error loading/resolving data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAndResolveData();
  }, [pageId, appId, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loading text="Loading..." />
      </div>
    );
  }

  if (!resolvedData || !effectiveTheme || !app) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <p className="text-muted-foreground">No preview data</p>
      </div>
    );
  }

  const themeStyles = effectiveTheme.toCSSVariables();

  return (
    <PageContextProvider
      value={{
        orgSlug: organization?.slug ?? undefined,
        appSlug: app.slug,
        appId: app.id,
        pages,
        isEditing: false,
        isPreview: true,
        params: queryParamsObject,
        theme: effectiveTheme,
      }}
    >
      <StateProvider pageState={pageState}>
        <PageDialogsRenderer pageDialogs={pageDialogs}>
          <div
            className="min-h-screen bg-white"
            style={themeStyles as React.CSSProperties}
          >
            <Render config={config} data={resolvedData} />
          </div>
        </PageDialogsRenderer>
      </StateProvider>
    </PageContextProvider>
  );
}
