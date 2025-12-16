"use client";

import { useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewClientProps {
  pageName?: string;
}

/**
 * PreviewClient Component
 *
 * Client component that handles:
 * - Viewport switching (mobile/tablet/desktop) using an iframe
 * - Floating toolbar UI
 * - Navigation controls
 *
 * Uses an iframe to render the preview content, enabling proper CSS media query
 * behavior at different viewport widths. The iframe loads the /frame sub-route
 * which contains the actual Puck Render component.
 */
export function PreviewClient({ pageName }: PreviewClientProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");

  const viewportWidths = {
    mobile: 360,
    tablet: 768,
    desktop: 1440
  };

  // Build iframe URL with query params preserved
  const frameUrl = `/apps/${params.id}/pages/${params.pageId}/preview/frame${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  return (
    <div className="h-screen w-screen bg-slate-100 overflow-auto flex flex-col items-center">
      {/* Viewport container with iframe */}
      <div
        className="bg-white transition-all duration-300 h-full shadow-lg"
        style={{
          width: viewport === "desktop" ? "100%" : `${viewportWidths[viewport]}px`,
          maxWidth: "100%",
        }}
      >
        <iframe
          src={frameUrl}
          className="w-full h-full border-0"
          title={`Preview: ${pageName || 'Page'}`}
        />
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
