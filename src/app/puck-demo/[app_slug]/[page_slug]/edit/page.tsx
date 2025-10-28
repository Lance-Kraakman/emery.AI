"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Puck, Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { getPageBySlug, updateTemplate, getPageWithTemplate } from "@/puck-extraction/utils/storage";
import type { PuckPageWithTemplate } from "@/puck-extraction/types";

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const appSlug = params.app_slug as string;
  const pageSlug = `/${params.page_slug as string}`;

  const [page, setPage] = useState<PuckPageWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pageData = getPageBySlug(appSlug, pageSlug);
    if (pageData) {
      const fullPage = getPageWithTemplate(pageData.id);
      setPage(fullPage);
    }
    setLoading(false);
  }, [appSlug, pageSlug]);

  const handleSave = (data: Data) => {
    if (!page) return;

    // Update the template with new data
    updateTemplate(page.templateId, { data });

    alert("Page saved!");
  };

  const handleCancel = () => {
    router.push(`/puck-demo/${appSlug}/${params.page_slug}`);
  };

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  if (!page) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Page not found</h1>
        <button
          onClick={() => router.push(`/puck-demo/${appSlug}`)}
          style={{
            padding: "12px 24px",
            borderRadius: "4px",
            border: "1px solid #007bff",
            background: "#007bff",
            color: "#fff",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          Back to app
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          gap: "16px",
          alignItems: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", flex: 1 }}>
          Editing: {page.name}
        </h1>

        <button
          onClick={handleCancel}
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            border: "1px solid #6c757d",
            background: "transparent",
            color: "#6c757d",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Cancel
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <Puck
          config={config}
          data={page.template.data}
          onPublish={handleSave}
        />
      </div>
    </div>
  );
}
