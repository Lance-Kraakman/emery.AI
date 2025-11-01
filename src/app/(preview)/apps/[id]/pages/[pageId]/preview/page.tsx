/**
 * Preview Page - Client Component
 *
 * AIDEV-NOTE: Client component to support sessionStorage for previewing unsaved changes.
 * Checks sessionStorage first (unsaved editor state), falls back to database (saved state).
 * Calls resolveAllData on client to execute component resolveData functions.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resolveAllData, type Data } from "@measured/puck";
import { config } from "@/components/puck/config";
import { getPage } from "@/app/actions/puck-pages";
import { PreviewClient } from "./preview-client";
import { Loading } from "@/components/ui/loading";

export default function PreviewPage() {
  const params = useParams();
  const pageId = parseInt(params.pageId as string);

  const [resolvedData, setResolvedData] = useState<Data | null>(null);
  const [pageName, setPageName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAndResolveData() {
      try {
        setLoading(true);

        // 1. Check sessionStorage first (unsaved changes from editor)
        const savedData = sessionStorage.getItem(`preview-${pageId}`);
        let rawData: Data;

        if (savedData) {
          console.log('[PreviewPage] Loading unsaved data from sessionStorage');
          rawData = JSON.parse(savedData);
          // Still need page for name
          const page = await getPage(pageId);
          setPageName(page.name);
        } else {
          // 2. Fall back to database (saved state)
          console.log('[PreviewPage] Loading saved data from database');
          const page = await getPage(pageId);
          rawData = page.templateData || { content: [], root: {}, zones: {} };
          setPageName(page.name);
        }

        // 3. Resolve all component data (calls resolveData functions)
        console.log('[PreviewPage] Resolving component data...');
        const resolved = await resolveAllData(rawData, config, {});
        console.log('[PreviewPage] Data resolved, rendering...');

        setResolvedData(resolved);
      } catch (error) {
        console.error('[PreviewPage] Error loading/resolving data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAndResolveData();
  }, [pageId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loading text="Loading preview..." />
      </div>
    );
  }

  if (!resolvedData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <h1 className="text-2xl font-bold">No preview data</h1>
      </div>
    );
  }

  return <PreviewClient resolvedData={resolvedData} pageName={pageName} />;
}
