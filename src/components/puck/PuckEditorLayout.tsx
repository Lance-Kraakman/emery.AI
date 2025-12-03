"use client";

import React, { useState, useEffect } from "react";
import { Puck, usePuck } from "@measured/puck";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Settings, List, Globe, Eye, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { PageSettingsPanel } from "@/app/(app)/apps/components/PageSettingsPanel";
import { PageAccessSettings } from "@/app/(app)/apps/components/PageAccessSettings";
import { PageVariablesPanel } from "@/app/(app)/apps/components/PageVariablesPanel";
import { ThemeSidebarPanel } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { usePuckEditorTheme } from "@/components/puck/puck-editor-theme-context";
import { PuckSession } from "@/lib/puck/session-storage";
import { updatePageContent } from "@/app/actions/puck-pages";
import type { PageVariable } from "@/components/puck/types";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import type { OrganizationDTO } from "@/app/mappers/organization-mapper";

export interface PuckEditorLayoutProps {
  pageId: number;
  appId: number;
  page: PageDTO;
  app: AppDTO;
  organization: OrganizationDTO | null;
  loadedFromSessionStorage: boolean;
  setLoadedFromSessionStorage: (value: boolean) => void;
  onPublish: () => void;
  onSavePageSettings: (data: { name: string; slug: string }) => Promise<void>;
  onSaveAccessSettings: (data: { requiresAuth: boolean; allowedRoles: string[] }) => Promise<void>;
  onSavePageVariables: (variables: PageVariable[]) => Promise<void>;
  themeMode: "app" | "page";
}

export function PuckEditorLayout({
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
  onSavePageVariables,
  themeMode,
}: PuckEditorLayoutProps) {
  const router = useRouter();
  const { appState, history } = usePuck();
  const themeContext = usePuckEditorTheme();
  const [activeTab, setActiveTab] = useState<string>("blocks");
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Get current item selector (null = root level, has value = component selected)
  const itemSelector = appState.ui.itemSelector;
  const isRootLevel = itemSelector === null;

  // Auto-switch to Fields tab when a component is selected
  useEffect(() => {
    if (itemSelector !== null) {
      setActiveTab("fields");
    }
  }, [itemSelector]);

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
    } catch (err) {
      console.error('Error saving page:', err);
      toast.error("Failed to save page");
    }
  };

  const handlePreview = () => {
    PuckSession.setData(pageId, appState.data);
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2 border-b border-border bg-transparent shrink-0">
        {/* Public URL display */}
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex gap-2 items-center">
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            {hasUnsavedChanges ? "Save Changes" : "Saved"}
          </Button>
          <Button onClick={handlePreview}>
            <Eye size={16} className="mr-1" />
            Preview
          </Button>
          <Button onClick={onPublish}>
            <Globe size={16} className="mr-1" />
            {page.isPublic ? "Make Private" : "Make Public"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar with Tabs */}
        <aside className="w-[280px] border-r border-border flex flex-col bg-transparent shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
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

            {/* Blocks Tab */}
            <TabsContent value="blocks" className="flex-1 overflow-auto m-0 p-0">
              <Puck.Components />
            </TabsContent>

            {/* Fields Tab */}
            <TabsContent value="fields" className="flex-1 overflow-auto m-0 p-0">
              {/* Page-level panels (shown when no component selected) */}
              {isRootLevel && (
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
                    <PageVariablesPanel
                      pageId={pageId}
                      initialVariables={page.pageVariables || []}
                      onSave={onSavePageVariables}
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
  );
}
