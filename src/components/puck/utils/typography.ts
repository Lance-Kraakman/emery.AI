/**
 * Typography Utility Functions
 *
 * Provides unified typography size calculations based on theme configuration.
 * All blocks should use theme CSS variables as primary approach.
 * These utilities are for SSR, email templates, and fallback calculations.
 */

import type { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';

/**
 * Semantic typography size scale
 * Unified across all components
 */
export type TypographySize =
  | "xs"
  | "sm"
  | "base"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl";

/**
 * Typography scale multipliers
 * Used for calculating sizes based on theme base font size
 */
export const TYPOGRAPHY_SCALE: Record<TypographySize, number> = {
  xs: 0.75,      // 12px at 16px base
  sm: 0.875,     // 14px at 16px base
  base: 1,       // 16px at 16px base
  lg: 1.125,     // 18px at 16px base
  xl: 1.25,      // 20px at 16px base
  '2xl': 1.5,    // 24px at 16px base
  '3xl': 1.875,  // 30px at 16px base
  '4xl': 2.25,   // 36px at 16px base
  '5xl': 3,      // 48px at 16px base
};

/**
 * Get CSS variable reference for typography size
 * PRIMARY METHOD for components to use
 *
 * @param size - Semantic size value
 * @returns CSS variable string
 *
 * @example
 * const varRef = getTypographyVar('xl'); // "var(--theme-font-xl)"
 * <div style={{ fontSize: getTypographyVar('2xl') }}>Text</div>
 */
export function getTypographyVar(size: TypographySize): string {
  return `var(--theme-font-${size})`;
}

/**
 * Calculate typography size based on theme configuration
 * For SSR, email templates, or when CSS variables not available
 * DON'T use in component inline styles if avoidable - use CSS variables instead
 *
 * @param size - Semantic size value
 * @param theme - Theme configuration
 * @returns CSS size value (e.g., "16px", "1.5rem")
 *
 * @example
 * // SSR/email template usage:
 * const size = getTypographySize('xl', theme); // "20px"
 * const emailHTML = `<h1 style="font-size: ${size}">Title</h1>`;
 */
export function getTypographySize(
  size: TypographySize,
  theme: ThemeConfig
): string {
  const baseSizeStr = theme.typography?.fontSize || '16px';
  const baseSize = parseFloat(baseSizeStr);
  const calculatedSize = baseSize * TYPOGRAPHY_SCALE[size];

  // Return in same unit as base size
  if (baseSizeStr.endsWith('rem')) {
    return `${calculatedSize / 16}rem`;
  } else if (baseSizeStr.endsWith('em')) {
    return `${calculatedSize / 16}em`;
  } else {
    return `${calculatedSize}px`;
  }
}

/**
 * Get font weight from theme configuration
 *
 * @param type - 'heading' or 'body'
 * @param theme - Theme configuration
 * @returns Font weight number
 */
export function getFontWeight(
  type: 'heading' | 'body',
  theme: ThemeConfig
): number {
  if (type === 'heading') {
    return theme.typography?.headingFontWeight || 700;
  }
  return 400;
}

/**
 * Get font family from theme configuration
 *
 * @param theme - Theme configuration
 * @returns CSS font-family value
 */
export function getFontFamily(theme: ThemeConfig): string {
  return theme.typography?.fontFamily || 'system-ui, -apple-system, sans-serif';
}

/**
 * Get heading color from theme configuration
 *
 * @param theme - Theme configuration
 * @param fallback - Fallback color if not defined in theme
 * @returns CSS color value
 */
export function getHeadingColor(
  theme: ThemeConfig,
  fallback?: string
): string | undefined {
  return theme.typography?.headingColor || fallback;
}
