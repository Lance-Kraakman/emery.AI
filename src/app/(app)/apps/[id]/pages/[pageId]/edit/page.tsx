"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Puck, Data, usePuck, resolveAllData } from "@measured/puck";
import "@measured/puck/puck.css";
import "@/styles/puck-theme.css";
import { config } from "@/components/puck/config";
import { getPage, updatePageContent, publishPage, unpublishPage } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Eye, Palette } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { toast } from "sonner";
import { ThemeConfig, type ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";
import { ThemeProvider } from "@/components/puck/theme-context";
import { ThemeEditorSheet } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { updatePageTheme } from "@/app/actions/puck-pages";

// Custom header actions component with full Puck controls
// AIDEV-NOTE: This component is rendered inside Puck's context via overrides.headerActions,
// so it has access to usePuck() hook to get current editor data without causing re-renders
function CustomHeaderActions({
  children,
  pageId,
  appId,
  page,
  onPublish,
  onThemeClick,
}: {
  children: ReactNode;
  pageId: number;
  appId: number;
  page: PageDTO;
  onPublish: () => void;
  onThemeClick: () => void;
}) {
  // AIDEV-NOTE: The `children` prop only contains Puck's default Publish button.
  // We don't render it because we provide our own custom Publish/Unpublish button.
  // Undo/redo buttons are hardcoded in Puck's MenuBar and render automatically.
  // Viewport buttons are configured via the `viewports` prop and render in a separate row.

  const router = useRouter();
  const { appState, history } = usePuck();
  const [saving, setSaving] = useState(false);

  // Detect unsaved changes using Puck's history
  const hasUnsavedChanges = history.hasPast;

  const handleSave = async () => {
    try {
      setSaving(true);

      // Get current data from Puck's state (no re-render!)
      const currentData = appState.data;

      // Update the page content
      const result = await updatePageContent({
        id: pageId,
        templateData: currentData
      }, `/apps/${appId}/pages/${pageId}/edit`);

      if (!result.success) {
        toast.error(result.error || "Failed to save page");
        return;
      }

      toast.success("Page saved successfully!");

      // Clean up sessionStorage since changes are now saved
      sessionStorage.removeItem(`preview-${pageId}`);
    } catch (err) {
      console.error('Error saving page:', err);
      toast.error("Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    // Get current data from Puck's state (no re-render!)
    const currentData = appState.data;

    // Save current data to sessionStorage so preview can access unsaved changes
    sessionStorage.setItem(`preview-${pageId}`, JSON.stringify(currentData));

    // Navigate to preview route
    router.push(`/apps/${appId}/pages/${pageId}/preview`);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      {/* Custom Action Buttons */}
      <div className="flex gap-2 items-center">
        <Button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
        >
          {hasUnsavedChanges ? "Save Changes" : "Saved"}
        </Button>

        <Button
          onClick={handlePreview}
        >
          <Eye size={16} className="mr-1" />
          Preview
        </Button>

        <Button
          onClick={onThemeClick}
          variant="outline"
        >
          <Palette size={16} className="mr-1" />
          Theme
        </Button>

        <Button
          onClick={onPublish}
        >
          <Globe size={16} className="mr-1" />
          {page.isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

export default function PageEditPage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string);
  const pageId = parseInt(params.pageId as string);

  const [page, setPage] = useState<PageDTO | null>(null);
  const [app, setApp] = useState<AppDTO | null>(null);
  const [initialData, setInitialData] = useState<Data>({ content: [], root: {}, zones: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);

        let rawData: Data;
        let loadedPage: PageDTO;
        let loadedApp: AppDTO;

        // Fetch the app first (needed for theme)
        loadedApp = await getApp(appId);
        setApp(loadedApp);

        // First check if we have unsaved changes in sessionStorage (returning from preview)
        const savedData = sessionStorage.getItem(`preview-${pageId}`);
        if (savedData) {
          try {
            rawData = JSON.parse(savedData);
            loadedPage = await getPage(pageId);
            setPage(loadedPage);

            // AIDEV-NOTE: Resolve data even from sessionStorage to ensure
            // components like MetricBlock have their resolveData executed
            console.log('[EditPage] Resolving data from sessionStorage...');
            const resolvedData = await resolveAllData(rawData, config, {});
            console.log('[EditPage] Data resolved, initializing editor...');

            setInitialData(resolvedData);
            setLoading(false);
            return;
          } catch (err) {
            console.error('Error parsing saved preview data:', err);
            // Continue to normal load if parsing fails
          }
        }

        // Normal load from database
        loadedPage = await getPage(pageId);
        setPage(loadedPage);

        // Initialize with loaded content or empty structure
        rawData = loadedPage.templateData || {
          content: [],
          root: {},
          zones: {}
        };

        // CRITICAL: Resolve all component data before initializing Puck editor
        // This ensures MetricBlock and other components with resolveData functions
        // have their data pre-fetched and available on first render
        console.log('[EditPage] Resolving component data...');
        const resolvedData = await resolveAllData(rawData, config, {});
        console.log('[EditPage] Data resolved, initializing editor...');

        setInitialData(resolvedData);
      } catch (err) {
        console.error('Error loading page:', err);
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    }

    if (pageId && appId) {
      loadPage();
    }
  }, [pageId, appId]);

  const handlePublish = async () => {
    if (!page) return;

    try {
      const result = page.isPublished
        ? await unpublishPage(pageId, `/apps/${appId}/pages/${pageId}/edit`)
        : await publishPage(pageId, `/apps/${appId}/pages/${pageId}/edit`);

      if (!result.success) {
        toast.error(result.error || `Failed to ${page.isPublished ? 'unpublish' : 'publish'} page`);
        return;
      }

      toast.success(`Page ${page.isPublished ? 'unpublished' : 'published'} successfully!`);

      // Update local state
      setPage(prev => prev ? { ...prev, isPublished: !prev.isPublished } : null);
    } catch (err) {
      console.error('Error publishing page:', err);
      toast.error(`Failed to ${page.isPublished ? 'unpublish' : 'publish'} page`);
    }
  };

  const handleSavePageTheme = async (theme: ThemeConfigProps | undefined) => {
    try {
      const result = await updatePageTheme(pageId, theme);

      if (!result.success) {
        toast.error(result.error || "Failed to update page theme");
        return;
      }

      toast.success("Page theme updated successfully");
      setThemeSheetOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating page theme:', error);
      toast.error("Failed to update page theme");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading text="Loading page..." />
      </div>
    );
  }

  if (error || !page || !app) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">{error || "The requested page could not be found."}</p>
        <Button onClick={() => router.push(`/apps/${appId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to app
        </Button>
      </div>
    );
  }

  // AIDEV-NOTE: Compute effective theme using cascade: Page theme overrides App theme
  // If page has no theme override, use app theme. If app has no theme, use default.
  const appTheme = app.themeConfig
    ? ThemeConfig.create(app.themeConfig)
    : ThemeConfig.default();

  const effectiveTheme = page.themeConfig
    ? ThemeConfig.merge(appTheme, ThemeConfig.create(page.themeConfig))
    : appTheme;

  return (
    <ThemeProvider value={effectiveTheme}>
      <div className="h-screen">
        {/* AIDEV-NOTE: Puck is used as an UNCONTROLLED component (no onChange prop).
            This prevents iframe reloads on every edit. CustomHeaderActions uses
            usePuck() hook to access current data when saving/previewing.
            Theme is provided via ThemeContext to avoid mutating Puck's config. */}
        <Puck
          config={config}
          data={initialData}
          headerTitle={page.name}
          viewports={[
            { width: 360, height: "auto", icon: "Smartphone", label: "Mobile" },
            { width: 768, height: "auto", icon: "Tablet", label: "Tablet" },
            { width: 1440, height: "auto", icon: "Monitor", label: "Desktop" }
          ]}
          iframe={{
            enabled: true,
            waitForStyles: true,
            // htmlAttributes: {
            //   className: "puck-canvas-light-mode",
            // },
          }}
          overrides={{
            puck: ({ children }) => (
              <div className="puck-themed-wrapper">
                {children}
              </div>
            ),
            headerActions: ({ children }) => (
              <CustomHeaderActions
                pageId={pageId}
                appId={appId}
                page={page}
                onPublish={handlePublish}
                onThemeClick={() => setThemeSheetOpen(true)}
              >
                {children}
              </CustomHeaderActions>
            )
          }}
        />
      </div>

      {/* Theme Editor Sheet */}
      <ThemeEditorSheet
        open={themeSheetOpen}
        onOpenChange={setThemeSheetOpen}
        initialTheme={page.themeConfig}
        onSave={handleSavePageTheme}
        mode="page"
      />
    </ThemeProvider>
  );
}
