"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Render, type Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { getPage } from "@/app/actions/puck-pages";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, X, ArrowLeft } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export default function PreviewPage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string);
  const pageId = parseInt(params.pageId as string);

  const [pageData, setPageData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    // Try to get data from sessionStorage first (unsaved changes from editor)
    const savedData = sessionStorage.getItem(`preview-${pageId}`);
    if (savedData) {
      try {
        setPageData(JSON.parse(savedData));
        setLoading(false);
        // Keep sessionStorage intact so user can return to editor without losing data
        return;
      } catch (err) {
        console.error('Error parsing preview data:', err);
      }
    }

    // Fallback to loading from database
    async function loadPage() {
      try {
        const page = await getPage(pageId);
        setPageData(page.templateData || { content: [], root: {}, zones: {} });
      } catch (err) {
        console.error('Error loading page:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [pageId]);

  const viewportWidths = {
    mobile: 360,
    tablet: 768,
    desktop: 1440
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loading text="Loading preview..." />
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <h1 className="text-2xl font-bold">No preview data</h1>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white overflow-auto flex flex-col items-center">
      {/* Viewport container */}
      <div
        className="bg-white transition-all duration-300 min-h-screen"
        style={{
          width: viewport === "desktop" ? "100%" : `${viewportWidths[viewport]}px`,
          maxWidth: "100%"
        }}
      >
        <Render config={config} data={pageData} />
      </div>

      {/* Floating Action Button + Toolbar */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
        {/* Expanded Toolbar */}
        {isToolbarOpen && (
          <div className="flex flex-col gap-2 bg-white rounded-lg shadow-lg p-3 border animate-in slide-in-from-bottom-2">
            {/* Viewport Controls */}
            <div className="flex gap-2 pb-2 border-b">
              <Button
                variant={viewport === "mobile" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewport("mobile")}
                title="Mobile (360px)"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button
                variant={viewport === "tablet" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewport("tablet")}
                title="Tablet (768px)"
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={viewport === "desktop" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewport("desktop")}
                title="Desktop (1440px)"
              >
                <Monitor className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="w-full justify-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        )}

        {/* FAB Toggle Button */}
        <Button
          size="lg"
          className={cn(
            "rounded-full h-14 w-14 shadow-lg",
            isToolbarOpen && "rotate-45"
          )}
          onClick={() => setIsToolbarOpen(!isToolbarOpen)}
        >
          {isToolbarOpen ? <X className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
