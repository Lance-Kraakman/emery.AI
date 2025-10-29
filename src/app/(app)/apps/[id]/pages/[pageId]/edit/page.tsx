"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Puck, Data, usePuck, IconButton, Button as PuckButton } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { getPage, updatePageContent, publishPage, unpublishPage } from "@/app/actions/puck-pages";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Eye, Undo2, Redo2, Monitor, Tablet, Smartphone, Globe } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { toast } from "sonner";

// Custom header actions component with full Puck controls
function CustomHeaderActions({
  children,
  onSave,
  onPreview,
  onPublish,
  saving,
  hasUnsavedChanges,
  isPublished
}: {
  children: ReactNode;
  onSave: () => void;
  onPreview: () => void;
  onPublish: () => void;
  saving: boolean;
  hasUnsavedChanges: boolean;
  isPublished: boolean;
}) {
  const { history, appState, dispatch } = usePuck();

  const handleViewportChange = (width: number, height: number | "auto") => {
    dispatch({
      type: "setUi",
      ui: {
        viewports: {
          ...appState.ui.viewports,
          current: { width, height }
        }
      }
    });
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Undo/Redo Controls */}
      <div className="flex gap-1">
        <IconButton
          title="Undo"
          disabled={!history.hasPast}
          onClick={history.back}
        >
          <Undo2 size={21} />
        </IconButton>
        <IconButton
          title="Redo"
          disabled={!history.hasFuture}
          onClick={history.forward}
        >
          <Redo2 size={21} />
        </IconButton>
      </div>

      {/* Viewport/Frame Controls */}
      <div className="flex gap-1 border-l pl-2 ml-2">
        {appState.ui.viewports.options.map((viewport) => {
          const isActive = appState.ui.viewports.current.width === viewport.width;
          return (
            <div key={viewport.width} style={isActive ? { backgroundColor: '#e0f2fe' } : {}}>
              <IconButton
                title={viewport.label || `${viewport.width}px`}
                onClick={() => handleViewportChange(viewport.width, viewport.height || "auto")}
              >
                {viewport.icon === "Smartphone" && <Smartphone size={16} />}
                {viewport.icon === "Tablet" && <Tablet size={16} />}
                {viewport.icon === "Monitor" && <Monitor size={16} />}
              </IconButton>
            </div>
          );
        })}
      </div>

      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      {/* Custom Action Buttons */}
      <div className="flex gap-2 items-center">
        <PuckButton
          onClick={onSave}
          disabled={saving || !hasUnsavedChanges}
          loading={saving}
          size="medium"
        >
          {hasUnsavedChanges ? "Save Changes" : "Saved"}
        </PuckButton>

        <PuckButton
          onClick={onPreview}
          size="medium"
        >
          <Eye size={16} className="mr-1" />
          Preview
        </PuckButton>

        <PuckButton
          onClick={onPublish}
          size="medium"
        >
          <Globe size={16} className="mr-1" />
          {isPublished ? "Unpublish" : "Publish"}
        </PuckButton>
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
  const [pageData, setPageData] = useState<Data>({ content: [], root: {}, zones: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        const loadedPage = await getPage(pageId);
        setPage(loadedPage);

        // Initialize pageData with loaded content or empty structure
        const initialData: Data = loadedPage.templateData || {
          content: [],
          root: {},
          zones: {}
        };
        setPageData(initialData);
      } catch (err) {
        console.error('Error loading page:', err);
        setError(err instanceof Error ? err.message : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    }

    if (pageId) {
      loadPage();
    }
  }, [pageId]);

  const handleDataChange = (data: Data) => {
    setPageData(data);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!page) return;

    try {
      setSaving(true);

      // Update the page content
      const result = await updatePageContent({
        id: pageId,
        templateData: pageData
      }, `/apps/${appId}/pages/${pageId}/edit`);

      if (!result.success) {
        toast.error(result.error || "Failed to save page");
        return;
      }

      toast.success("Page saved successfully!");
      setHasUnsavedChanges(false);

      // Update local state
      setPage(prev => prev ? { ...prev, templateData: pageData } : null);
    } catch (err) {
      console.error('Error saving page:', err);
      toast.error("Failed to save page");
    } finally {
      setSaving(false);
    }
  };

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

  const handlePreview = () => {
    router.push(`/apps/${appId}/pages/${pageId}`);
  };

  const handleCancel = () => {
    router.push(`/apps/${appId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading text="Loading page..." />
      </div>
    );
  }

  if (error || !page) {
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b bg-background/95">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-lg font-semibold flex-1">
          Editing: {page.name}
        </h1>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
        >
          {saving ? (
            <>
              <Save className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {hasUnsavedChanges ? "Save Changes" : "Saved"}
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>

        <Button
          variant={page.isPublished ? "secondary" : "default"}
          size="sm"
          onClick={handlePublish}
        >
          {page.isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>

      {/* Puck Editor with Custom Layout */}
      <div className="flex-1 overflow-hidden">
        <Puck
          config={config}
          data={pageData}
          onChange={handleDataChange}
          headerTitle={page.name}
          headerPath={`/apps/${appId}/pages/${pageId}`}
          viewports={[
            { width: 360, height: "auto", icon: "Smartphone", label: "Mobile" },
            { width: 768, height: "auto", icon: "Tablet", label: "Tablet" },
            { width: 1440, height: "auto", icon: "Monitor", label: "Desktop" }
          ]}
          iframe={{ enabled: true }}
          overrides={{
            headerActions: ({ children }) => (
              <CustomHeaderActions
                onSave={handleSave}
                onPreview={handlePreview}
                onPublish={handlePublish}
                saving={saving}
                hasUnsavedChanges={hasUnsavedChanges}
                isPublished={page?.isPublished || false}
              >
                {children}
              </CustomHeaderActions>
            )
          }}
        >
          <div className="grid grid-cols-4 h-full">
            {/* Left: Components & Outline (1/4) */}
            <div className="col-span-1 h-full overflow-y-auto border-r">
              <Puck.Components />
              <div className="border-t">
                <Puck.Outline />
              </div>
            </div>

            {/* Center: Preview (2/4) */}
            <div className="col-span-2 h-full overflow-y-auto">
              <Puck.Preview />
            </div>

            {/* Right: Fields (1/4) */}
            <div className="col-span-1 h-full overflow-y-auto border-l">
              <Puck.Fields />
            </div>
          </div>
        </Puck>
      </div>
    </div>
  );
}
