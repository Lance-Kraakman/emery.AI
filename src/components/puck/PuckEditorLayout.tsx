"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Puck, usePuck, type Data } from "@measured/puck";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Settings, List, Globe, Eye, ExternalLink, Copy, Check, Undo2, Redo2 } from "lucide-react";
import { toast } from "sonner";
import { PageSettingsPanel } from "@/app/(app)/apps/components/PageSettingsPanel";
import { PageAccessSettings } from "@/app/(app)/apps/components/PageAccessSettings";
import { PageStatePanel } from "@/app/(app)/apps/components/PageStatePanel";
import { ThemeSidebarPanel } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { usePuckEditorTheme } from "@/components/puck/puck-editor-theme-context";
import { PuckSession } from "@/lib/puck/session-storage";
import { updatePageContent, updatePageDialogs } from "@/app/actions/puck-pages";
import { ComponentBreadcrumb } from "@/components/puck/ComponentBreadcrumb";
import { EditorUIProvider, useEditorUI } from "@/components/puck/contexts/EditorUIContext";
import { EditingStackProvider, useEditingStack } from "@/components/puck/contexts/EditingStackContext";
import type { PageStateConfig } from "@/components/puck/types/state";
import type { PageDialogsConfig } from "@/ddd/domain/puck/value-objects/page-dialogs";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import { PageDialogsPanel } from "@/app/(app)/apps/components/PageDialogsPanel";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { OrganizationDTO } from "@/app/mappers/organization-mapper";
import type { EditingContextItem, EditingTarget } from "@/components/puck/types/editing-context";

export interface PuckEditorLayoutProps {
  pageId: number;
  appId: number;
  page: PageDTO;
  app: AppDTO;
  organization: OrganizationDTO | null;
  pageData: Data; // Full page data for saving nested content
  loadedFromSessionStorage: boolean;
  setLoadedFromSessionStorage: (value: boolean) => void;
  onPublish: () => void;
  onSavePageSettings: (data: { name: string; slug: string }) => Promise<void>;
  onSaveAccessSettings: (data: { requiresAuth: boolean; allowedRoles: string[] }) => Promise<void>;
  onSavePageState: (pageState: PageStateConfig | undefined) => Promise<void>;
  onSavePageDialogs: (pageDialogs: PageDialogsConfig | undefined) => Promise<void>;
  themeMode: "app" | "page";
  editingTarget: EditingTarget;
  editingStack: EditingContextItem[];
  onEditDialogContent: (dialogId: string) => void;
  onEditDataBlockTemplate: (componentId: string, name: string, templateContent: Data, viewId: number, tableId: number, currentAppState: Data) => void;
  onBackToPage: () => void;
  onNavigateToLevel: (level: number) => void;
  onUpdatePageData: (currentAppState: Data) => Data; // Updates pageData with current Puck state
  onPageDataSaved: (data: Data) => void;
  onDialogDataSaved: (dialogId: string, data: Data) => void;
  onDataBlockSaved: (componentId: string, data: Data) => Data; // Returns updated pageData
}

function PuckEditorLayoutInner({
  pageId,
  appId,
  page,
  app,
  organization,
  pageData,
  loadedFromSessionStorage,
  setLoadedFromSessionStorage,
  onPublish,
  onSavePageSettings,
  onSaveAccessSettings,
  onSavePageState,
  onSavePageDialogs,
  themeMode,
  editingTarget,
  editingStack,
  onEditDialogContent,
  onEditDataBlockTemplate,
  onBackToPage,
  onNavigateToLevel,
  onUpdatePageData,
  onPageDataSaved,
  onDialogDataSaved,
  onDataBlockSaved,
}: PuckEditorLayoutProps) {
  const router = useRouter();
  const { appState, history } = usePuck();
  const themeContext = usePuckEditorTheme();
  const { activeTab, navigateToTab } = useEditorUI();
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Get the outer editing stack actions (from page.tsx)
  const outerEditingStack = useEditingStack();

  // Create enhanced pushDataBlock that injects appState.data
  // This allows DataBlockTemplateField to call pushDataBlock without needing usePuck()
  const handlePushDataBlock = useCallback((
    componentId: string,
    name: string,
    templateContent: Data,
    viewId: number,
    tableId: number
  ) => {
    // Call the page.tsx handler with appState.data injected
    onEditDataBlockTemplate(componentId, name, templateContent, viewId, tableId, appState.data);
  }, [onEditDataBlockTemplate, appState.data]);

  // Enhanced editing stack actions that inject Puck state where needed
  const enhancedEditingStack = useMemo(() => ({
    ...outerEditingStack,
    pushDataBlock: handlePushDataBlock,
  }), [outerEditingStack, handlePushDataBlock]);

  // Wrapper for tabs onValueChange to ensure type safety
  const handleTabChange = (value: string) => {
    if (value === 'blocks' || value === 'fields' || value === 'outline') {
      navigateToTab(value);
    }
  };

  // Get current item selector (null = root level, has value = component selected)
  const itemSelector = appState.ui.itemSelector;
  const isRootLevel = itemSelector === null;

  // Auto-switch to Fields tab when a component is selected
  useEffect(() => {
    if (itemSelector !== null) {
      navigateToTab("fields");
    }
  }, [itemSelector, navigateToTab]);

  // Detect unsaved changes
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
      // Get current editing context from stack
      const currentContext = editingStack[editingStack.length - 1];

      if (currentContext.type === 'page') {
        // Save theme first if needed
        if (themeContext.hasUnsavedChanges) {
          const themeData = PuckSession.getTheme(pageId);
          if (themeData) {
            await themeContext.saveTheme(themeData);
          }
        }

        // Save page content
        const result = await updatePageContent({
          id: pageId,
          templateData: appState.data
        });

        if (!result.success) {
          toast.error(result.error || "Failed to save page");
          return;
        }

        toast.success("Page saved successfully!");
        PuckSession.clearData(pageId);
        setLoadedFromSessionStorage(false);
        // Update local pageData state so switching to dialog and back preserves content
        onPageDataSaved(appState.data);
      } else if (currentContext.type === 'dialog') {
        // Save dialog content
        const updatedDialogs = page.pageDialogs?.dialogs?.map(d =>
          d.id === currentContext.dialogId
            ? { ...d, content: appState.data }
            : d
        ) || [];

        const result = await updatePageDialogs(pageId, { dialogs: updatedDialogs });

        if (!result.success) {
          toast.error(result.error || "Failed to save dialog");
          return;
        }

        toast.success("Dialog saved successfully!");
        // Update local dialogData and page.pageDialogs state
        onDialogDataSaved(currentContext.dialogId, appState.data);
      } else if (currentContext.type === 'datablock') {
        // Update template in pageData (bubbles through stack) and save entire page to DB
        const updatedPageData = onDataBlockSaved(currentContext.componentId, appState.data);

        const result = await updatePageContent({
          id: pageId,
          templateData: updatedPageData
        });

        if (!result.success) {
          toast.error(result.error || "Failed to save template");
          return;
        }

        toast.success("Template saved!");
        PuckSession.clearData(pageId);
        setLoadedFromSessionStorage(false);
      }
    } catch (err) {
      console.error('Error saving:', err);
      const currentContext = editingStack[editingStack.length - 1];
      const entityName = currentContext.type === 'page' ? 'page'
        : currentContext.type === 'dialog' ? 'dialog'
        : 'template';
      toast.error(`Failed to save ${entityName}`);
    }
  };

  const handlePreview = () => {
    // Only save to session when editing the PAGE itself
    // When editing dialog/datablock, the page data is already in session
    // (saved by page.tsx when entering nested content)
    const currentContext = editingStack[editingStack.length - 1];
    if (currentContext.type === 'page') {
      PuckSession.setData(pageId, appState.data);
    }
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

  const handleUndo = () => {
    history.back();
  };

  const handleRedo = () => {
    history.forward();
  };

  // Wrapper that saves current Puck state to pageData BEFORE navigating
  // This ensures nested DataBlock changes are preserved when using breadcrumb
  // Uses requestAnimationFrame to ensure pageData state update completes before
  // we change the editing stack (fixes race condition with currentData derivation)
  const handleSaveAndNavigateToLevel = (level: number) => {
    onUpdatePageData(appState.data);
    requestAnimationFrame(() => {
      onNavigateToLevel(level);
    });
  };

  return (
    <EditingStackProvider value={enhancedEditingStack}>
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 border-b border-border bg-transparent shrink-0">
        {/* Public URL display */}
        {page.isPublic && publicUrl && (
          <div className="flex items-center gap-1 px-1.5 sm:px-2 py-1 bg-muted/50 rounded-md border border-border min-w-0 shrink">
            <span
              className="text-xs text-muted-foreground font-mono truncate min-w-0"
              style={{ direction: 'rtl', textAlign: 'left' }}
              title={fullPublicUrl || undefined}
            >
              {publicUrl}
            </span>
            <button
              onClick={handleCopyUrl}
              className="p-0.5 hover:bg-background rounded transition-colors shrink-0"
              title="Copy URL"
            >
              {copiedUrl ? (
                <Check size={12} className="text-green-600" />
              ) : (
                <Copy size={12} className="text-muted-foreground" />
              )}
            </button>
            <button
              onClick={handleOpenPublicPage}
              className="p-0.5 hover:bg-background rounded transition-colors shrink-0"
              title="Open in new tab"
            >
              <ExternalLink size={12} className="text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex gap-1 sm:gap-2 items-center">
          <Button
            onClick={handleUndo}
            disabled={!history.hasPast}
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Undo"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            onClick={handleRedo}
            disabled={!history.hasFuture}
            size="icon"
            variant="outline"
            className="h-8 w-8"
            title="Redo"
          >
            <Redo2 size={16} />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button onClick={handleSave} disabled={!hasUnsavedChanges} size="sm">
            {hasUnsavedChanges ? "Save Changes" : "Saved"}
          </Button>
          <Button onClick={handlePreview} size="icon" variant="outline" className="h-8 w-8" title="Preview">
            <Eye size={16} />
          </Button>
          <Button
            onClick={onPublish}
            size="icon"
            variant={page.isPublic ? "default" : "outline"}
            className="h-8 w-8"
            title={page.isPublic ? "Make Private" : "Make Public"}
          >
            <Globe size={16} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar with Tabs */}
        <aside className="w-[280px] border-r border-border flex flex-col bg-transparent shrink-0">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-3 shrink-0 m-2" style={{ width: "calc(100% - 16px)" }}>
              <TabsTrigger value="blocks" className="text-xs gap-1 flex items-center justify-center">
                <LayoutGrid className="h-3 w-3" />
                Blocks
              </TabsTrigger>
              <TabsTrigger value="fields" className="text-xs gap-1 flex items-center justify-center">
                <Settings className="h-3 w-3" />
                Fields
              </TabsTrigger>
              <TabsTrigger value="outline" className="text-xs gap-1 flex items-center justify-center">
                <List className="h-3 w-3" />
                Outline
              </TabsTrigger>
            </TabsList>

            {/* Component breadcrumb - shows editing context + current selection */}
            <ComponentBreadcrumb
              editingStack={editingStack}
              onNavigate={handleSaveAndNavigateToLevel}
            />

            {/* Blocks Tab */}
            <TabsContent value="blocks" className="flex-1 overflow-auto m-0 p-2">
              <Puck.Components />
            </TabsContent>

            {/* Fields Tab */}
            <TabsContent value="fields" className="flex-1 overflow-auto m-0 p-0">

              {/* Page-level panels (shown when editing page AND no component selected) */}
              {isRootLevel && editingTarget === 'page' && (
                <>
                  <div className="border-b border-border">
                    <PageSettingsPanel
                      pageId={pageId}
                      initialName={page.name}
                      initialSlug={page.slug}
                      onSave={onSavePageSettings}
                    />
                  </div>
                  <div className="border-b border-border">
                    <PageAccessSettings
                      pageId={pageId}
                      isPublic={page.isPublic}
                      initialRequiresAuth={page.requiresAuth}
                      initialAllowedRoles={page.allowedRoles || []}
                      onSave={onSaveAccessSettings}
                    />
                  </div>
                  <div className="border-b border-border">
                    <PageStatePanel
                      pageId={pageId}
                      initialState={page.pageState}
                      onSave={onSavePageState}
                    />
                  </div>
                  <div className="border-b border-border">
                    <PageDialogsPanel
                      pageDialogs={page.pageDialogs}
                      pageState={page.pageState}
                      onChange={onSavePageDialogs}
                      onEditContent={onEditDialogContent}
                    />
                  </div>
                  <div className="border-b border-border">
                    <ThemeSidebarPanel mode={themeMode} />
                  </div>
                </>
              )}
              <Puck.Fields />
            </TabsContent>

            {/* Outline Tab */}
            <TabsContent value="outline" className="flex-1 overflow-auto m-0 p-2">
              <Puck.Outline />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Canvas */}
        <main className="flex-1 overflow-hidden">
          <Puck.Preview />
        </main>
      </div>
    </div>
    </EditingStackProvider>
  );
}

export function PuckEditorLayout(props: PuckEditorLayoutProps) {
  return (
    <EditorUIProvider>
      <PuckEditorLayoutInner {...props} />
    </EditorUIProvider>
  );
}
