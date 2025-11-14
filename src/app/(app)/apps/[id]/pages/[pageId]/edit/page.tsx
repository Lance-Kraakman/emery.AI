"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Puck, Data, usePuck, resolveAllData } from "@measured/puck";
import "@measured/puck/puck.css";
import "@/styles/puck-theme.css";
import { config } from "@/components/puck/config";
import { getPage, updatePage, updatePageContent, publishPage, unpublishPage } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Eye } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { toast } from "sonner";
import { ThemeConfig, type ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";
import { ThemeProvider } from "@/components/puck/theme-context";
import { createPuckUIOverrides } from "@/components/puck/overrides";
import { usePageTheme } from "@/hooks/usePageTheme";

// Sidebar state persistence component
// AIDEV-NOTE: This component handles saving/restoring Puck's sidebar state to sessionStorage
// so that sidebar visibility persists across page reloads (especially after theme changes)
function SidebarStatePersistence({ pageId }: { pageId: number }) {
  const { appState, dispatch } = usePuck();
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore sidebar state on mount
  useEffect(() => {
    if (isInitialized) return;

    const savedLeftState = sessionStorage.getItem(`puck-sidebar-left-${pageId}`);
    const savedRightState = sessionStorage.getItem(`puck-sidebar-right-${pageId}`);

    if (savedLeftState !== null || savedRightState !== null) {
      const uiUpdate: any = {};

      if (savedLeftState !== null) {
        uiUpdate.leftSideBarVisible = savedLeftState === 'true';
      }

      if (savedRightState !== null) {
        uiUpdate.rightSideBarVisible = savedRightState === 'true';
      }

      dispatch({ type: 'setUi', ui: uiUpdate });
    }

    setIsInitialized(true);
  }, [pageId, dispatch, isInitialized]);

  // Save sidebar state whenever it changes
  useEffect(() => {
    if (!isInitialized) return; // Don't save initial state

    const leftVisible = appState.ui.leftSideBarVisible;
    const rightVisible = appState.ui.rightSideBarVisible;

    if (leftVisible !== undefined) {
      sessionStorage.setItem(`puck-sidebar-left-${pageId}`, String(leftVisible));
    }

    if (rightVisible !== undefined) {
      sessionStorage.setItem(`puck-sidebar-right-${pageId}`, String(rightVisible));
    }
  }, [appState.ui.leftSideBarVisible, appState.ui.rightSideBarVisible, pageId, isInitialized]);

  return null; // This component doesn't render anything
}

// Custom header actions component with full Puck controls
// AIDEV-NOTE: This component is rendered inside Puck's context via overrides.headerActions,
// so it has access to usePuck() hook to get current editor data without causing re-renders
function CustomHeaderActions({
  children,
  pageId,
  appId,
  page,
  onPublish,
  loadedFromSessionStorage,
  setLoadedFromSessionStorage,
}: {
  children: ReactNode;
  pageId: number;
  appId: number;
  page: PageDTO;
  onPublish: () => void;
  loadedFromSessionStorage: boolean;
  setLoadedFromSessionStorage: (value: boolean) => void;
}) {
  // AIDEV-NOTE: The `children` prop only contains Puck's default Publish button.
  // We don't render it because we provide our own custom Publish/Unpublish button.
  // Undo/redo buttons are hardcoded in Puck's MenuBar and render automatically.
  // Viewport buttons are configured via the `viewports` prop and render in a separate row.

  const router = useRouter();
  const { appState, history } = usePuck();
  const [saving, setSaving] = useState(false);

  // Detect unsaved changes using Puck's history OR sessionStorage presence
  // AIDEV-NOTE: After theme reload, history.hasPast is false but data may be unsaved draft in sessionStorage
  const hasUnsavedChanges = history.hasPast || loadedFromSessionStorage;

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
      sessionStorage.removeItem(`puck-data-${pageId}`);
      setLoadedFromSessionStorage(false);
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
    sessionStorage.setItem(`puck-data-${pageId}`, JSON.stringify(currentData));

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
  const [loadedFromSessionStorage, setLoadedFromSessionStorage] = useState(false);

  // Use custom hook for theme management
  const {
    currentTheme,
    formTheme,
    handleThemeChange,
    handleSave: handleSaveTheme,
    handleRemove: handleRemoveTheme,
    isSaving: isThemeSaving,
    hasUnsavedChanges: hasUnsavedThemeChanges,
  } = usePageTheme(pageId, page, app);

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

        // First check if we have unsaved changes in sessionStorage (from preview/theme changes)
        const savedData = sessionStorage.getItem(`puck-data-${pageId}`);
        if (savedData) {
          try {
            rawData = JSON.parse(savedData);
            loadedPage = await getPage(pageId);
            setPage(loadedPage);

            // AIDEV-NOTE: Resolve data even from sessionStorage to ensure
            // components like MetricBlock have their resolveData executed
            const resolvedData = await resolveAllData(rawData, config, {});

            setInitialData(resolvedData);
            setLoadedFromSessionStorage(true);
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

        const resolvedData = await resolveAllData(rawData, config, {});

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

  const handleSavePageSettings = async (data: { name: string; slug: string }) => {
    try {
      const result = await updatePage(
        { id: pageId, name: data.name, slug: data.slug },
        `/apps/${appId}/pages/${pageId}/edit`
      );

      if (!result.success) {
        toast.error(result.error || "Failed to update page settings");
        return;
      }

      toast.success("Page settings updated successfully");
      // Update local state to reflect changes
      setPage(prev => prev ? { ...prev, name: data.name, slug: data.slug } : null);
    } catch (error) {
      console.error('Error updating page settings:', error);
      toast.error("Failed to update page settings");
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

  return (
    <ThemeProvider value={currentTheme || ThemeConfig.default()}>
      <div className="h-screen">
        <Puck
          config={config}
          data={initialData}
          headerTitle={page.slug}
          viewports={[
            { width: 360, height: "auto", icon: "Smartphone", label: "Mobile" },
            { width: 768, height: "auto", icon: "Tablet", label: "Tablet" },
            { width: 1440, height: "auto", icon: "Monitor", label: "Desktop" }
          ]}
          iframe={{
            enabled: true,
            waitForStyles: true,
          }}
          overrides={{
            // Spread UI overrides with page settings and theme panel in sidebar
            ...createPuckUIOverrides({
              pageId: pageId,
              pageName: page.name,
              pageSlug: page.slug,
              onSavePageSettings: handleSavePageSettings,
              themeConfig: formTheme, // Theme to display in form
              onSaveTheme: handleSaveTheme, // Just save, don't update state
              themeMode: "page",
            }),

            // Custom puck wrapper with state persistence
            puck: ({ children }) => (
              <div className="puck-themed-wrapper">
                <SidebarStatePersistence pageId={pageId} />
                {children}
              </div>
            ),
            // Custom header actions with save/publish buttons
            headerActions: ({ children }) => (
              <CustomHeaderActions
                pageId={pageId}
                appId={appId}
                page={page}
                onPublish={handlePublish}
                loadedFromSessionStorage={loadedFromSessionStorage}
                setLoadedFromSessionStorage={setLoadedFromSessionStorage}
              >
                {children}
              </CustomHeaderActions>
            )
          }}
        />
      </div>
    </ThemeProvider>
  );
}
