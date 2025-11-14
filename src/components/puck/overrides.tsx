import { ReactNode } from "react";
import type { Overrides } from "@measured/puck";
import { ThemeSidebarPanel } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { PageSettingsPanel } from "@/app/(app)/apps/components/PageSettingsPanel";

/**
 * Puck UI Overrides for Transparent Theme
 *
 * Uses the official Puck overrides API to customize UI components
 * while preserving all default functionality by rendering {children}.
 *
 * Documentation: https://puckeditor.com/docs/extending-puck/ui-overrides
 */

interface PuckUIOverridesOptions {
  pageId?: number;
  pageName?: string;
  pageSlug?: string;
  onSavePageSettings?: (data: { name: string; slug: string }) => Promise<void>;
  themeMode?: "app" | "page";
}

export const createPuckUIOverrides = (
  options?: PuckUIOverridesOptions
): Partial<Overrides> => ({
  /**
   * Fields - Right sidebar containing page settings, theme panel, and component properties
   */
  fields: ({ children, isLoading, itemSelector }) => {
    const isRootLevel = !itemSelector;

    return (
      <div className="bg-transparent">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}
        {/* Page Settings Panel */}
        {isRootLevel && options?.onSavePageSettings && options?.pageId !== undefined && (
          <div className="border-b border-border">
            <PageSettingsPanel
              pageId={options.pageId}
              initialName={options.pageName || ""}
              initialSlug={options.pageSlug || "/"}
              onSave={options.onSavePageSettings}
            />
          </div>
        )}
        {/* Theme Panel - uses context for all operations */}
        {isRootLevel && options?.themeMode && (
          <div className="border-b border-border">
            <ThemeSidebarPanel mode={options.themeMode} />
          </div>
        )}
        {children}
      </div>
    );
  },
  drawer: ({ children }) => {
    return <div className="bg-transparent">{children}</div>;
  }
});

// Backward compatibility export
export const puckUIOverrides = createPuckUIOverrides();
