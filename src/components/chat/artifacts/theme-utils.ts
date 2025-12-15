/**
 * Theme-aware styling utilities for artifact viewers
 *
 * Provides conditional styling based on Puck theme context presence.
 * When in Puck context: uses --theme-* CSS variables
 * When in chat context: returns empty style (uses existing Tailwind/globals)
 */

import type { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';
import type { CSSProperties } from 'react';

/**
 * Get viewer container style with theme variables
 * Returns CSS variables when theme is provided, empty object otherwise
 */
export function getViewerContainerStyle(theme: ThemeConfig | null): CSSProperties {
  if (!theme) return {};
  return {
    backgroundColor: 'var(--theme-background)',
    color: 'var(--theme-text)',
    borderColor: 'var(--theme-border)',
    fontFamily: 'var(--theme-font-family)',
    ...theme.toCSSVariables(),
  };
}

/**
 * Get theme-aware background color
 * @param theme - Theme config or null
 * @param variant - 'background' for main bg, 'surface' for content areas
 */
export function getThemedBackground(
  theme: ThemeConfig | null,
  variant: 'background' | 'surface' = 'background'
): CSSProperties {
  if (!theme) return {};
  return {
    backgroundColor: `var(--theme-${variant})`,
  };
}

/**
 * Get theme-aware text color
 * @param theme - Theme config or null
 * @param variant - 'text' for primary text, 'textMuted' for secondary
 */
export function getThemedTextColor(
  theme: ThemeConfig | null,
  variant: 'text' | 'textMuted' = 'text'
): CSSProperties {
  if (!theme) return {};
  const varName = variant === 'textMuted' ? 'text-muted' : 'text';
  return {
    color: `var(--theme-${varName})`,
  };
}

/**
 * Get theme-aware border color
 */
export function getThemedBorderColor(theme: ThemeConfig | null): CSSProperties {
  if (!theme) return {};
  return {
    borderColor: 'var(--theme-border)',
  };
}

/**
 * Get header/footer section style
 * Returns surface background with border color
 */
export function getThemedSectionStyle(theme: ThemeConfig | null): CSSProperties {
  if (!theme) return {};
  return {
    backgroundColor: 'var(--theme-surface)',
    borderColor: 'var(--theme-border)',
  };
}

/**
 * Get themed prose/content style for markdown/text content
 */
export function getThemedContentStyle(theme: ThemeConfig | null): CSSProperties {
  if (!theme) return {};
  return {
    backgroundColor: 'var(--theme-background)',
    color: 'var(--theme-text)',
    fontFamily: 'var(--theme-font-family)',
  };
}
