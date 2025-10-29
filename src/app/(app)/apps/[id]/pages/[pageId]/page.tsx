"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Render } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { getPage } from "@/app/actions/puck-pages";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";
import { Loading } from "@/components/ui/loading";

export default function PagePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string);
  const pageId = parseInt(params.pageId as string);

  const [page, setPage] = useState<PageDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        const pageData = await getPage(pageId);
        setPage(pageData);
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/apps/${appId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to app
            </Button>
            <div>
              <h1 className="text-xl font-semibold">{page.name}</h1>
              {page.description && (
                <p className="text-sm text-muted-foreground">{page.description}</p>
              )}
            </div>
          </div>

          <Button
            onClick={() => router.push(`/apps/${appId}/pages/${pageId}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Page
          </Button>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {page.templateData ? (
            <Render config={config} data={page.templateData} />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">This page has no content yet.</p>
              <Button
                className="mt-4"
                onClick={() => router.push(`/apps/${appId}/pages/${pageId}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Start Editing
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
