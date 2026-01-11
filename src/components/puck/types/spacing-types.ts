/**
 * Spacing Types for Figma-style Padding/Margin/Radius Controls
 *
 * Re-exports from shared types for backward compatibility.
 * All types are defined in @/lib/types/spacing-types.ts
 */

// Re-export everything from shared types
export {
  type SpacingLevel,
  type FourSidedSpacing,
  type FourCornerRadius,
  DEFAULT_FOUR_SIDED_SPACING,
  DEFAULT_FOUR_CORNER_RADIUS,
  ZERO_SPACING,
  ZERO_RADIUS,
  createUniformSpacing,
  createUniformRadius,
  isUniformSpacing,
  isUniformRadius,
} from '@/lib/types/spacing-types';
