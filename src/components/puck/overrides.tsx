import { ReactNode } from "react";
import type { Overrides } from "@measured/puck";
import { ThemeSidebarPanel } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { PageSettingsPanel } from "@/app/(app)/apps/components/PageSettingsPanel";
import type { ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";

/**
 * Puck UI Overrides for Transparent Theme
 *
 * Uses the official Puck overrides API to customize UI components
 * while preserving all default functionality by rendering {children}.
 *
 * Key Pattern: Always render {children} to maintain Puck's behavior.
 *
 * Documentation: https://puckeditor.com/docs/extending-puck/ui-overrides
 */

interface PuckUIOverridesOptions {
  // Page settings
  pageId?: number;
  pageName?: string;
  pageSlug?: string;
  onSavePageSettings?: (data: { name: string; slug: string }) => Promise<void>;
  // Theme settings
  themeConfig?: any; // ThemeConfigProps from DTO
  onSaveTheme?: (theme: ThemeConfigProps | undefined) => Promise<void>;
  themeMode?: "app" | "page";
}

export const createPuckUIOverrides = (
  options?: PuckUIOverridesOptions
): Partial<Overrides> => ({
  /**
   * Fields - Right sidebar containing page settings, theme panel, and component properties
   * Makes the fields panel background transparent and adds custom panels
   */
  fields: ({ children, isLoading, itemSelector }) => {
    // Only show page/theme panels when no component is selected (root level)
    const isRootLevel = !itemSelector;

    return (
      <div className="bg-transparent">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        )}
        {/* Page Settings Panel - shown only at root level when page options are provided */}
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
        {/* Theme Panel - shown only at root level when theme options are provided */}
        {isRootLevel && options?.onSaveTheme && options?.themeMode && (
          <div className="border-b border-border">
            <ThemeSidebarPanel
              key={JSON.stringify(options.themeConfig)}
              initialTheme={options.themeConfig}
              onSave={options.onSaveTheme}
              mode={options.themeMode}
            />
          </div>
        )}
        {children}
      </div>
    );
  },
});

// Backward compatibility export with no theme options
export const puckUIOverrides = createPuckUIOverrides();
