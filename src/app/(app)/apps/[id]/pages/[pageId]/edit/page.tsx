"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Puck, Data, usePuck } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/components/puck/config";
import { getPage, updatePageContent, publishPage, unpublishPage } from "@/app/actions/puck-pages";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Eye } from "lucide-react";
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
  // AIDEV-NOTE: The `children` prop only contains Puck's default Publish button.
  // We don't render it because we provide our own custom Publish/Unpublish button.
  // Undo/redo buttons are hardcoded in Puck's MenuBar and render automatically.
  // Viewport buttons are configured via the `viewports` prop and render in a separate row.

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      {/* Custom Action Buttons */}
      <div className="flex gap-2 items-center">
        <Button
          onClick={onSave}
          disabled={saving || !hasUnsavedChanges}
        >
          {hasUnsavedChanges ? "Save Changes" : "Saved"}
        </Button>

        <Button
          onClick={onPreview}
        >
          <Eye size={16} className="mr-1" />
          Preview
        </Button>

        <Button
          onClick={onPublish}
        >
          <Globe size={16} className="mr-1" />
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

// AIDEV-NOTE: Memoized Puck editor component to prevent re-renders from sidebar context changes.
// This prevents the iframe from redrawing when the sidebar collapses/expands.
const PuckEditor = React.memo(function PuckEditor({
  pageId,
  appId,
  page,
  pageData,
  handleDataChange,
  handleSave,
  handlePreview,
  handlePublish,
  saving,
  hasUnsavedChanges,
}: {
  pageId: number;
  appId: number;
  page: PageDTO;
  pageData: Data;
  handleDataChange: (data: Data) => void;
  handleSave: () => void;
  handlePreview: () => void;
  handlePublish: () => void;
  saving: boolean;
  hasUnsavedChanges: boolean;
}) {
  return (
    <Puck
      key={`puck-editor-${pageId}`}
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
    />
  );
});

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

        // First check if we have unsaved changes in sessionStorage (returning from preview)
        const savedData = sessionStorage.getItem(`preview-${pageId}`);
        if (savedData) {
          try {
            const restoredData = JSON.parse(savedData);
            const loadedPage = await getPage(pageId);
            setPage(loadedPage);
            setPageData(restoredData);
            setHasUnsavedChanges(true); // Mark as having unsaved changes
            setLoading(false);
            return;
          } catch (err) {
            console.error('Error parsing saved preview data:', err);
            // Continue to normal load if parsing fails
          }
        }

        // Normal load from database
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

      // Clean up sessionStorage since changes are now saved
      sessionStorage.removeItem(`preview-${pageId}`);

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
    // Save current pageData to sessionStorage so preview can access unsaved changes
    sessionStorage.setItem(`preview-${pageId}`, JSON.stringify(pageData));
    // Navigate to preview route
    router.push(`/apps/${appId}/pages/${pageId}/preview`);
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
    <div className="h-screen">
      <PuckEditor
        pageId={pageId}
        appId={appId}
        page={page}
        pageData={pageData}
        handleDataChange={handleDataChange}
        handleSave={handleSave}
        handlePreview={handlePreview}
        handlePublish={handlePublish}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </div>
  );
}
