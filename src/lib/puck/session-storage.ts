/**
 * Puck SessionStorage Utilities
 *
 * Centralized management of sessionStorage for Puck editor.
 * Provides consistent key naming and type-safe access.
 */

import type { Data } from "@measured/puck";
import type { ThemeConfigProps } from "@/ddd/domain/puck/value-objects/theme-config";

/**
 * Consistent sessionStorage keys
 */
const KEYS = {
  puckData: (pageId: number) => `puck:data:${pageId}`,
  pageTheme: (pageId: number) => `puck:theme:${pageId}`,
  sidebarLeft: (pageId: number) => `puck:sidebar:left:${pageId}`,
  sidebarRight: (pageId: number) => `puck:sidebar:right:${pageId}`,
} as const;

/**
 * Puck sessionStorage utilities
 */
export const PuckSession = {
  // ========================================
  // Puck Data (page content)
  // ========================================

  /**
   * Save Puck page data to sessionStorage
   * Used for: Preview mode, unsaved changes
   */
  setData(pageId: number, data: Data): void {
    try {
      sessionStorage.setItem(KEYS.puckData(pageId), JSON.stringify(data));
    } catch (error) {
      console.error('[PuckSession] Error saving data:', error);
    }
  },

  /**
   * Get Puck page data from sessionStorage
   * Returns null if not found or invalid
   */
  getData(pageId: number): Data | null {
    try {
      const raw = sessionStorage.getItem(KEYS.puckData(pageId));
      if (!raw) return null;

      const data = JSON.parse(raw);
      // Basic validation
      if (!data || typeof data !== 'object' || !('content' in data)) {
        return null;
      }

      return data as Data;
    } catch (error) {
      console.error('[PuckSession] Error loading data:', error);
      return null;
    }
  },

  /**
   * Clear Puck page data from sessionStorage
   */
  clearData(pageId: number): void {
    try {
      sessionStorage.removeItem(KEYS.puckData(pageId));
    } catch (error) {
      console.error('[PuckSession] Error clearing data:', error);
    }
  },

  // ========================================
  // Theme Data
  // ========================================

  /**
   * Save theme to sessionStorage
   * Used for: Live preview, unsaved theme changes
   */
  setTheme(pageId: number, theme: ThemeConfigProps): void {
    try {
      sessionStorage.setItem(KEYS.pageTheme(pageId), JSON.stringify(theme));
    } catch (error) {
      console.error('[PuckSession] Error saving theme:', error);
    }
  },

  /**
   * Get theme from sessionStorage
   * Returns null if not found or invalid
   */
  getTheme(pageId: number): ThemeConfigProps | null {
    try {
      const raw = sessionStorage.getItem(KEYS.pageTheme(pageId));
      if (!raw) return null;

      const theme = JSON.parse(raw);
      // Basic validation
      if (!theme || typeof theme !== 'object') {
        return null;
      }

      return theme as ThemeConfigProps;
    } catch (error) {
      console.error('[PuckSession] Error loading theme:', error);
      return null;
    }
  },

  /**
   * Clear theme from sessionStorage
   */
  clearTheme(pageId: number): void {
    try {
      sessionStorage.removeItem(KEYS.pageTheme(pageId));
    } catch (error) {
      console.error('[PuckSession] Error clearing theme:', error);
    }
  },

  // ========================================
  // Sidebar State
  // ========================================

  /**
   * Save sidebar visibility state
   * Used for: Persisting sidebar state across reloads
   */
  setSidebarState(pageId: number, side: 'left' | 'right', visible: boolean): void {
    try {
      const key = side === 'left' ? KEYS.sidebarLeft(pageId) : KEYS.sidebarRight(pageId);
      sessionStorage.setItem(key, String(visible));
    } catch (error) {
      console.error('[PuckSession] Error saving sidebar state:', error);
    }
  },

  /**
   * Get sidebar visibility state
   * Returns null if not set
   */
  getSidebarState(pageId: number, side: 'left' | 'right'): boolean | null {
    try {
      const key = side === 'left' ? KEYS.sidebarLeft(pageId) : KEYS.sidebarRight(pageId);
      const raw = sessionStorage.getItem(key);

      if (raw === null) return null;
      return raw === 'true';
    } catch (error) {
      console.error('[PuckSession] Error loading sidebar state:', error);
      return null;
    }
  },

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Clear ALL session data for a page
   * Use when: User closes editor, navigation away, etc.
   */
  clearAll(pageId: number): void {
    this.clearData(pageId);
    this.clearTheme(pageId);
    try {
      sessionStorage.removeItem(KEYS.sidebarLeft(pageId));
      sessionStorage.removeItem(KEYS.sidebarRight(pageId));
    } catch (error) {
      console.error('[PuckSession] Error clearing all:', error);
    }
  },

  /**
   * Check if page has any unsaved data
   */
  hasUnsavedChanges(pageId: number): boolean {
    return this.getData(pageId) !== null || this.getTheme(pageId) !== null;
  },
};
