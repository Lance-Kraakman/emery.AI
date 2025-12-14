/**
 * Theme configuration for Puck applications
 * Supports hierarchical theming: App → Page → Component
 */

import type {
  FourSidedSpacing,
  FourCornerRadius,
} from '@/components/puck/types/spacing-types';
import {
  DEFAULT_FOUR_SIDED_SPACING,
  DEFAULT_FOUR_CORNER_RADIUS,
} from '@/components/puck/types/spacing-types';

// Re-export for convenience
export type { FourSidedSpacing, FourCornerRadius };

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  link: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: string;
  headingFontWeight: number;
  headingColor?: string;
}

export interface ThemeSpacing {
  unit: string;
  scale: number;
  /** Default padding for blocks (per-side) */
  defaultPadding: FourSidedSpacing;
  /** Default margin for blocks (per-side) */
  defaultMargin: FourSidedSpacing;
}

export interface ThemeBorders {
  /** Default border radius for blocks (per-corner) */
  radius: FourCornerRadius;
  width: string;
}

export interface ThemeConfigProps {
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borders: ThemeBorders;
}

/**
 * Default theme matching current hard-coded styles
 */
export const DEFAULT_THEME: ThemeConfigProps = {
  colors: {
    primary: '#2563eb',
    secondary: '#64748b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textMuted: '#64748b',
    border: '#e2e8f0',
    link: '#2563eb',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '16px',
    headingFontWeight: 600,
  },
  spacing: {
    unit: '0.25rem',
    scale: 1.5,
    defaultPadding: DEFAULT_FOUR_SIDED_SPACING,
    defaultMargin: { top: 0, right: 0, bottom: 0, left: 0, linked: true },
  },
  borders: {
    radius: DEFAULT_FOUR_CORNER_RADIUS,
    width: '1px',
  },
};

/**
 * ThemeConfig Value Object
 * Encapsulates theme configuration with validation
 */
export class ThemeConfig {
  private constructor(private readonly _config: ThemeConfigProps) {
    this.validate();
  }

  /**
   * Create theme config from partial props
   * Merges with default theme
   */
  static create(props: Partial<ThemeConfigProps>): ThemeConfig {
    const config: ThemeConfigProps = {
      colors: { ...DEFAULT_THEME.colors, ...props.colors },
      typography: { ...DEFAULT_THEME.typography, ...props.typography },
      spacing: { ...DEFAULT_THEME.spacing, ...props.spacing },
      borders: { ...DEFAULT_THEME.borders, ...props.borders },
    };
    return new ThemeConfig(config);
  }

  /**
   * Create default theme
   */
  static default(): ThemeConfig {
    return new ThemeConfig(DEFAULT_THEME);
  }

  /**
   * Create from JSON (database JSONB)
   */
  static fromJSON(json: any): ThemeConfig {
    if (!json) {
      return ThemeConfig.default();
    }
    return ThemeConfig.create(json);
  }

  /**
   * Merge two themes (override takes precedence)
   */
  static merge(base: ThemeConfig, override: ThemeConfig): ThemeConfig {
    const merged: ThemeConfigProps = {
      colors: { ...base._config.colors, ...override._config.colors },
      typography: { ...base._config.typography, ...override._config.typography },
      spacing: { ...base._config.spacing, ...override._config.spacing },
      borders: { ...base._config.borders, ...override._config.borders },
    };
    return new ThemeConfig(merged);
  }

  /**
   * Validate theme configuration
   */
  private validate(): void {
    // Validate colors are valid hex or rgb
    Object.entries(this._config.colors).forEach(([key, value]) => {
      if (!this.isValidColor(value)) {
        throw new Error(`Invalid color value for ${key}: ${value}`);
      }
    });

    // Validate typography
    if (!this._config.typography.fontFamily) {
      throw new Error('Font family is required');
    }
    if (this._config.typography.headingFontWeight < 100 || this._config.typography.headingFontWeight > 900) {
      throw new Error('Heading font weight must be between 100 and 900');
    }

    // Validate spacing
    if (!this._config.spacing.unit) {
      throw new Error('Spacing unit is required');
    }
    if (this._config.spacing.scale <= 0) {
      throw new Error('Spacing scale must be positive');
    }

    // Validate defaultPadding
    if (this._config.spacing.defaultPadding) {
      this.validateFourSidedSpacing(this._config.spacing.defaultPadding, 'defaultPadding');
    }

    // Validate defaultMargin
    if (this._config.spacing.defaultMargin) {
      this.validateFourSidedSpacing(this._config.spacing.defaultMargin, 'defaultMargin');
    }

    // Validate borders radius
    if (this._config.borders.radius) {
      this.validateFourCornerRadius(this._config.borders.radius, 'radius');
    }
  }

  /**
   * Validate FourSidedSpacing
   */
  private validateFourSidedSpacing(spacing: FourSidedSpacing, name: string): void {
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    for (const side of sides) {
      const value = spacing[side];
      if (typeof value !== 'number' || value < 0 || value > 10) {
        throw new Error(`Invalid ${name}.${side}: must be a number between 0 and 10`);
      }
    }
  }

  /**
   * Validate FourCornerRadius
   */
  private validateFourCornerRadius(radius: FourCornerRadius, name: string): void {
    const corners = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
    for (const corner of corners) {
      const value = radius[corner];
      if (typeof value !== 'number' || value < 0 || value > 10) {
        throw new Error(`Invalid ${name}.${corner}: must be a number between 0 and 10`);
      }
    }
  }

  /**
   * Check if color is valid hex or rgb
   */
  private isValidColor(color: string): boolean {
    // Hex color (#fff or #ffffff)
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexPattern.test(color)) return true;

    // RGB color (rgb(255, 255, 255) or rgba(255, 255, 255, 0.5))
    const rgbPattern = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
    if (rgbPattern.test(color)) return true;

    return false;
  }

  /**
   * Convert to CSS variables
   * Returns object that can be spread into inline styles
   */
  toCSSVariables(): Record<string, string> {
    // Parse base font size for typography scale calculations
    const baseFontSize = parseFloat(this._config.typography.fontSize);

    // Helper to calculate spacing from level
    const getSpacingValue = (level: number): string => {
      const unit = parseFloat(this._config.spacing.unit);
      const scale = this._config.spacing.scale;
      const value = unit * Math.pow(scale, level);
      return `${value}rem`;
    };

    const { defaultPadding, defaultMargin } = this._config.spacing;
    const { radius } = this._config.borders;

    return {
      // Colors
      '--theme-primary': this._config.colors.primary,
      '--theme-secondary': this._config.colors.secondary,
      '--theme-background': this._config.colors.background,
      '--theme-surface': this._config.colors.surface,
      '--theme-text': this._config.colors.text,
      '--theme-text-muted': this._config.colors.textMuted,
      '--theme-border': this._config.colors.border,
      '--theme-link': this._config.colors.link,
      '--theme-success': this._config.colors.success,
      '--theme-warning': this._config.colors.warning,
      '--theme-error': this._config.colors.error,

      // Base Typography
      '--theme-font-family': this._config.typography.fontFamily,
      '--theme-font-size': this._config.typography.fontSize,
      '--theme-heading-font-weight': this._config.typography.headingFontWeight.toString(),
      '--theme-heading-color': this._config.typography.headingColor || this._config.colors.text,

      // Typography Scale (calculated from base font size)
      '--theme-font-xs': `${baseFontSize * 0.75}px`,      // 12px at 16px base
      '--theme-font-sm': `${baseFontSize * 0.875}px`,     // 14px at 16px base
      '--theme-font-base': this._config.typography.fontSize, // 16px base
      '--theme-font-lg': `${baseFontSize * 1.125}px`,     // 18px at 16px base
      '--theme-font-xl': `${baseFontSize * 1.25}px`,      // 20px at 16px base
      '--theme-font-2xl': `${baseFontSize * 1.5}px`,      // 24px at 16px base
      '--theme-font-3xl': `${baseFontSize * 1.875}px`,    // 30px at 16px base
      '--theme-font-4xl': `${baseFontSize * 2.25}px`,     // 36px at 16px base
      '--theme-font-5xl': `${baseFontSize * 3}px`,        // 48px at 16px base

      // Base Spacing
      '--theme-spacing-unit': this._config.spacing.unit,
      '--theme-spacing-scale': this._config.spacing.scale.toString(),

      // Default Padding (per-side)
      '--theme-padding-top': getSpacingValue(defaultPadding.top),
      '--theme-padding-right': getSpacingValue(defaultPadding.right),
      '--theme-padding-bottom': getSpacingValue(defaultPadding.bottom),
      '--theme-padding-left': getSpacingValue(defaultPadding.left),

      // Default Margin (per-side)
      '--theme-margin-top': getSpacingValue(defaultMargin.top),
      '--theme-margin-right': getSpacingValue(defaultMargin.right),
      '--theme-margin-bottom': getSpacingValue(defaultMargin.bottom),
      '--theme-margin-left': getSpacingValue(defaultMargin.left),

      // Border Radius (per-corner)
      '--theme-border-radius-tl': getSpacingValue(radius.topLeft),
      '--theme-border-radius-tr': getSpacingValue(radius.topRight),
      '--theme-border-radius-br': getSpacingValue(radius.bottomRight),
      '--theme-border-radius-bl': getSpacingValue(radius.bottomLeft),
      // Keep shorthand for backward compat (uses top-left as default)
      '--theme-border-radius': getSpacingValue(radius.topLeft),
      '--theme-border-width': this._config.borders.width,
    };
  }

  /**
   * Get raw config for serialization
   */
  toJSON(): ThemeConfigProps {
    return { ...this._config };
  }

  /**
   * Get config properties
   */
  get colors(): ThemeColors {
    return { ...this._config.colors };
  }

  get typography(): ThemeTypography {
    return { ...this._config.typography };
  }

  get spacing(): ThemeSpacing {
    return { ...this._config.spacing };
  }

  get borders(): ThemeBorders {
    return { ...this._config.borders };
  }

  /**
   * Equality comparison
   */
  equals(other: ThemeConfig): boolean {
    return JSON.stringify(this._config) === JSON.stringify(other._config);
  }
}
