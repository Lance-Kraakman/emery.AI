"use client";

import React, { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Puck, Data, resolveAllData, type ComponentData } from "@measured/puck";
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
import { TemplateEditorProvider } from "@/components/puck/contexts/TemplateEditorContext";
import { DataLayoutProvider } from "@/components/puck/contexts/DataLayoutContext";
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

  /**
   * Recursively find a component by ID, including inside templateContent.
   * Puck's walkTree only traverses slots/zones, not custom fields like templateContent.
   */
  const findNestedComponent = useCallback((data: Data, componentId: string): ComponentData | null => {
    // Search in content array
    for (const comp of data.content) {
      if (comp.props?.id === componentId) {
        return comp as ComponentData;
      }
      // Recurse into templateContent if exists
      if (comp.props?.templateContent) {
        const found = findNestedComponent(comp.props.templateContent as Data, componentId);
        if (found) return found;
      }
    }

    // Search in zones
    for (const zoneContent of Object.values(data.zones || {})) {
      for (const comp of zoneContent) {
        if (comp.props?.id === componentId) {
          return comp as ComponentData;
        }
        if (comp.props?.templateContent) {
          const found = findNestedComponent(comp.props.templateContent as Data, componentId);
          if (found) return found;
        }
      }
    }

    return null;
  }, []);

  /**
   * Recursively find and update a component's templateContent anywhere in pageData.
   * Descends into templateContent props that Puck's walkTree doesn't traverse
   * (because templateContent is a custom field, not a slot).
   */
  const updateNestedTemplate = useCallback((data: Data, componentId: string, newTemplate: Data): Data => {
    let contentChanged = false;
    const updatedContent = data.content.map(comp => {
      // Found target - update its templateContent
      if (comp.props?.id === componentId) {
        contentChanged = true;
        return { ...comp, props: { ...comp.props, templateContent: newTemplate } };
      }

      // Recurse into templateContent if exists
      if (comp.props?.templateContent) {
        const updatedInner = updateNestedTemplate(comp.props.templateContent as Data, componentId, newTemplate);
        if (updatedInner !== comp.props.templateContent) {
          contentChanged = true;
          return { ...comp, props: { ...comp.props, templateContent: updatedInner } };
        }
      }
      return comp;
    });

    // Also check zones
    let zonesChanged = false;
    const updatedZones: Record<string, typeof data.content> = {};
    for (const [zoneName, zoneContent] of Object.entries(data.zones || {})) {
      const updatedZone = zoneContent.map(comp => {
        if (comp.props?.id === componentId) {
          zonesChanged = true;
          return { ...comp, props: { ...comp.props, templateContent: newTemplate } };
        }
        if (comp.props?.templateContent) {
          const updatedInner = updateNestedTemplate(comp.props.templateContent as Data, componentId, newTemplate);
          if (updatedInner !== comp.props.templateContent) {
            zonesChanged = true;
            return { ...comp, props: { ...comp.props, templateContent: updatedInner } };
          }
        }
        return comp;
      });
      updatedZones[zoneName] = updatedZone;
    }

    if (!contentChanged && !zonesChanged) return data;

    return {
      ...data,
      content: contentChanged ? updatedContent : data.content,
      zones: zonesChanged ? updatedZones : data.zones
    };
  }, []);

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

  // Derive currentData by traversing the editing stack path
  // For nested DataBlocks: Page > A > B means we need to find B's template inside A's template
  const currentData = useMemo(() => {
    if (editingStack.length === 1 && editingStack[0].type === 'page') {
      return pageData;
    }

    // Start from pageData and traverse down the stack
    let data: Data = pageData;

    for (let i = 1; i < editingStack.length; i++) {
      const level = editingStack[i];

      if (level.type === 'dialog') {
        const dialog = page?.pageDialogs?.dialogs?.find(d => d.id === level.dialogId);
        data = dialog?.content || emptyData;
      } else if (level.type === 'datablock') {
        // Find the component in the current data level (recursively, including templateContent)
        const component = findNestedComponent(data, level.componentId);
        data = component?.props?.templateContent || emptyData;
      }
    }

    return data;
  }, [editingStack, pageData, page?.pageDialogs, emptyData, findNestedComponent]);

  // Handler to start editing a dialog's content - push onto stack
  const handleEditDialogContent = (dialogId: string) => {
    const dialog = page?.pageDialogs?.dialogs?.find(d => d.id === dialogId);
    if (dialog) {
      // Save page to session before entering nested content
      PuckSession.setData(pageId, pageData);
      setEditingStack(prev => [...prev, { type: 'dialog', dialogId, dialogName: dialog.name }]);
    }
  };

  // Helper to update pageData with current appState at the correct nested position
  // Uses updateNestedTemplate to find and update the component anywhere in pageData
  const updatePageDataWithCurrentState = useCallback((currentAppState: Data): Data => {
    const currentLevel = editingStack[editingStack.length - 1];

    // At page level - appState IS pageData
    if (currentLevel.type === 'page') {
      return currentAppState;
    }

    // Editing a datablock template - find and update it anywhere in pageData
    if (currentLevel.type === 'datablock') {
      return updateNestedTemplate(pageData, currentLevel.componentId, currentAppState);
    }

    // Dialog (unchanged - dialogs are stored separately)
    return pageData;
  }, [editingStack, pageData, updateNestedTemplate]);

  // Handler to start editing a DataBlock's template - push onto stack
  const handleEditDataBlockTemplate = useCallback((
    componentId: string,
    name: string,
    _templateContent: Data, // Template we're entering (fallback if pageData not updated)
    viewId: number,
    tableId: number,
    currentAppState: Data  // Current appState.data from Puck
  ) => {
    // Update pageData with current appState BEFORE navigating
    // This ensures nested DataBlocks are properly embedded in pageData
    const updatedPageData = updatePageDataWithCurrentState(currentAppState);
    setPageData(updatedPageData);
    PuckSession.setData(pageId, updatedPageData);

    // Push new level onto stack
    setEditingStack(prev => [...prev, { type: 'datablock', componentId, name, viewId, tableId }]);
  }, [pageId, updatePageDataWithCurrentState]);

  // Handler to navigate back one level - pop from stack
  const handleBackToPage = () => {
    setEditingStack(prev => {
      if (prev.length <= 1) return prev; // Can't go back from page level
      return prev.slice(0, -1);
    });
  };

  // Handler to navigate to a specific level in the stack
  const handleNavigateToLevel = (level: number) => {
    setEditingStack(prev => {
      if (level < 0 || level >= prev.length) return prev;
      return prev.slice(0, level + 1);
    });
  };

  // Handler to update pageData with current Puck appState (called from PuckEditorLayout)
  // Updates both state and session storage
  const handleUpdatePageData = useCallback((currentAppState: Data): Data => {
    const updatedPageData = updatePageDataWithCurrentState(currentAppState);
    setPageData(updatedPageData);
    PuckSession.setData(pageId, updatedPageData);
    return updatedPageData;
  }, [updatePageDataWithCurrentState, pageId]);

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

  // Callback when DataBlock template is saved - update pageData using recursive function
  // Returns the updated pageData for saving to DB
  const handleDataBlockSaved = useCallback((componentId: string, templateData: Data): Data => {
    // Use updateNestedTemplate to find and update the component anywhere in pageData
    const updatedPageData = updateNestedTemplate(pageData, componentId, templateData);
    setPageData(updatedPageData);
    return updatedPageData;
  }, [pageData, updateNestedTemplate]);

  // Editing stack actions for the context provider
  // NOTE: pushDataBlock is a no-op here because PuckEditorLayout overrides it
  // to inject appState.data (which is only available inside <Puck>).
  const editingStackActions = useMemo(() => ({
    pushDataBlock: () => {},  // Overridden by PuckEditorLayout
    pushDialog: (dialogId: string, dialogName: string) => {
      const dialog = page?.pageDialogs?.dialogs?.find(d => d.id === dialogId);
      if (dialog) {
        handleEditDialogContent(dialogId);
      }
    },
    pop: handleBackToPage,
    navigateToLevel: handleNavigateToLevel,
  }), [page?.pageDialogs?.dialogs]);

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
              onEditDataBlockTemplate={handleEditDataBlockTemplate}
              onBackToPage={handleBackToPage}
              onNavigateToLevel={handleNavigateToLevel}
              onUpdatePageData={handleUpdatePageData}
              onPageDataSaved={handlePageDataSaved}
              onDialogDataSaved={handleDialogDataSaved}
              onDataBlockSaved={handleDataBlockSaved}
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
 * PuckEditorWrapper - Wraps Puck with appropriate context providers
 *
 * When editing a DataBlock template:
 * - Wraps with TemplateEditorProvider to fetch fields fresh
 * - Adds puck-template-editor class for sizing constraints
 *
 * When editing page/dialog:
 * - Renders Puck directly without extra wrappers
 */
interface PuckEditorWrapperProps {
  currentContext: EditingContextItem;
  editingStack: EditingContextItem[];
  currentData: Data;
  pageData: Data; // Full page data for saving nested content
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
  onEditDataBlockTemplate: (componentId: string, name: string, templateContent: Data, viewId: number, tableId: number, currentAppState: Data) => void;
  onBackToPage: () => void;
  onNavigateToLevel: (level: number) => void;
  onUpdatePageData: (currentAppState: Data) => Data; // Updates pageData with current Puck state
  onPageDataSaved: (data: Data) => void;
  onDialogDataSaved: (dialogId: string, data: Data) => void;
  onDataBlockSaved: (componentId: string, data: Data) => Data; // Returns updated pageData
}

function PuckEditorWrapper({
  currentContext,
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
  onEditDataBlockTemplate,
  onBackToPage,
  onNavigateToLevel,
  onUpdatePageData,
  onPageDataSaved,
  onDialogDataSaved,
  onDataBlockSaved,
}: PuckEditorWrapperProps) {
  const isEditingDataBlock = currentContext.type === 'datablock';

  // Simpler Puck key based on editing context
  const puckKey = currentContext.type === 'page'
    ? `page-${pageId}`
    : currentContext.type === 'dialog'
      ? `dialog-${currentContext.dialogId}`
      : `datablock-${currentContext.componentId}`;

  const puckEditor = (
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
        onEditDataBlockTemplate={onEditDataBlockTemplate}
        onBackToPage={onBackToPage}
        onNavigateToLevel={onNavigateToLevel}
        onUpdatePageData={onUpdatePageData}
        onPageDataSaved={onPageDataSaved}
        onDialogDataSaved={onDialogDataSaved}
        onDataBlockSaved={onDataBlockSaved}
      />
    </Puck>
  );

  // When editing a DataBlock template, wrap with TemplateEditorProvider
  if (isEditingDataBlock) {
    return (
      <TemplateEditorProvider
        viewId={currentContext.viewId}
        tableId={currentContext.tableId}
      >
        <div className="puck-template-editor">
          {puckEditor}
        </div>
      </TemplateEditorProvider>
    );
  }

  // For page/dialog editing, render Puck directly
  return puckEditor;
}
