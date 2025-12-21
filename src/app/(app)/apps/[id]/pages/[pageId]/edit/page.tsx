"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Puck, Data, resolveAllData } from "@measured/puck";
import "@measured/puck/puck.css";
import "@/styles/puck-theme.css";
import { config } from "@/components/puck/config";
import { getPage, getPages, updatePage, publishPage, unpublishPage } from "@/app/actions/puck-pages";
import { getApp } from "@/app/actions/puck-apps";
import { getCurrentOrganization } from "@/app/actions/user-organizations";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { OrganizationDTO } from "@/app/mappers/organization-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { toast } from "sonner";
import { PageContextProvider } from "@/components/puck/contexts/PageContext";
import { PuckEditorThemeProvider, usePuckEditorTheme } from "@/components/puck/puck-editor-theme-context";
import { PuckSession } from "@/lib/puck/session-storage";
import { EditorDataLayoutProvider } from "@/components/puck/contexts/EditorDataLayoutProvider";
import { PageVariablesProvider } from "@/components/puck/contexts/PageVariablesContext";
import { updatePageVariables, updatePageState } from "@/app/actions/puck-pages";
import type { PageVariable } from "@/components/puck/types";
import type { PageStateConfig } from "@/components/puck/types/state";
import { PuckEditorLayout } from "@/components/puck/PuckEditorLayout";

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

  const handleSavePageState = async (pageState: PageStateConfig | undefined) => {
    try {
      const result = await updatePageState(pageId, pageState);

      if (!result.success) {
        toast.error(result.error || "Failed to update page state");
        return;
      }

      // Update local state to reflect changes
      setPage(prev => prev ? { ...prev, pageState } : null);
    } catch (error) {
      console.error('Error updating page state:', error);
      toast.error("Failed to update page state");
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
      <EditorPageContextWrapper
        orgSlug={organization?.slug ?? undefined}
        appSlug={app.slug}
        appId={app.id}
        pages={pages}
        params={queryParamsObject}
      >
        <Puck
          config={config}
          data={initialData}
          iframe={{
            enabled: true,
            waitForStyles: true,
          }}
        >
          <PageVariablesProvider
            pageVariables={page.pageVariables || []}
            pageId={pageId}
            onAddPageVariable={async (variable) => {
              const updatedVariables = [...(page.pageVariables || []), variable];
              await handleSavePageVariables(updatedVariables);
            }}
          >
            <EditorDataLayoutProvider>
              <PuckEditorLayout
                pageId={pageId}
                appId={appId}
                page={page}
                app={app}
                organization={organization}
                loadedFromSessionStorage={loadedFromSessionStorage}
                setLoadedFromSessionStorage={setLoadedFromSessionStorage}
                onPublish={handlePublish}
                onSavePageSettings={handleSavePageSettings}
                onSaveAccessSettings={handleSaveAccessSettings}
                onSavePageVariables={handleSavePageVariables}
                onSavePageState={handleSavePageState}
                themeMode="page"
              />
            </EditorDataLayoutProvider>
          </PageVariablesProvider>
        </Puck>
      </EditorPageContextWrapper>
    </PuckEditorThemeProvider>
  );
}

// Wrapper component that reads theme from PuckEditorThemeProvider and provides unified PageContext
interface EditorPageContextWrapperProps {
  children: ReactNode;
  orgSlug?: string;
  appSlug: string;
  appId: number;
  pages: PageDTO[];
  params: Record<string, string | string[]>;
}

function EditorPageContextWrapper({
  children,
  orgSlug,
  appSlug,
  appId,
  pages,
  params,
}: EditorPageContextWrapperProps) {
  const { currentTheme } = usePuckEditorTheme();
  return (
    <PageContextProvider
      value={{
        orgSlug,
        appSlug,
        appId,
        pages,
        isEditing: true,
        isPreview: false,
        params,
        theme: currentTheme,
      }}
    >
      {children}
    </PageContextProvider>
  );
}
