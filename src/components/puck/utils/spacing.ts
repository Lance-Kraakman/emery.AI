/**
 * Spacing Utility Functions
 *
 * Provides unified spacing calculations based on theme configuration.
 * All blocks should use these utilities instead of hardcoded spacing values.
 */

import type { ThemeConfig } from '@/ddd/domain/puck/value-objects/theme-config';

/**
 * Spacing level (0-10)
 * Higher numbers = larger spacing
 */
export type SpacingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

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
