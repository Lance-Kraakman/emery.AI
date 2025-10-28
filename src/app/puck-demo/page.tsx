"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initializeDemoData, getApps, createApp } from "@/puck-extraction/utils/storage";
import type { PuckApp } from "@/puck-extraction/types";

export default function PuckDemoPage() {
  const [apps, setApps] = useState<PuckApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeDemoData();
    setApps(getApps());
    setLoading(false);
  }, []);

  const handleCreateApp = () => {
    const name = prompt("Enter app name:");
    if (!name) return;

    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const newApp = createApp(name, slug, "");
    setApps(getApps());
  };

  if (loading) {
    return <div style={{ padding: "40px" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "16px" }}>
          Puck App Builder Demo
        </h1>
        <p style={{ color: "#666", marginBottom: "24px" }}>
          Select an app to view its pages and templates
        </p>
        <button
          onClick={handleCreateApp}
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
          Create New App
        </button>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {apps.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", border: "1px dashed #ddd", borderRadius: "8px" }}>
            <p style={{ color: "#666" }}>No apps found. Create one to get started!</p>
          </div>
        ) : (
          apps.map((app) => (
            <Link
              key={app.id}
              href={`/puck-demo/${app.slug}`}
              style={{
                padding: "24px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#007bff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#ddd";
              }}
            >
              <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "8px" }}>
                {app.name}
              </h2>
              <p style={{ color: "#666", fontSize: "14px" }}>
                {app.description || "No description"}
              </p>
              <p style={{ color: "#999", fontSize: "12px", marginTop: "8px" }}>
                Slug: /{app.slug}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
