"use client";

import React, { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
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
import { updatePageState, updatePageDialogs } from "@/app/actions/puck-pages";
import type { PageStateConfig } from "@/components/puck/types/state";
import type { PageDialogsConfig } from "@/ddd/domain/puck/value-objects/page-dialogs";
import { PuckEditorLayout } from "@/components/puck/PuckEditorLayout";
import { StateProvider } from "@/components/puck/contexts/StateContext";
import { EditingStackProvider } from "@/components/puck/contexts/EditingStackContext";
import { createPuckUIOverrides } from "@/components/puck/overrides";
import type { EditingContextItem, EditingTarget } from "@/components/puck/types/editing-context";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedFromSessionStorage, setLoadedFromSessionStorage] = useState(false);

  // True editing stack - tracks full path for nested editing (Page > DataBlock A > DataBlock B)
  const [editingStack, setEditingStack] = useState<EditingContextItem[]>([{ type: 'page' }]);

  // Page data is the source of truth
  const [pageData, setPageData] = useState<Data>({ content: [], root: { props: {} }, zones: {} });

  // Empty data constant
  const emptyData: Data = useMemo(() => ({ content: [], root: { props: {} }, zones: {} }), []);

  // Current editing context is the last item in the stack
  const currentContext = editingStack[editingStack.length - 1];


  // Convert to legacy EditingTarget format for backward compatibility with PuckEditorLayout
  const editingTarget: EditingTarget = currentContext.type === 'page'
    ? 'page'
    : currentContext.type === 'dialog'
      ? { dialogId: currentContext.dialogId, dialogName: currentContext.dialogName }
      : 'page'; // DataBlock uses its own handling

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
            setPageData(resolvedData);
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
        setPageData(resolvedData);
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

  // Derive currentData based on editing context (page or dialog only)
  // DataBlock templates are now edited inline via slots, no separate editing level needed
  const currentData = useMemo(() => {
    if (editingStack.length === 1 && editingStack[0].type === 'page') {
      return pageData;
    }

    // Check for dialog editing
    const currentLevel = editingStack[editingStack.length - 1];
    if (currentLevel.type === 'dialog') {
      const dialog = page?.pageDialogs?.dialogs?.find(d => d.id === currentLevel.dialogId);
      if (!dialog?.content) {
        console.warn(`[currentData] Dialog ${currentLevel.dialogId} not found in page dialogs`);
        return emptyData;
      }
      return dialog.content;
    }

    return pageData;
  }, [editingStack, pageData, page?.pageDialogs, emptyData]);

  // Handler to start editing a dialog's content - push onto stack
  const handleEditDialogContent = (dialogId: string) => {
    const dialog = page?.pageDialogs?.dialogs?.find(d => d.id === dialogId);
    if (dialog) {
      // Save page to session before entering nested content
      PuckSession.setData(pageId, pageData);
      setEditingStack(prev => [...prev, { type: 'dialog', dialogId, dialogName: dialog.name }]);
    }
  };

  // Handler to navigate back one level - pop from stack
  const handleBackToPage = () => {
    setEditingStack(prev => {
      if (prev.length <= 1) return prev; // Can't go back from page level
      return prev.slice(0, -1);
    });
  };

  // Handler to navigate to a specific level in the stack
  // Accepts currentAppState to save current content before navigating
  const handleNavigateToLevel = useCallback((level: number, currentAppState?: Data) => {
    // If currentAppState is provided, save it to pageData first
    if (currentAppState) {
      const currentLevel = editingStack[editingStack.length - 1];
      if (currentLevel.type === 'page') {
        // If at page level, the appState IS the pageData
        setPageData(currentAppState);
        PuckSession.setData(pageId, currentAppState);
      }
      // Dialog content is stored separately, no need to update pageData
    }

    // Update editing stack
    setEditingStack(prev => {
      if (level < 0 || level >= prev.length) return prev;
      return prev.slice(0, level + 1);
    });
  }, [editingStack, pageId]);

  // Handler to update pageData with current Puck appState
  const handleUpdatePageData = useCallback((currentAppState: Data): Data => {
    setPageData(currentAppState);
    PuckSession.setData(pageId, currentAppState);
    return currentAppState;
  }, [pageId]);

  // Callback when page data is saved
  const handlePageDataSaved = (data: Data) => {
    setPageData(data);
  };

  // Callback when dialog data is saved - update page.pageDialogs
  const handleDialogDataSaved = (dialogId: string, data: Data) => {
    // Update page.pageDialogs directly
    setPage(prev => {
      if (!prev || !prev.pageDialogs) return prev;
      return {
        ...prev,
        pageDialogs: {
          ...prev.pageDialogs,
          dialogs: prev.pageDialogs.dialogs.map(d =>
            d.id === dialogId ? { ...d, content: data } : d
          )
        }
      };
    });
  };

  // Editing stack actions for the context provider
  // Note: DataBlock templates are now edited inline via slots, no pushDataBlock needed
  const editingStackActions = useMemo(() => ({
    pushDialog: (dialogId: string, dialogName: string) => {
      const dialog = page?.pageDialogs?.dialogs?.find(d => d.id === dialogId);
      if (dialog) {
        handleEditDialogContent(dialogId);
      }
    },
    pop: handleBackToPage,
    navigateToLevel: (level: number, currentAppState?: Data) => handleNavigateToLevel(level, currentAppState),
  }), [page?.pageDialogs?.dialogs, handleNavigateToLevel]);

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

  const handleSavePageDialogs = async (pageDialogs: PageDialogsConfig | undefined) => {
    try {
      const result = await updatePageDialogs(pageId, pageDialogs);

      if (!result.success) {
        toast.error(result.error || "Failed to update page dialogs");
        return;
      }

      // Update local state to reflect changes
      setPage(prev => prev ? { ...prev, pageDialogs } : null);
    } catch (error) {
      console.error('Error updating page dialogs:', error);
      toast.error("Failed to update page dialogs");
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
        <StateProvider pageState={page.pageState}>
          <EditingStackProvider value={editingStackActions}>
            <PuckEditorWrapper
              currentContext={currentContext}
              editingStack={editingStack}
              currentData={currentData}
              pageData={pageData}
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
              onSavePageState={handleSavePageState}
              onSavePageDialogs={handleSavePageDialogs}
              editingTarget={editingTarget}
              onEditDialogContent={handleEditDialogContent}
              onBackToPage={handleBackToPage}
              onNavigateToLevel={handleNavigateToLevel}
              onUpdatePageData={handleUpdatePageData}
              onPageDataSaved={handlePageDataSaved}
              onDialogDataSaved={handleDialogDataSaved}
            />
          </EditingStackProvider>
        </StateProvider>
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

/**
 * PuckEditorWrapper - Wraps Puck for page/dialog editing
 *
 * DataBlock templates are now edited inline via slots, no separate editing level needed.
 */
interface PuckEditorWrapperProps {
  currentContext: EditingContextItem;
  editingStack: EditingContextItem[];
  currentData: Data;
  pageData: Data;
  pageId: number;
  appId: number;
  page: PageDTO;
  app: AppDTO;
  organization: OrganizationDTO | null;
  loadedFromSessionStorage: boolean;
  setLoadedFromSessionStorage: (value: boolean) => void;
  onPublish: () => Promise<void>;
  onSavePageSettings: (data: { name: string; slug: string }) => Promise<void>;
  onSaveAccessSettings: (data: { requiresAuth: boolean; allowedRoles: string[] }) => Promise<void>;
  onSavePageState: (pageState: PageStateConfig | undefined) => Promise<void>;
  onSavePageDialogs: (pageDialogs: PageDialogsConfig | undefined) => Promise<void>;
  editingTarget: EditingTarget;
  onEditDialogContent: (dialogId: string) => void;
  onBackToPage: () => void;
  onNavigateToLevel: (level: number, currentAppState?: Data) => void;
  onUpdatePageData: (currentAppState: Data) => Data;
  onPageDataSaved: (data: Data) => void;
  onDialogDataSaved: (dialogId: string, data: Data) => void;
}

function PuckEditorWrapper({
  editingStack,
  currentData,
  pageData,
  pageId,
  appId,
  page,
  app,
  organization,
  loadedFromSessionStorage,
  setLoadedFromSessionStorage,
  onPublish,
  onSavePageSettings,
  onSaveAccessSettings,
  onSavePageState,
  onSavePageDialogs,
  editingTarget,
  onEditDialogContent,
  onBackToPage,
  onNavigateToLevel,
  onUpdatePageData,
  onPageDataSaved,
  onDialogDataSaved,
}: PuckEditorWrapperProps) {
  // Stable Puck key to preserve undo/redo history across navigation
  const puckKey = `page-${pageId}`;

  return (
    <Puck
      key={puckKey}
      config={config}
      data={currentData}
      iframe={{
        enabled: true,
        waitForStyles: true,
      }}
      overrides={createPuckUIOverrides()}
    >
      <PuckEditorLayout
        pageId={pageId}
        appId={appId}
        page={page}
        app={app}
        organization={organization}
        pageData={pageData}
        loadedFromSessionStorage={loadedFromSessionStorage}
        setLoadedFromSessionStorage={setLoadedFromSessionStorage}
        onPublish={onPublish}
        onSavePageSettings={onSavePageSettings}
        onSaveAccessSettings={onSaveAccessSettings}
        onSavePageState={onSavePageState}
        onSavePageDialogs={onSavePageDialogs}
        themeMode="page"
        editingTarget={editingTarget}
        editingStack={editingStack}
        onEditDialogContent={onEditDialogContent}
        onBackToPage={onBackToPage}
        onNavigateToLevel={onNavigateToLevel}
        onUpdatePageData={onUpdatePageData}
        onPageDataSaved={onPageDataSaved}
        onDialogDataSaved={onDialogDataSaved}
      />
    </Puck>
  );
}
