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
import { ThemeProvider } from "@/components/puck/theme-context";
import { PuckEditorThemeProvider, usePuckEditorTheme } from "@/components/puck/puck-editor-theme-context";
import { createPuckUIOverrides } from "@/components/puck/overrides";

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
  const router = useRouter();
  const { appState, history } = usePuck();
  const themeContext = usePuckEditorTheme();

  // Detect unsaved changes: Puck history OR sessionStorage OR theme changes
  const hasUnsavedChanges = history.hasPast || loadedFromSessionStorage || themeContext.hasUnsavedChanges;

  const handleSave = async () => {
    try {
      // Save theme first if needed
      if (themeContext.hasUnsavedChanges) {
        const sessionKey = `page-theme-${pageId}`;
        const savedTheme = sessionStorage.getItem(sessionKey);
        if (savedTheme) {
          const themeData = JSON.parse(savedTheme);
          await themeContext.saveTheme(themeData);
        }
      }

      // Save page content (no revalidation - prevents page reload)
      const result = await updatePageContent({
        id: pageId,
        templateData: appState.data
      });

      if (!result.success) {
        toast.error(result.error || "Failed to save page");
        return;
      }

      toast.success("Page saved successfully!");

      // Clean up sessionStorage
      sessionStorage.removeItem(`puck-data-${pageId}`);
      setLoadedFromSessionStorage(false);
    } catch (err) {
      console.error('Error saving page:', err);
      toast.error("Failed to save page");
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
          disabled={!hasUnsavedChanges}
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

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);

        // Fetch app and page
        const [loadedApp, loadedPage] = await Promise.all([
          getApp(appId),
          getPage(pageId)
        ]);

        setApp(loadedApp);
        setPage(loadedPage);

        // Check for unsaved changes in sessionStorage
        const savedData = sessionStorage.getItem(`puck-data-${pageId}`);
        if (savedData) {
          try {
            const rawData = JSON.parse(savedData);
            const resolvedData = await resolveAllData(rawData, config, {});
            setInitialData(resolvedData);
            setLoadedFromSessionStorage(true);
            setLoading(false);
            return;
          } catch (err) {
            console.error('Error parsing saved data:', err);
            sessionStorage.removeItem(`puck-data-${pageId}`);
          }
        }

        // Load from database
        const rawData = loadedPage.templateData || { content: [], root: {}, zones: {} };
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
    <PuckEditorThemeProvider pageId={pageId} page={page} app={app}>
      <ThemeProviderWrapper>
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
              ...createPuckUIOverrides({
                pageId: pageId,
                pageName: page.name,
                pageSlug: page.slug,
                onSavePageSettings: handleSavePageSettings,
                themeMode: "page",
              }),
              puck: ({ children }) => (
                <div className="puck-themed-wrapper">
                  <SidebarStatePersistence pageId={pageId} />
                  {children}
                </div>
              ),
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
      </ThemeProviderWrapper>
    </PuckEditorThemeProvider>
  );
}

// Wrapper component to provide theme from context to Puck components
function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const { currentTheme } = usePuckEditorTheme();
  return <ThemeProvider value={currentTheme}>{children}</ThemeProvider>;
}
