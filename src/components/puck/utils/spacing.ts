/**
 * Spacing Utility Functions
 *
 * Provides unified spacing calculations based on theme configuration.
 * All blocks should use these utilities instead of hardcoded spacing values.
 */

import type { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';
import type { SpacingLevel } from '@/lib/types/spacing-types';

// Re-export SpacingLevel for backward compatibility
export type { SpacingLevel } from '@/lib/types/spacing-types';

/**
 * Calculate spacing based on theme configuration
 *
 * Uses exponential scale: spacing = unit × scale^level
 *
 * @param level - Spacing level (0-10)
 * @param theme - Theme configuration
 * @returns CSS spacing value (e.g., "0.25rem", "1.5rem")
 *
 * @example
 * // With default theme (unit: 0.25rem, scale: 1.5):
 * getSpacing(0, theme); // "0.25rem"  (4px)
 * getSpacing(1, theme); // "0.375rem" (6px)
 * getSpacing(2, theme); // "0.5625rem" (9px)
 * getSpacing(4, theme); // "1.265rem" (20px)
 * getSpacing(6, theme); // "2.847rem" (45px)
 */
export function getSpacing(
  level: SpacingLevel,
  theme: ThemeConfig
): string {
  // Parse spacing unit (default: 0.25rem = 4px)
  const unitStr = theme.spacing?.unit || '0.25rem';
  const unit = parseFloat(unitStr);

  // Get scale factor (default: 1.5)
  const scale = theme.spacing?.scale || 1.5;

  // Calculate spacing with exponential scale
  const calculatedSpacing = unit * Math.pow(scale, level);

  // Return in same unit as base
  if (unitStr.endsWith('rem')) {
    return `${calculatedSpacing}rem`;
  } else if (unitStr.endsWith('em')) {
    return `${calculatedSpacing}em`;
  } else {
    return `${calculatedSpacing}px`;
  }
}

/**
 * Get spacing options for select fields
 *
 * @param theme - Theme configuration
 * @returns Array of select options with calculated values
 *
 * @example
 * const options = getSpacingOptions(theme);
 * // [
 * //   { value: "0.25rem", label: "None (0) - 0.25rem" },
 * //   { value: "0.375rem", label: "XS (1) - 0.375rem" },
 * //   ...
 * // ]
 */
export function getSpacingOptions(theme: ThemeConfig) {
  const labels = [
    "None", "XS", "SM", "MD", "Base", "LG", "XL", "2XL", "3XL", "4XL", "5XL"
  ];

  return ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as SpacingLevel[]).map((level, index) => {
    const value = getSpacing(level, theme);
    return {
      value,
      label: `${labels[index]} (${level}) - ${value}`,
    };
  });
}

/**
 * Parse spacing level from string value
 * Useful when spacing is stored as computed value
 *
 * @param value - Spacing value string
 * @param theme - Theme configuration
 * @returns Closest spacing level
 *
 * @example
 * const level = parseSpacingLevel("1.5rem", theme); // 6
 */
export function parseSpacingLevel(
  value: string,
  theme: ThemeConfig
): SpacingLevel {
  const numericValue = parseFloat(value);

  // Find closest matching level
  let closestLevel: SpacingLevel = 4;
  let closestDiff = Infinity;

  for (let level = 0; level <= 10; level++) {
    const levelValue = parseFloat(getSpacing(level as SpacingLevel, theme));
    const diff = Math.abs(levelValue - numericValue);

    if (diff < closestDiff) {
      closestDiff = diff;
      closestLevel = level as SpacingLevel;
    }
  }

  return closestLevel;
}

/**
 * Common spacing presets for quick access
 * Maps semantic names to spacing levels
 */
export const SPACING_PRESETS = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 3,
  base: 4,
  lg: 5,
  xl: 6,
  '2xl': 7,
  '3xl': 8,
  '4xl': 9,
  '5xl': 10,
} as const;

/**
 * Get spacing from preset name
 *
 * @param preset - Preset name
 * @param theme - Theme configuration
 * @returns CSS spacing value
 *
 * @example
 * const spacing = getSpacingFromPreset('lg', theme); // "2.027rem"
 */
export function getSpacingFromPreset(
  preset: keyof typeof SPACING_PRESETS,
  theme: ThemeConfig
): string {
  const level = SPACING_PRESETS[preset];
  return getSpacing(level, theme);
}

/**
 * Backwards compatibility for hardcoded pixel values
 * Maps common px values to closest spacing level
 */
export const PX_TO_LEVEL_MAP: Record<number, SpacingLevel> = {
  0: 0,
  4: 0,
  6: 1,
  8: 1,
  9: 2,
  12: 2,
  16: 3,
  20: 4,
  24: 4,
  32: 5,
  40: 5,
  48: 6,
  56: 6,
  64: 7,
  72: 7,
  80: 8,
  96: 8,
  120: 9,
  160: 10,
};

/**
 * Migrate hardcoded px value to spacing level
 *
 * @param pxValue - Pixel value
 * @returns Closest spacing level
 *
 * @example
 * const level = migratePixelsToLevel(24); // 4
 * const level2 = migratePixelsToLevel(72); // 7
 */
export function migratePixelsToLevel(pxValue: number): SpacingLevel {
  return PX_TO_LEVEL_MAP[pxValue] || 4; // Default to 'base' if not found
}

// ============================================================================
// Four-Sided Spacing & Radius CSS Computation
// ============================================================================

import type { FourSidedSpacing, FourCornerRadius } from '../types/spacing-types';

/**
 * Compute CSS styles for four-sided spacing (padding or margin)
 *
 * @param spacing - Four-sided spacing configuration
 * @param theme - Theme configuration
 * @param property - CSS property ('padding' or 'margin')
 * @returns React CSSProperties object
 *
 * @example
 * const styles = computeFourSidedCSS(padding, theme, 'padding');
 * // { paddingTop: '1rem', paddingRight: '1rem', paddingBottom: '1rem', paddingLeft: '1rem' }
 */
export function computeFourSidedCSS(
  spacing: FourSidedSpacing,
  theme: ThemeConfig,
  property: 'padding' | 'margin' = 'padding'
): React.CSSProperties {
  return {
    [`${property}Top`]: getSpacing(spacing.top, theme),
    [`${property}Right`]: getSpacing(spacing.right, theme),
    [`${property}Bottom`]: getSpacing(spacing.bottom, theme),
    [`${property}Left`]: getSpacing(spacing.left, theme),
  } as React.CSSProperties;
}

/**
 * Compute CSS styles for four-corner border radius
 *
 * @param radius - Four-corner radius configuration
 * @param theme - Theme configuration
 * @returns React CSSProperties object
 *
 * @example
 * const styles = computeFourCornerRadiusCSS(radius, theme);
 * // { borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem', ... }
 */
export function computeFourCornerRadiusCSS(
  radius: FourCornerRadius,
  theme: ThemeConfig
): React.CSSProperties {
  return {
    borderTopLeftRadius: getSpacing(radius.topLeft, theme),
    borderTopRightRadius: getSpacing(radius.topRight, theme),
    borderBottomRightRadius: getSpacing(radius.bottomRight, theme),
    borderBottomLeftRadius: getSpacing(radius.bottomLeft, theme),
  };
}

/**
 * Compute shorthand CSS string for four-sided spacing
 * Returns value in format: "top right bottom left"
 *
 * @param spacing - Four-sided spacing configuration
 * @param theme - Theme configuration
 * @returns CSS shorthand string
 *
 * @example
 * const value = computeFourSidedShorthand(padding, theme);
 * // "1rem 0.5rem 1rem 0.5rem"
 */
export function computeFourSidedShorthand(
  spacing: FourSidedSpacing,
  theme: ThemeConfig
): string {
  const top = getSpacing(spacing.top, theme);
  const right = getSpacing(spacing.right, theme);
  const bottom = getSpacing(spacing.bottom, theme);
  const left = getSpacing(spacing.left, theme);

  // Optimize shorthand format
  if (top === right && right === bottom && bottom === left) {
    return top; // All same: "1rem"
  }
  if (top === bottom && right === left) {
    return `${top} ${right}`; // Vertical/horizontal: "1rem 0.5rem"
  }
  if (right === left) {
    return `${top} ${right} ${bottom}`; // Top/horizontal/bottom: "1rem 0.5rem 2rem"
  }
  return `${top} ${right} ${bottom} ${left}`; // All different
}

/**
 * Compute shorthand CSS string for four-corner radius
 * Returns value in format: "topLeft topRight bottomRight bottomLeft"
 *
 * @param radius - Four-corner radius configuration
 * @param theme - Theme configuration
 * @returns CSS shorthand string
 *
 * @example
 * const value = computeFourCornerRadiusShorthand(radius, theme);
 * // "0.5rem 0.5rem 0.5rem 0.5rem"
 */
export function computeFourCornerRadiusShorthand(
  radius: FourCornerRadius,
  theme: ThemeConfig
): string {
  const tl = getSpacing(radius.topLeft, theme);
  const tr = getSpacing(radius.topRight, theme);
  const br = getSpacing(radius.bottomRight, theme);
  const bl = getSpacing(radius.bottomLeft, theme);

  // Optimize shorthand format
  if (tl === tr && tr === br && br === bl) {
    return tl; // All same
  }
  if (tl === br && tr === bl) {
    return `${tl} ${tr}`; // Diagonal pairs
  }
  if (tr === bl) {
    return `${tl} ${tr} ${br}`; // Top-left/sides/bottom-right
  }
  return `${tl} ${tr} ${br} ${bl}`; // All different
}

/**
 * Spacing level labels for UI display
 */
export const SPACING_LEVEL_LABELS: Record<SpacingLevel, string> = {
  0: 'None',
  1: 'XS',
  2: 'SM',
  3: 'MD',
  4: 'Base',
  5: 'LG',
  6: 'XL',
  7: '2XL',
  8: '3XL',
  9: '4XL',
  10: '5XL',
};
