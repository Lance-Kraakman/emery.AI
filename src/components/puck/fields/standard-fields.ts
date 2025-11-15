/**
 * Standard Field Definitions for Puck Blocks
 *
 * Provides reusable field configurations to ensure consistency
 * across all blocks in the theming system.
 */

import { ColorFieldRenderer } from './ColorField';

/**
 * Standard background color field
 * Uses ColorFieldRenderer for color picker with theme preview
 */
export const backgroundColorField = {
  type: "custom" as const,
  label: "Background Color (Optional)",
  render: ColorFieldRenderer,
};

/**
 * Standard text color field
 * Uses ColorFieldRenderer for color picker with theme preview
 */
export const textColorField = {
  type: "custom" as const,
  label: "Text Color (Optional)",
  render: ColorFieldRenderer,
};

/**
 * Standard border color field
 * Uses ColorFieldRenderer for color picker with theme preview
 */
export const borderColorField = {
  type: "custom" as const,
  label: "Border Color (Optional)",
  render: ColorFieldRenderer,
};

/**
 * Unified typography size field
 * Uses semantic size scale: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl
 */
export const typographySizeField = {
  type: "select" as const,
  label: "Size",
  options: [
    { value: "xs", label: "Extra Small" },
    { value: "sm", label: "Small" },
    { value: "base", label: "Base" },
    { value: "lg", label: "Large" },
    { value: "xl", label: "Extra Large" },
    { value: "2xl", label: "2X Large" },
    { value: "3xl", label: "3X Large" },
    { value: "4xl", label: "4X Large" },
    { value: "5xl", label: "5X Large" },
  ],
};

/**
 * Standard border radius field
 * Accepts CSS values (rem, px, etc.)
 */
export const borderRadiusField = {
  type: "text" as const,
  label: "Border Radius (Optional)",
  placeholder: "e.g., 0.5rem, 8px (leave empty for theme default)",
};

/**
 * Standard spacing/gap field
 * Provides common spacing levels
 */
export const spacingField = {
  type: "select" as const,
  label: "Spacing",
  options: [
    { value: "0", label: "None (0)" },
    { value: "1", label: "XS (1)" },
    { value: "2", label: "SM (2)" },
    { value: "3", label: "MD (3)" },
    { value: "4", label: "Base (4)" },
    { value: "5", label: "LG (5)" },
    { value: "6", label: "XL (6)" },
    { value: "7", label: "2XL (7)" },
    { value: "8", label: "3XL (8)" },
    { value: "9", label: "4XL (9)" },
    { value: "10", label: "5XL (10)" },
  ],
};

/**
 * Standard font family field
 * Allows custom font-family CSS value override
 */
export const fontFamilyField = {
  type: "text" as const,
  label: "Font Family (Optional)",
  placeholder: "e.g., Georgia, serif (leave empty for theme default)",
};

/**
 * Standard font weight field
 * Provides common font weight values
 */
export const fontWeightField = {
  type: "select" as const,
  label: "Font Weight (Optional)",
  options: [
    { value: "", label: "Use Theme Default" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Normal (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semibold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extrabold (800)" },
    { value: "900", label: "Black (900)" },
  ],
};
