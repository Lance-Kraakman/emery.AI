"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getAppWithPagesBySlug,
  createTemplate,
  createPage,
  deletePage,
  deleteApp,
} from "@/puck-extraction/utils/storage";
import type { PuckAppWithPages } from "@/puck-extraction/types";

export default function AppPage() {
  const params = useParams();
  const router = useRouter();
  const appSlug = params.app_slug as string;

  const [app, setApp] = useState<PuckAppWithPages | null>(null);
  const [loading, setLoading] = useState(true);

  const loadApp = () => {
    const appData = getAppWithPagesBySlug(appSlug);
    setApp(appData);
    setLoading(false);
  };

  useEffect(() => {
    loadApp();
  }, [appSlug]);

  const handleCreatePage = () => {
    if (!app) return;

    const name = prompt("Enter page name:");
    if (!name) return;

    const slug = prompt("Enter page route (e.g., /about or /products/pricing):");
    if (!slug) return;

    // Create a new template for this page
    const template = createTemplate(
      `${name} Template`,
      `template-${Date.now()}`,
      { content: [], root: {}, zones: {} }
    );

    // Create the page
    createPage(app.id, name, slug, template.id, {
      description: "",
      isPublished: true,
    });

    loadApp();
  };

  const handleDeletePage = (pageId: string, pageName: string) => {
    if (!confirm(`Delete page "${pageName}"?`)) return;
    deletePage(pageId);
    loadApp();
  };

  const handleDeleteApp = () => {
    if (!app) return;
    if (!confirm(`Delete app "${app.name}" and all its pages?`)) return;
    deleteApp(app.id);
    router.push("/puck-demo");
  };

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  if (!app) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>App not found</h1>
        <Link
          href="/puck-demo"
          style={{ color: "#007bff", textDecoration: "underline" }}
        >
          Back to apps
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <Link
          href="/puck-demo"
          style={{ color: "#007bff", textDecoration: "none", fontSize: "14px" }}
        >
          ← Back to apps
        </Link>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "8px" }}>
          {app.name}
        </h1>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          {app.description || "No description"}
        </p>

        <div style={{ display: "flex", gap: "16px" }}>
          <button
            onClick={handleCreatePage}
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
            Create New Page
          </button>

          <button
            onClick={handleDeleteApp}
            style={{
              padding: "12px 24px",
              borderRadius: "4px",
              border: "1px solid #dc3545",
              background: "#dc3545",
              color: "#fff",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Delete App
          </button>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "16px" }}>
          Pages ({app.pages.length})
        </h2>

        {app.pages.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", border: "1px dashed #ddd", borderRadius: "8px" }}>
            <p style={{ color: "#666" }}>No pages yet. Create one to get started!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {app.pages.map((page) => (
              <div
                key={page.id}
                style={{
                  padding: "24px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "4px" }}>
                    {page.name}
                  </h3>
                  <p style={{ color: "#666", fontSize: "14px", marginBottom: "8px" }}>
                    {page.description || "No description"}
                  </p>
                  <p style={{ color: "#999", fontSize: "12px" }}>
                    Route: {page.slug} | Template: {page.template.name}
                  </p>
                  {page.isPublished && (
                    <span style={{ fontSize: "12px", color: "#28a745" }}>
                      ● Published
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <Link
                    href={`/puck-demo/${appSlug}/${page.slug.replace(/^\//, "")}`}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "1px solid #6c757d",
                      background: "#6c757d",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "14px",
                    }}
                  >
                    View
                  </Link>

                  <Link
                    href={`/puck-demo/${appSlug}/${page.slug.replace(/^\//, "")}/edit`}
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
                    Edit
                  </Link>

                  <button
                    onClick={() => handleDeletePage(page.id, page.name)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "1px solid #dc3545",
                      background: "transparent",
                      color: "#dc3545",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
