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

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { ThemeConfig, type ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";
import { updatePageTheme } from "@/app/actions/puck-pages";
import { toast } from "sonner";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";
import { PuckSession } from "@/lib/puck/session-storage";

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

  // Track if we're in a save operation to prevent re-setting sessionStorage
  const isSavingRef = useRef(false);

  // Initialize theme on mount
  useEffect(() => {
    console.log('[PuckEditorTheme] useEffect - Initializing theme');
    console.log('[PuckEditorTheme] useEffect - page.themeConfig:', page.themeConfig);
    console.log('[PuckEditorTheme] useEffect - app.themeConfig:', app.themeConfig);

    // Check sessionStorage first for unsaved changes
    const savedTheme = PuckSession.getTheme(pageId);
    console.log('[PuckEditorTheme] useEffect - sessionStorage theme:', savedTheme);

    if (savedTheme) {
      try {
        const appTheme = app.themeConfig
          ? ThemeConfig.create(app.themeConfig)
          : ThemeConfig.default();

        const effectiveTheme = ThemeConfig.merge(appTheme, ThemeConfig.create(savedTheme));
        console.log('[PuckEditorTheme] useEffect - Using sessionStorage theme:', effectiveTheme.toJSON());
        setCurrentTheme(effectiveTheme);
        setHasUnsavedChanges(true);
        return;
      } catch (err) {
        console.error('[PuckEditorTheme] Error parsing sessionStorage theme:', err);
        PuckSession.clearTheme(pageId);
      }
    }

    // Calculate effective theme (app + page override)
    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    const effectiveTheme = page.themeConfig
      ? ThemeConfig.merge(appTheme, ThemeConfig.create(page.themeConfig))
      : appTheme;

    console.log('[PuckEditorTheme] useEffect - Final effectiveTheme:', effectiveTheme.toJSON());
    setCurrentTheme(effectiveTheme);
    setHasUnsavedChanges(false);
  }, [pageId, page, app]);

  // Update live preview (doesn't save to DB)
  const updateLiveTheme = useCallback((newTheme: ThemeConfigProps) => {
    console.log('[PuckEditorTheme] updateLiveTheme called, isSaving:', isSavingRef.current);

    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    const effectiveTheme = ThemeConfig.merge(appTheme, ThemeConfig.create(newTheme));
    setCurrentTheme(effectiveTheme);
    setHasUnsavedChanges(true);

    // Only save to sessionStorage if we're NOT in a save operation
    if (!isSavingRef.current) {
      console.log('[PuckEditorTheme] Saving to sessionStorage');
      PuckSession.setTheme(pageId, newTheme);
    } else {
      console.log('[PuckEditorTheme] Skipping sessionStorage save (currently saving to DB)');
    }
  }, [app, pageId]);

  // Save theme to database (silent background save - no re-renders)
  const saveTheme = useCallback(async (theme: ThemeConfigProps | undefined) => {
    try {
      console.log('[PuckEditorTheme] saveTheme called with:', theme);

      const result = await updatePageTheme(pageId, theme);

      console.log('[PuckEditorTheme] updatePageTheme result:', result);

      if (!result.success) {
        toast.error(result.error || "Failed to save theme");
        return;
      }

      // Update currentTheme state with the saved theme
      // This ensures the UI reflects the saved state immediately
      const appTheme = app.themeConfig
        ? ThemeConfig.create(app.themeConfig)
        : ThemeConfig.default();

      const effectiveTheme = theme
        ? ThemeConfig.merge(appTheme, ThemeConfig.create(theme))
        : appTheme;

      console.log('[PuckEditorTheme] Setting currentTheme to:', effectiveTheme.toJSON());

      // Set flag to prevent updateLiveTheme from re-setting sessionStorage
      isSavingRef.current = true;
      console.log('[PuckEditorTheme] Set isSaving to true');

      // Clear sessionStorage FIRST (before state updates that might trigger re-renders)
      PuckSession.clearTheme(pageId);
      console.log('[PuckEditorTheme] Cleared sessionStorage for pageId:', pageId);

      setCurrentTheme(effectiveTheme);
      toast.success("Theme saved successfully");
      setHasUnsavedChanges(false);

      // Reset flag after a short delay to allow any triggered re-renders to complete
      setTimeout(() => {
        isSavingRef.current = false;
        console.log('[PuckEditorTheme] Reset isSaving to false');
      }, 100);
    } catch (error) {
      console.error('[PuckEditorTheme] Error saving theme:', error);
      toast.error("Failed to save theme");
      // Reset flag on error as well
      isSavingRef.current = false;
    }
  }, [pageId, app]);

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
