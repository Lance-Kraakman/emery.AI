import { useState, useEffect, useCallback } from "react";
import { ThemeConfig, type ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";
import { updatePageTheme } from "@/app/actions/puck-pages";
import { toast } from "sonner";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";
import type { AppDTO } from "@/app/mappers/puck-app-mapper";

/**
 * usePageTheme - Simplified Theme Management Hook
 *
 * Handles:
 * - Loading theme from page/app
 * - Live preview during editing
 * - SessionStorage persistence
 * - Save/remove operations
 */
export function usePageTheme(pageId: number | null, page: PageDTO | null, app: AppDTO | null) {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  console.log('[usePageTheme] Hook called. pageId:', pageId, 'page:', !!page, 'app:', !!app);

  // Initialize theme from page/app data
  useEffect(() => {
    console.log('[usePageTheme] useEffect triggered. page:', !!page, 'app:', !!app);
    if (!page || !app) {
      console.log('[usePageTheme] Skipping initialization - missing page or app');
      return;
    }

    console.log('[usePageTheme] Initializing theme');
    console.log('[usePageTheme] Page theme:', page.themeConfig);
    console.log('[usePageTheme] App theme:', app.themeConfig);

    // Check sessionStorage first for unsaved changes
    const sessionKey = `page-theme-${pageId}`;
    const savedTheme = sessionStorage.getItem(sessionKey);

    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        console.log('[usePageTheme] Loaded unsaved theme from sessionStorage');

        const appTheme = app.themeConfig
          ? ThemeConfig.create(app.themeConfig)
          : ThemeConfig.default();

        const effectiveTheme = ThemeConfig.merge(appTheme, ThemeConfig.create(parsedTheme));
        setCurrentTheme(effectiveTheme);
        setHasUnsavedChanges(true);
        return;
      } catch (err) {
        console.error('[usePageTheme] Error parsing sessionStorage theme:', err);
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

    console.log('[usePageTheme] Setting effective theme:', effectiveTheme);
    setCurrentTheme(effectiveTheme);
    setHasUnsavedChanges(false);
  }, [page, app, pageId]);

  // Handle live theme changes during editing
  const handleThemeChange = useCallback((newTheme: ThemeConfigProps) => {
    if (!app) return;

    console.log('[usePageTheme] Theme changed (live preview):', newTheme);

    // Calculate new effective theme for live preview
    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    const effectiveTheme = ThemeConfig.merge(appTheme, ThemeConfig.create(newTheme));
    setCurrentTheme(effectiveTheme);
    setHasUnsavedChanges(true);

    // Save to sessionStorage for persistence
    if (pageId) {
      const sessionKey = `page-theme-${pageId}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(newTheme));
    }
  }, [app, pageId]);

  // Save theme to database
  const handleSave = useCallback(async (theme: ThemeConfigProps | undefined) => {
    if (!pageId || !app) return;

    console.log('[usePageTheme] Saving theme to database:', theme);
    setIsSaving(true);

    try {
      const result = await updatePageTheme(pageId, theme);

      if (!result.success) {
        toast.error(result.error || "Failed to save theme");
        setIsSaving(false);
        return;
      }

      toast.success("Theme saved successfully");
      setHasUnsavedChanges(false);

      // Clear sessionStorage since changes are now saved
      const sessionKey = `page-theme-${pageId}`;
      sessionStorage.removeItem(sessionKey);

      console.log('[usePageTheme] Theme saved successfully, returning updated page');

      // Return updated page so parent can update state and trigger re-initialization
      return result.data;
    } catch (error) {
      console.error('[usePageTheme] Error saving theme:', error);
      toast.error("Failed to save theme");
    } finally {
      setIsSaving(false);
    }
  }, [pageId, app]);

  // Remove page theme override (revert to app theme)
  const handleRemove = useCallback(async () => {
    if (!app) return;

    console.log('[usePageTheme] Removing page theme override');

    // Revert to app theme immediately (live preview)
    const appTheme = app.themeConfig
      ? ThemeConfig.create(app.themeConfig)
      : ThemeConfig.default();

    setCurrentTheme(appTheme);

    // Save undefined to database to clear override
    await handleSave(undefined);
  }, [app, handleSave]);

  return {
    currentTheme,
    formTheme: currentTheme?.toJSON(),
    handleThemeChange,
    handleSave,
    handleRemove,
    isSaving,
    hasUnsavedChanges,
  };
}
