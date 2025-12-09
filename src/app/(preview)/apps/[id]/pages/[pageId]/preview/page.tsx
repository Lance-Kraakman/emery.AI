/**
 * Preview Page - Wrapper for iframe-based preview
 *
 * This page renders the PreviewClient which uses an iframe to load
 * the actual preview content from the /frame sub-route. This enables
 * proper CSS media query behavior when simulating different viewport sizes.
 *
 * The iframe approach solves the issue where setting container width
 * doesn't trigger CSS @media breakpoints (they respond to viewport, not container).
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPage } from "@/app/actions/puck-pages";
import { PreviewClient } from "./preview-client";
import { Loading } from "@/components/ui/loading";

export default function PreviewPage() {
  const params = useParams();
  const pageId = parseInt(params.pageId as string);

  const [pageName, setPageName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPageName() {
      try {
        const pageResult = await getPage(pageId);
        if (pageResult.success && pageResult.data) {
          setPageName(pageResult.data.name);
        }
      } catch (error) {
        console.error('[PreviewPage] Error loading page name:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPageName();
  }, [pageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <Loading text="Loading preview..." />
      </div>
    );
  }

  return <PreviewClient pageName={pageName} />;
}
