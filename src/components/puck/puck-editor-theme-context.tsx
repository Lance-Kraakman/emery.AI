/**
 * PuckEditorThemeProvider - Complete Theme Management for Puck Editor
 *
 * Manages entire theme lifecycle:
 * - Initial load from page/app/sessionStorage
 * - Live preview updates
 * - Save to database
 * - Unsaved changes tracking
 *
 * This eliminates the need for parent state management and prevents circular dependencies.
 */

"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { ThemeConfig, type ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";
import { updatePageTheme } from "@/app/actions/puck-pages";
import { toast } from "sonner";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";

interface PuckEditorThemeContextValue {
  // Current theme being displayed (effective theme: app + page override)
  currentTheme: ThemeConfig;

  // Theme for the form (page override only, or effective if no override)
  formTheme: ThemeConfigProps;

  // Update live preview (doesn't save to DB)
  updateLiveTheme: (theme: ThemeConfigProps) => void;

  // Save theme to database
  saveTheme: (theme: ThemeConfigProps | undefined) => Promise<void>;

  // Remove page theme override (revert to app theme)
  removeTheme: () => Promise<void>;

  // State flags
  hasUnsavedChanges: boolean;
}

const PuckEditorThemeContext = createContext<PuckEditorThemeContextValue | null>(null);

export interface PuckEditorThemeProviderProps {
  children: ReactNode;
  pageId: number;
  page: PageDTO;
  app: AppDTO;
}

export function PuckEditorThemeProvider({ children, pageId, page, app }: PuckEditorThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(() => {
    // Initialize with app theme or default
    return app.themeConfig ? ThemeConfig.create(app.themeConfig) : ThemeConfig.default();
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    // Check sessionStorage first for unsaved changes
    const sessionKey = `page-theme-${pageId}`;
    const savedTheme = sessionStorage.getItem(sessionKey);

    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        const appTheme = app.themeConfig
          ? ThemeConfig.create(app.themeConfig)
          : ThemeConfig.default();

        const effectiveTheme = ThemeConfig.merge(appTheme, ThemeConfig.create(parsedTheme));
        setCurrentTheme(effectiveTheme);
        setHasUnsavedChanges(true);
        return;
      } catch (err) {
        console.error('[PuckEditorTheme] Error parsing sessionStorage theme:', err);
        sessionStorage.removeItem(sessionKey);
      }
    }

    // Calculate effective theme (app + page override)
    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    const effectiveTheme = page.themeConfig
      ? ThemeConfig.merge(appTheme, ThemeConfig.create(page.themeConfig))
      : appTheme;

    setCurrentTheme(effectiveTheme);
    setHasUnsavedChanges(false);
  }, [pageId, page, app]);

  // Update live preview (doesn't save to DB)
  const updateLiveTheme = useCallback((newTheme: ThemeConfigProps) => {
    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    const effectiveTheme = ThemeConfig.merge(appTheme, ThemeConfig.create(newTheme));
    setCurrentTheme(effectiveTheme);
    setHasUnsavedChanges(true);

    // Save to sessionStorage for persistence
    const sessionKey = `page-theme-${pageId}`;
    sessionStorage.setItem(sessionKey, JSON.stringify(newTheme));
  }, [app, pageId]);

  // Save theme to database (silent background save - no re-renders)
  const saveTheme = useCallback(async (theme: ThemeConfigProps | undefined) => {
    try {
      const result = await updatePageTheme(pageId, theme);

      if (!result.success) {
        toast.error(result.error || "Failed to save theme");
        return;
      }

      toast.success("Theme saved successfully");
      setHasUnsavedChanges(false);

      // Clear sessionStorage
      const sessionKey = `page-theme-${pageId}`;
      sessionStorage.removeItem(sessionKey);
    } catch (error) {
      console.error('[PuckEditorTheme] Error saving theme:', error);
      toast.error("Failed to save theme");
    }
  }, [pageId]);

  // Remove page theme override (revert to app theme)
  const removeTheme = useCallback(async () => {
    // Revert to app theme immediately
    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    setCurrentTheme(appTheme);

    // Save undefined to database to clear override
    await saveTheme(undefined);
  }, [app, saveTheme]);

  const value: PuckEditorThemeContextValue = {
    currentTheme,
    formTheme: currentTheme.toJSON(),
    updateLiveTheme,
    saveTheme,
    removeTheme,
    hasUnsavedChanges,
  };

  return (
    <PuckEditorThemeContext.Provider value={value}>
      {children}
    </PuckEditorThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function usePuckEditorTheme(): PuckEditorThemeContextValue {
  const context = useContext(PuckEditorThemeContext);
  if (!context) {
    throw new Error("usePuckEditorTheme must be used within PuckEditorThemeProvider");
  }
  return context;
}
