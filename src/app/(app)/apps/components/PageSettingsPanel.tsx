/**
 * PageSettingsPanel - Compact Page Metadata Editor for Puck Sidebar
 *
 * AIDEV-NOTE: Allows editing page name and slug directly in the Puck editor sidebar.
 * Positioned above the theme panel in the right sidebar.
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface PageSettingsPanelProps {
  pageId: number;
  initialName: string;
  initialSlug: string;
  onSave: (data: { name: string; slug: string }) => Promise<void>;
}

export function PageSettingsPanel({
  pageId,
  initialName,
  initialSlug,
  onSave,
}: PageSettingsPanelProps) {
  const [name, setName] = React.useState(initialName);
  const [slug, setSlug] = React.useState(initialSlug);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Track changes
  React.useEffect(() => {
    const changed = name !== initialName || slug !== initialSlug;
    setHasChanges(changed);
  }, [name, slug, initialName, initialSlug]);

  // Reset when initial values change (e.g., after save)
  React.useEffect(() => {
    setName(initialName);
    setSlug(initialSlug);
  }, [initialName, initialSlug]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Validate
      if (!name.trim()) {
        toast.error("Page name is required");
        return;
      }

      if (!slug.match(/^\/[a-z0-9-\/]*[a-z0-9]$/)) {
        toast.error(
          "Slug must start with /, contain only lowercase letters, numbers, and hyphens, and end with a letter or number"
        );
        return;
      }

      await onSave({ name: name.trim(), slug: slug.trim() });
      toast.success("Page settings updated");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving page settings:", error);
      toast.error("Failed to save page settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSlugChange = (value: string) => {
    // Auto-format slug as user types
    let formatted = value.toLowerCase();
    // Ensure it starts with /
    if (!formatted.startsWith("/")) {
      formatted = "/" + formatted;
    }
    // Remove invalid characters
    formatted = formatted.replace(/[^a-z0-9\/-]/g, "-");
    // Remove consecutive hyphens
    formatted = formatted.replace(/-+/g, "-");
    setSlug(formatted);
  };

  return (
    <div className="w-full space-y-1.5 px-3 py-2">
      <div className="space-y-1.5">
        <div className="space-y-1">
          <Label className="text-xs">Page Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Page"
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Page Slug</Label>
          <Input
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="/my-page"
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground leading-tight">
            URL path (e.g., /about or /products/new)
          </p>
        </div>

        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="w-full h-7 text-xs"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
    </div>
  );
}
