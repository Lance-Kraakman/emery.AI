"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Render } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { getPageBySlug } from "@/puck-extraction/utils/storage";
import type { PuckPageWithTemplate } from "@/puck-extraction/types";

export default function PageViewerPage() {
  const params = useParams();
  const appSlug = params.app_slug as string;
  const pageSlug = `/${params.page_slug as string}`;

  const [page, setPage] = useState<PuckPageWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pageData = getPageBySlug(appSlug, pageSlug);
    if (pageData) {
      const template = { id: "", name: "", slug: "", data: { content: [], root: {}, zones: {} }, createdAt: new Date(), updatedAt: new Date() };
      // Get the full page with template
      const storage = require("@/puck-extraction/utils/storage");
      const fullPage = storage.getPageWithTemplate(pageData.id);
      setPage(fullPage);
    }
    setLoading(false);
  }, [appSlug, pageSlug]);

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  if (!page) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Page not found</h1>
        <Link
          href={`/puck-demo/${appSlug}`}
          style={{ color: "#007bff", textDecoration: "underline" }}
        >
          Back to app
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #ddd",
          background: "#f5f5f5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Link
            href={`/puck-demo/${appSlug}`}
            style={{ color: "#007bff", textDecoration: "none", fontSize: "14px" }}
          >
            ← Back to app
          </Link>
          <h1 style={{ margin: "8px 0 0 0", fontSize: "20px", fontWeight: "600" }}>
            {page.name}
          </h1>
        </div>

        <Link
          href={`/puck-demo/${appSlug}/${params.page_slug}/edit`}
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            border: "1px solid #007bff",
            background: "#007bff",
            color: "#fff",
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          Edit Page
        </Link>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        <Render config={config} data={page.template.data} />
      </div>
    </div>
  );
}
