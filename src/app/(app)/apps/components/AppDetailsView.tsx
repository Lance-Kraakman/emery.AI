'use client';

import React, { useEffect, useState } from 'react';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import type { ViewDTO } from '@/app/mappers/view-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Palette } from 'lucide-react';
import { appsActions } from '@/stores/apps.store';
import { updateApp, updateAppTheme } from '@/app/actions/puck-apps';
import { getPages } from '@/app/actions/puck-pages';
import { getViewsForOrganization } from '@/app/actions/views';
import { toast } from 'sonner';
import { PagesSection } from './PagesSection';
import { ViewsSection } from './ViewsSection';
import { ThemeEditorSheet } from './ThemeEditorSheet';
import { useRouter } from 'next/navigation';
import type { ThemeConfigProps } from '@/ddd/domain/puck/value-objects/theme-config';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import { PermissionsPanel } from '@/components/permissions/PermissionsPanel';

interface AppDetailsViewProps {
  app: AppDTO;
}

export function AppDetailsView({ app }: AppDetailsViewProps) {
  const router = useRouter();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [pages, setPages] = useState<PageDTO[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [dataSources, setDataSources] = useState<ViewDTO[]>([]);
  const [loadingDataSources, setLoadingDataSources] = useState(true);

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [editedName, setEditedName] = useState(app.name);
  const [editedSlug, setEditedSlug] = useState(app.slug);
  const [isSaving, setIsSaving] = useState(false);

  // Load pages for this app
  const loadPages = async () => {
    try {
      setLoadingPages(true);
      const result = await getPages(app.id);
      if (result.success && result.data) {
        setPages(result.data);
        appsActions.setPages(result.data);
      } else {
        toast.error(result.error || "Failed to load pages");
      }
    } catch (error) {
      console.error('Error loading pages:', error);
      toast.error("Failed to load pages for this app");
    } finally {
      setLoadingPages(false);
    }
  };

  // Load data sources for the organization
  const loadDataSources = async () => {
    try {
      setLoadingDataSources(true);
      const dataSourcesData = await getViewsForOrganization();
      setDataSources(dataSourcesData);
    } catch (error) {
      console.error('Error loading data sources:', error);
      toast.error("Failed to load data sources");
    } finally {
      setLoadingDataSources(false);
    }
  };

  useEffect(() => {
    loadPages();
    loadDataSources();
  }, [app.id]);

  const handleSaveName = async () => {
    if (editedName === app.name || !editedName.trim()) {
      setIsEditingName(false);
      setEditedName(app.name);
      return;
    }

    try {
      setIsSaving(true);
      const result = await updateApp(
        { id: app.id, name: editedName },
        `/apps/${app.id}`
      );

      if (!result.success) {
        toast.error(result.error || "Failed to update app name");
        setEditedName(app.name);
        return;
      }

      toast.success("App name updated");
      router.refresh();
    } catch (error) {
      console.error('Error updating app name:', error);
      toast.error("Failed to update app name");
      setEditedName(app.name);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  };

  const handleSaveSlug = async () => {
    if (editedSlug === app.slug || !editedSlug.trim()) {
      setIsEditingSlug(false);
      setEditedSlug(app.slug);
      return;
    }

    try {
      setIsSaving(true);
      const result = await updateApp(
        { id: app.id, slug: editedSlug },
        `/apps/${app.id}`
      );

      if (!result.success) {
        toast.error(result.error || "Failed to update app slug");
        setEditedSlug(app.slug);
        return;
      }

      toast.success("App slug updated");
      router.refresh();
    } catch (error) {
      console.error('Error updating app slug:', error);
      toast.error("Failed to update app slug");
      setEditedSlug(app.slug);
    } finally {
      setIsSaving(false);
      setIsEditingSlug(false);
    }
  };

  const handleSaveAppTheme = async (theme: ThemeConfigProps | undefined) => {
    try {
      const result = await updateAppTheme(app.id, theme);

      if (!result.success) {
        toast.error(result.error || "Failed to update app theme");
        return;
      }

      toast.success("App theme updated successfully");
      setThemeSheetOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error updating app theme:', error);
      toast.error("Failed to update app theme");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with inline editing */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {isEditingName ? (
            <Input
              autoFocus
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditedName(app.name);
                  setIsEditingName(false);
                }
              }}
              disabled={isSaving}
              className="text-2xl font-bold h-auto py-1 px-2 flex-1"
            />
          ) : (
            <h2
              className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
              title="Click to edit name"
            >
              {app.name}
            </h2>
          )}

          <ShareButton
            resourceType="app"
            resourceId={app.id}
            onShare={() => setShareDialogOpen(true)}
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">/</span>
          {isEditingSlug ? (
            <Input
              autoFocus
              value={editedSlug}
              onChange={(e) => setEditedSlug(e.target.value)}
              onBlur={handleSaveSlug}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSlug();
                if (e.key === 'Escape') {
                  setEditedSlug(app.slug);
                  setIsEditingSlug(false);
                }
              }}
              disabled={isSaving}
              className="text-sm h-6 py-0 px-2 w-48"
            />
          ) : (
            <span
              className="text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingSlug(true)}
              title="Click to edit slug"
            >
              {app.slug}
            </span>
          )}
        </div>
      </div>

      {/* Compact Theme Display */}
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-3">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {app.themeConfig ? "Custom Theme" : "Default Theme"}
            </span>
            {app.themeConfig && (
              <div className="flex items-center gap-1">
                {app.themeConfig.colors?.primary && (
                  <div
                    className="w-5 h-5 rounded border border-border"
                    style={{ backgroundColor: app.themeConfig.colors.primary }}
                    title={`Primary: ${app.themeConfig.colors.primary}`}
                  />
                )}
                {app.themeConfig.colors?.secondary && (
                  <div
                    className="w-5 h-5 rounded border border-border"
                    style={{ backgroundColor: app.themeConfig.colors.secondary }}
                    title={`Secondary: ${app.themeConfig.colors.secondary}`}
                  />
                )}
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setThemeSheetOpen(true)}>
          <Palette className="h-3 w-3 mr-1" />
          Edit
        </Button>
      </div>

      {/* Pages Section */}
      <PagesSection
        appId={app.id}
        pages={pages}
        loading={loadingPages}
        homePageId={app.homePageId}
        onPagesChange={loadPages}
      />

      {/* Data Sources Section */}
      <ViewsSection
        views={dataSources}
        loading={loadingDataSources}
        onViewsChange={loadDataSources}
      />

      {/* Permissions Panel */}
      <PermissionsPanel
        resourceType="app"
        resourceId={app.id}
        resourceName={app.name}
      />

      {/* Theme Editor Sheet */}
      <ThemeEditorSheet
        open={themeSheetOpen}
        onOpenChange={setThemeSheetOpen}
        initialTheme={app.themeConfig || undefined}
        onSave={handleSaveAppTheme}
        mode="app"
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        resourceType="app"
        resourceId={app.id}
        resourceName={app.name}
      />
    </div>
  );
}
