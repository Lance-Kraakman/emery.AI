/**
 * Typography Utility Functions
 *
 * Provides unified typography size calculations based on theme configuration.
 * All blocks should use these utilities instead of hardcoded sizes.
 */

import type { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';

/**
 * Semantic typography size scale
 * Replaces inconsistent sizing systems (XXXL-XS, M/S, small/medium/large)
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
 * Calculate typography size based on theme configuration
 *
 * @param size - Semantic size value
 * @param theme - Theme configuration
 * @returns CSS size value (e.g., "16px", "1.5rem")
 *
 * @example
 * const size = getTypographySize('xl', theme); // "20px"
 * const headingSize = getTypographySize('3xl', theme); // "30px"
 */
export function getTypographySize(
  size: TypographySize,
  theme: ThemeConfig
): string {
  // Parse base font size from theme (default: 16px)
  const baseSizeStr = theme.typography?.fontSize || '16px';
  const baseSize = parseFloat(baseSizeStr);

  // Size multipliers based on semantic scale
  const sizeMap: Record<TypographySize, number> = {
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

  const calculatedSize = baseSize * sizeMap[size];

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
 *
 * @example
 * const headingWeight = getFontWeight('heading', theme); // 700
 * const bodyWeight = getFontWeight('body', theme); // 400
 */
export function getFontWeight(
  type: 'heading' | 'body',
  theme: ThemeConfig
): number {
  if (type === 'heading') {
    return theme.typography?.headingFontWeight || 700;
  }
  return 400; // Default body weight
}

/**
 * Get font family from theme configuration
 *
 * @param theme - Theme configuration
 * @returns CSS font-family value
 *
 * @example
 * const fontFamily = getFontFamily(theme); // "Inter, sans-serif"
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
 *
 * @example
 * const color = getHeadingColor(theme); // "#000000" or theme default
 */
export function getHeadingColor(
  theme: ThemeConfig,
  fallback?: string
): string | undefined {
  return theme.typography?.headingColor || fallback;
}

/**
 * Backwards compatibility mapping for old size values
 * Allows gradual migration from old to new size system
 */
export const SIZE_MIGRATION_MAP: Record<string, TypographySize> = {
  // Old Heading block sizes (XXXL-XS)
  'XXXL': '5xl',
  'XXL': '4xl',
  'XL': '3xl',
  'L': '2xl',
  'M': 'xl',
  'S': 'base',
  'XS': 'sm',

  // Old Text block sizes
  'm': 'base',
  's': 'sm',

  // Old MetricBlock sizes
  'large': 'xl',
  'medium': 'base',
  'small': 'sm',
};

/**
 * Migrate old size value to new semantic size
 *
 * @param oldSize - Old size value
 * @returns New semantic size value
 *
 * @example
 * const newSize = migrateSize('XXXL'); // "5xl"
 * const newSize2 = migrateSize('m'); // "base"
 */
export function migrateSize(oldSize: string): TypographySize {
  return SIZE_MIGRATION_MAP[oldSize] as TypographySize || 'base';
}
