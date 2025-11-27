/**
 * ThemeContext - React Context for Puck Theme System
 *
 * AIDEV-NOTE: Provides theme configuration to Puck components via React Context.
 * This avoids the need to mutate Puck's config and works with Puck's architecture.
 *
 * Usage:
 * - Wrap Puck components with ThemeProvider
 * - Root component uses useTheme() to access theme
 * - Theme cascades from app level with optional page overrides
 */

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ThemeConfig } from "@/ddd/domain/puck/value-objects/theme-config";

// Create context with null default (will use default theme if not provided)
const ThemeContext = createContext<ThemeConfig | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  value: ThemeConfig;
}

/**
 * ThemeProvider - Provides theme to all child components
 */
export function ThemeProvider({ children, value }: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme - Hook to access theme in components
 * Returns the provided theme or default theme if not in a ThemeProvider
 */
export function useTheme(): ThemeConfig {
  const theme = useContext(ThemeContext);
  return theme || ThemeConfig.default();
}
