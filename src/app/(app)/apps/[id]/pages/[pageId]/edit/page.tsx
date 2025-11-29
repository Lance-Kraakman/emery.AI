"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Puck, Data, usePuck, resolveAllData, Button as PuckButton } from "@measured/puck";
import "@measured/puck/puck.css";
import "@/styles/puck-theme.css";
import { config } from "@/components/puck/config";
import { getPage, getPages, updatePage, updatePageContent, publishPage, unpublishPage } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import { getCurrentOrganization } from "@/app/actions/user-organizations";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { OrganizationDTO } from "@/app/mappers/organization-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Eye, ExternalLink, Copy, Check } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { toast } from "sonner";
import { ThemeProvider } from "@/components/puck/theme-context";
import { LinkContextProvider } from "@/components/puck/link-context";
import { QueryParamProvider } from "@/components/puck/contexts/QueryParamContext";
import { PuckEditorThemeProvider, usePuckEditorTheme } from "@/components/puck/puck-editor-theme-context";
import { createPuckUIOverrides } from "@/components/puck/overrides";
import { PuckSession } from "@/lib/puck/session-storage";
import { PublicUrlDisplay } from "./components/PublicUrlDisplay";
import { EditorDataLayoutProvider } from "@/components/puck/contexts/EditorDataLayoutProvider";
import { PageVariablesProvider } from "@/components/puck/contexts/PageVariablesContext";
import { updatePageVariables } from "@/app/actions/puck-pages";
import type { PageVariable } from "@/components/puck/types";

// Sidebar state persistence component
// AIDEV-NOTE: This component handles saving/restoring Puck's sidebar state to sessionStorage
// so that sidebar visibility persists across page reloads (especially after theme changes)
function SidebarStatePersistence({ pageId }: { pageId: number }) {
  const { appState, dispatch } = usePuck();
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore sidebar state on mount
  useEffect(() => {
    if (isInitialized) return;

    const savedLeftState = PuckSession.getSidebarState(pageId, 'left');
    const savedRightState = PuckSession.getSidebarState(pageId, 'right');

    if (savedLeftState !== null || savedRightState !== null) {
      const uiUpdate: { leftSideBarVisible?: boolean; rightSideBarVisible?: boolean } = {};

      if (savedLeftState !== null) {
        uiUpdate.leftSideBarVisible = savedLeftState;
      }

      if (savedRightState !== null) {
        uiUpdate.rightSideBarVisible = savedRightState;
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
      PuckSession.setSidebarState(pageId, 'left', leftVisible);
    }

    if (rightVisible !== undefined) {
      PuckSession.setSidebarState(pageId, 'right', rightVisible);
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
  app,
  organization,
  onPublish,
  loadedFromSessionStorage,
  setLoadedFromSessionStorage,
}: {
  children: ReactNode;
  pageId: number;
  appId: number;
  page: PageDTO;
  app: AppDTO;
  organization: OrganizationDTO | null;
  onPublish: () => void;
  loadedFromSessionStorage: boolean;
  setLoadedFromSessionStorage: (value: boolean) => void;
}) {
  const router = useRouter();
  const { appState, history } = usePuck();
  const themeContext = usePuckEditorTheme();
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Detect unsaved changes: Puck history OR sessionStorage OR theme changes
  const hasUnsavedChanges = history.hasPast || loadedFromSessionStorage || themeContext.hasUnsavedChanges;

  // Build public URL
  const publicUrl = organization?.slug && app.slug && page.slug
    ? `/public/${organization.slug}/${app.slug}/${page.slug}`
    : null;
  const fullPublicUrl = typeof window !== 'undefined' && publicUrl
    ? `${window.location.origin}${publicUrl}`
    : null;

  const handleSave = async () => {
    try {
      // Save theme first if needed
      if (themeContext.hasUnsavedChanges) {
        const themeData = PuckSession.getTheme(pageId);
        if (themeData) {
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
      PuckSession.clearData(pageId);
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
    PuckSession.setData(pageId, currentData);

    // Navigate to preview route
    router.push(`/apps/${appId}/pages/${pageId}/preview`);
  };

  const handleCopyUrl = async () => {
    if (fullPublicUrl) {
      await navigator.clipboard.writeText(fullPublicUrl);
      setCopiedUrl(true);
      toast.success("URL copied to clipboard!");
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleOpenPublicPage = () => {
    if (publicUrl) {
      window.open(publicUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      {/* Public URL display (left side) */}
      {page.isPublic && publicUrl && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border border-border">
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px] sm:max-w-[300px]" title={fullPublicUrl || undefined}>
            {publicUrl}
          </span>
          <button
            onClick={handleCopyUrl}
            className="p-1 hover:bg-background rounded transition-colors"
            title="Copy URL"
          >
            {copiedUrl ? (
              <Check size={14} className="text-green-600" />
            ) : (
              <Copy size={14} className="text-muted-foreground" />
            )}
          </button>
          <button
            onClick={handleOpenPublicPage}
            className="p-1 hover:bg-background rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={14} className="text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      {/* Custom Action Buttons using Puck's Button component */}
      <div className="flex gap-2 items-center flex-shrink-0">
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
          {page.isPublic ? "Make Private" : "Make Public"}
        </Button>
      </div>
    </div>
  );
}

export default function PageEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = parseInt(params.id as string);
  const pageId = parseInt(params.pageId as string);

  const [page, setPage] = useState<PageDTO | null>(null);
  const [app, setApp] = useState<AppDTO | null>(null);
  const [organization, setOrganization] = useState<OrganizationDTO | null>(null);
  const [pages, setPages] = useState<PageDTO[]>([]);
  const [initialData, setInitialData] = useState<Data>({ content: [], root: {}, zones: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedFromSessionStorage, setLoadedFromSessionStorage] = useState(false);

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
    async function loadPage() {
      try {
        setLoading(true);

        // Fetch app, page, pages, and organization
        const [appResult, pageResult, pagesResult, orgResult] = await Promise.all([
          getApp(appId),
          getPage(pageId),
          getPages(appId),
          getCurrentOrganization()
        ]);

        if (!appResult.success || !appResult.data || !pageResult.success || !pageResult.data) {
          toast.error("Failed to load app or page");
          setLoading(false);
          return;
        }

        setApp(appResult.data);
        setPage(pageResult.data);
        setPages(pagesResult.success && pagesResult.data ? pagesResult.data : []);
        setOrganization(orgResult);

        // Check for unsaved changes in sessionStorage
        const savedData = PuckSession.getData(pageId);
        if (savedData) {
          try {
            const resolvedData = await resolveAllData(savedData, config, queryParamsObject);
            setInitialData(resolvedData);
            setLoadedFromSessionStorage(true);
            setLoading(false);
            return;
          } catch (err) {
            console.error('Error parsing saved data:', err);
            PuckSession.clearData(pageId);
          }
        }

        // Load from database
        const rawData = pageResult.data.templateData || { content: [], root: {}, zones: {} };
        const resolvedData = await resolveAllData(rawData, config, queryParamsObject);
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
  }, [pageId, appId, searchParams]);

  const handlePublish = async () => {
    if (!page) return;

    try {
      const result = page.isPublic
        ? await unpublishPage(pageId, `/apps/${appId}/pages/${pageId}/edit`)
        : await publishPage(pageId, `/apps/${appId}/pages/${pageId}/edit`);

      if (!result.success) {
        toast.error(result.error || `Failed to make page ${page.isPublic ? 'private' : 'public'}`);
        return;
      }

      toast.success(`Page is now ${page.isPublic ? 'private' : 'public'}!`);

      // Update local state
      setPage(prev => prev ? { ...prev, isPublic: !prev.isPublic } : null);
    } catch (err) {
      console.error('Error publishing page:', err);
      toast.error(`Failed to make page ${page.isPublic ? 'private' : 'public'}`);
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

  const handleSaveAccessSettings = async (data: { requiresAuth: boolean; allowedRoles: string[] }) => {
    try {
      const result = await updatePage(
        { id: pageId, requiresAuth: data.requiresAuth, allowedRoles: data.allowedRoles },
        `/apps/${appId}/pages/${pageId}/edit`
      );

      if (!result.success) {
        toast.error(result.error || "Failed to update access settings");
        return;
      }

      toast.success("Access settings updated successfully");
      // Update local state to reflect changes
      setPage(prev => prev ? {
        ...prev,
        requiresAuth: data.requiresAuth,
        allowedRoles: data.allowedRoles
      } : null);
    } catch (error) {
      console.error('Error updating access settings:', error);
      toast.error("Failed to update access settings");
    }
  };

  const handleSavePageVariables = async (variables: PageVariable[]) => {
    try {
      const result = await updatePageVariables(pageId, variables);

      if (!result.success) {
        toast.error(result.error || "Failed to update page variables");
        return;
      }

      // Update local state to reflect changes
      setPage(prev => prev ? { ...prev, pageVariables: variables } : null);
    } catch (error) {
      console.error('Error updating page variables:', error);
      toast.error("Failed to update page variables");
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
    <QueryParamProvider params={queryParamsObject}>
      <PuckEditorThemeProvider pageId={pageId} page={page} app={app}>
        <LinkContextProvider
          value={{
            orgSlug: organization?.slug ?? undefined,
            appSlug: app.slug,
            appId: app.id,
            pages: pages,
            isEditing: true,
            isPreview: false,
          }}
        >
          <ThemeProviderWrapper>
            <div className="h-screen">
              <Puck
            config={config}
            data={initialData}
            ui={{
              leftSideBarWidth: 180,
              rightSideBarWidth: 180,
            }}
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
                pageIsPublic: page.isPublic,
                pageRequiresAuth: page.requiresAuth,
                pageAllowedRoles: page.allowedRoles || [],
                pageVariables: page.pageVariables || [],
                onSavePageSettings: handleSavePageSettings,
                onSaveAccessSettings: handleSaveAccessSettings,
                onSavePageVariables: handleSavePageVariables,
                themeMode: "page",
              }),
              header: ({ children }) => (
                <div className="bg-transparent">{children}</div>
              ),
              puck: ({ children }) => (
                <PageVariablesProvider
                  pageVariables={page.pageVariables || []}
                  pageId={pageId}
                  onAddPageVariable={async (variable) => {
                    // Add to existing variables and save
                    const updatedVariables = [...(page.pageVariables || []), variable];
                    await handleSavePageVariables(updatedVariables);
                  }}
                >
                  <EditorDataLayoutProvider>
                    <SidebarStatePersistence pageId={pageId} />
                    {children}
                  </EditorDataLayoutProvider>
                </PageVariablesProvider>
              ),
              headerActions: ({ children }) => (
                <CustomHeaderActions
                  pageId={pageId}
                  appId={appId}
                  page={page}
                  app={app}
                  organization={organization}
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
      </LinkContextProvider>
    </PuckEditorThemeProvider>
    </QueryParamProvider>
  );
}

// Wrapper component to provide theme from context to Puck components
function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const { currentTheme } = usePuckEditorTheme();
  return <ThemeProvider value={currentTheme}>{children}</ThemeProvider>;
}
