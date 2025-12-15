/**
 * Spacing Types for Figma-style Padding/Margin/Radius Controls
 *
 * Provides per-side spacing and per-corner radius configuration
 * with link/unlink functionality.
 */

import type { SpacingLevel } from '../utils/spacing';

/**
 * Four-sided spacing configuration (padding/margin)
 * Each side can be configured independently or linked together
 */
export interface FourSidedSpacing {
  top: SpacingLevel;
  right: SpacingLevel;
  bottom: SpacingLevel;
  left: SpacingLevel;
  linked: boolean; // When true, all sides sync to the same value
}

/**
 * Four-corner radius configuration
 * Each corner can be configured independently or linked together
 */
export interface FourCornerRadius {
  topLeft: SpacingLevel;
  topRight: SpacingLevel;
  bottomRight: SpacingLevel;
  bottomLeft: SpacingLevel;
  linked: boolean; // When true, all corners sync to the same value
}

/**
 * Default four-sided spacing (base level, all linked)
 */
export const DEFAULT_FOUR_SIDED_SPACING: FourSidedSpacing = {
  top: 4,
  right: 4,
  bottom: 4,
  left: 4,
  linked: true,
};

/**
 * Default four-corner radius (small level, all linked)
 */
export const DEFAULT_FOUR_CORNER_RADIUS: FourCornerRadius = {
  topLeft: 2,
  topRight: 2,
  bottomRight: 2,
  bottomLeft: 2,
  linked: true,
};

/**
 * Zero spacing (no padding/margin)
 */
export const ZERO_SPACING: FourSidedSpacing = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  linked: true,
};

/**
 * Zero radius (sharp corners)
 */
export const ZERO_RADIUS: FourCornerRadius = {
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
  linked: true,
};

/**
 * Create a FourSidedSpacing with all sides set to the same level
 */
export function createUniformSpacing(level: SpacingLevel): FourSidedSpacing {
  return {
    top: level,
    right: level,
    bottom: level,
    left: level,
    linked: true,
  };
}

/**
 * Create a FourCornerRadius with all corners set to the same level
 */
export function createUniformRadius(level: SpacingLevel): FourCornerRadius {
  return {
    topLeft: level,
    topRight: level,
    bottomRight: level,
    bottomLeft: level,
    linked: true,
  };
}

/**
 * Check if all sides of a FourSidedSpacing are equal
 */
export function isUniformSpacing(spacing: FourSidedSpacing): boolean {
  return (
    spacing.top === spacing.right &&
    spacing.right === spacing.bottom &&
    spacing.bottom === spacing.left
  );
}

/**
 * Check if all corners of a FourCornerRadius are equal
 */
export function isUniformRadius(radius: FourCornerRadius): boolean {
  return (
    radius.topLeft === radius.topRight &&
    radius.topRight === radius.bottomRight &&
    radius.bottomRight === radius.bottomLeft
  );
}
