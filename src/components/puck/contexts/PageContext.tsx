'use client';

/**
 * PageContext - Unified Page-Level Context for Puck
 *
 * Consolidates three separate contexts into one:
 * - LinkContext: org/app/page routing context
 * - QueryParamContext: URL query parameters
 * - ThemeContext: Theme configuration
 *
 * This simplifies the provider hierarchy and makes page-level data
 * accessible through a single hook.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';

/**
 * Query parameter types
 */
export type QueryParams = Record<string, string | number | boolean | string[] | undefined>;

/**
 * Unified page context value
 */
export interface PageContextValue {
  // Routing (from LinkContext)
  /** Organization slug for constructing public URLs */
  orgSlug?: string;
  /** App slug for constructing public URLs */
  appSlug?: string;
  /** App ID for constructing preview URLs */
  appId?: number;
  /** Map or array of pages for link resolution */
  pages?: Map<number, PageDTO> | PageDTO[];
  /** Whether we're in the Puck editor */
  isEditing?: boolean;
  /** Whether we're in preview mode */
  isPreview?: boolean;

  // URL params (from QueryParamContext)
  /** Query parameters from URL */
  params: QueryParams;

  // Theme (from ThemeContext)
  /** Theme configuration */
  theme: ThemeConfig;
}

/**
 * Default context value
 */
const defaultContextValue: PageContextValue = {
  params: {},
  theme: ThemeConfig.default(),
};

const PageContext = createContext<PageContextValue>(defaultContextValue);

export interface PageContextProviderProps {
  children: ReactNode;
  value: Partial<PageContextValue>;
}

/**
 * PageContextProvider - Unified provider for page-level context
 *
 * @example
 * ```tsx
 * <PageContextProvider value={{
 *   orgSlug: 'my-org',
 *   appSlug: 'my-app',
 *   params: { id: '123' },
 *   theme: myTheme,
 *   isEditing: false,
 * }}>
 *   <MyPuckPage />
 * </PageContextProvider>
 * ```
 */
export function PageContextProvider({ children, value }: PageContextProviderProps) {
  const mergedValue: PageContextValue = {
    ...defaultContextValue,
    ...value,
    params: value.params ?? {},
    theme: value.theme ?? ThemeConfig.default(),
  };

  return (
    <PageContext.Provider value={mergedValue}>
      {children}
    </PageContext.Provider>
  );
}

/**
 * usePageContext - Hook to access unified page context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { orgSlug, params, theme, isEditing } = usePageContext();
 *   // ...
 * }
 * ```
 */
export function usePageContext(): PageContextValue {
  return useContext(PageContext);
}

// ============================================
// Convenience hooks for backward compatibility
// ============================================

/**
 * useLinkContext - Backward-compatible hook for routing context
 * @deprecated Use usePageContext() instead
 */
export function useLinkContext(): Pick<
  PageContextValue,
  'orgSlug' | 'appSlug' | 'appId' | 'pages' | 'isEditing' | 'isPreview'
> {
  const ctx = usePageContext();
  return {
    orgSlug: ctx.orgSlug,
    appSlug: ctx.appSlug,
    appId: ctx.appId,
    pages: ctx.pages,
    isEditing: ctx.isEditing,
    isPreview: ctx.isPreview,
  };
}

/**
 * useQueryParams - Backward-compatible hook for query parameters
 * @deprecated Use usePageContext().params instead
 */
export function useQueryParams(): QueryParams {
  return usePageContext().params;
}

/**
 * useQueryParam - Type-safe query param getter with default value
 * @deprecated Use usePageContext().params[key] instead
 */
export function useQueryParam<T = string>(
  key: string,
  defaultValue?: T
): T | undefined {
  const { params } = usePageContext();
  return (params[key] as T) ?? defaultValue;
}

/**
 * useTheme - Backward-compatible hook for theme
 * @deprecated Use usePageContext().theme instead
 */
export function useTheme(): ThemeConfig {
  return usePageContext().theme;
}

/**
 * useOptionalTheme - Returns null if theme is default
 * @deprecated Use usePageContext().theme instead
 */
export function useOptionalTheme(): ThemeConfig | null {
  const { theme } = usePageContext();
  // Return null if using default theme (for conditional theming)
  return theme.equals(ThemeConfig.default()) ? null : theme;
}

// ============================================
// ThemeProvider re-export for backward compatibility
// ============================================

export interface ThemeProviderProps {
  children: ReactNode;
  value: ThemeConfig;
}

/**
 * ThemeProvider - Backward-compatible provider that wraps PageContextProvider
 * @deprecated Use PageContextProvider instead
 *
 * Note: This only provides theme. If you need full page context (routing, params),
 * use PageContextProvider directly.
 */
export function ThemeProvider({ children, value }: ThemeProviderProps) {
  return (
    <PageContextProvider value={{ theme: value }}>
      {children}
    </PageContextProvider>
  );
}
