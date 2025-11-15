/**
 * Theme configuration for Puck applications
 * Supports hierarchical theming: App → Page → Component
 */

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
}

export interface ThemeBorders {
  radius: string;
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
  },
  borders: {
    radius: '0.5rem',
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

    // Validate borders
    if (!this._config.borders.radius) {
      throw new Error('Border radius is required');
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

      // Spacing and Borders
      '--theme-spacing-unit': this._config.spacing.unit,
      '--theme-spacing-scale': this._config.spacing.scale.toString(),
      '--theme-border-radius': this._config.borders.radius,
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
