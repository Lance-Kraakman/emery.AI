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
 * Used for gap in Grid/Flex containers
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
 * Standard padding field
 * Uses spacing scale (0-10) that calculates as: level × theme spacing unit
 * Example: level 4 with 0.25rem unit = 1rem padding
 */
export const paddingField = {
  type: "select" as const,
  label: "Padding (Optional)",
  options: [
    { value: "", label: "Use Theme Default" },
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
 * Standard border width field
 * Provides common border thickness values
 */
export const borderWidthField = {
  type: "select" as const,
  label: "Border Width (Optional)",
  options: [
    { value: "", label: "Use Theme Default" },
    { value: "0", label: "None (0px)" },
    { value: "1px", label: "Thin (1px)" },
    { value: "2px", label: "Medium (2px)" },
    { value: "3px", label: "Thick (3px)" },
    { value: "4px", label: "Extra Thick (4px)" },
  ],
};

/**
 * Standard font family field
 * Dropdown selector with common web-safe fonts
 * Matches options from FontSelect component used in theme editor
 */
export const fontFamilyField = {
  type: "select" as const,
  label: "Font Family (Optional)",
  options: [
    { value: "", label: "Use Theme Default" },
    // System Fonts
    { value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", label: "System Default" },
    { value: "system-ui, sans-serif", label: "System UI" },
    // Sans-Serif Fonts
    { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica Neue" },
    { value: "Arial, 'Helvetica Neue', Helvetica, sans-serif", label: "Arial" },
    { value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", label: "Segoe UI" },
    { value: "Verdana, Geneva, Tahoma, sans-serif", label: "Verdana" },
    { value: "'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif", label: "Trebuchet MS" },
    // Serif Fonts
    { value: "Georgia, 'Times New Roman', Times, serif", label: "Georgia" },
    { value: "'Times New Roman', Times, Georgia, serif", label: "Times New Roman" },
    { value: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif", label: "Palatino" },
    { value: "Garamond, Baskerville, 'Baskerville Old Face', 'Hoefler Text', serif", label: "Garamond" },
    // Monospace Fonts
    { value: "Menlo, Monaco, 'Courier New', Courier, monospace", label: "Menlo" },
    { value: "Monaco, Menlo, Consolas, 'Courier New', monospace", label: "Monaco" },
    { value: "Consolas, Monaco, 'Lucida Console', 'Liberation Mono', monospace", label: "Consolas" },
    { value: "'Courier New', Courier, 'Lucida Sans Typewriter', monospace", label: "Courier New" },
  ],
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

/**
 * Standard label position field
 * Controls whether form field labels appear above or inline with the field
 */
export const labelPositionField = {
  type: "radio" as const,
  label: "Label Position",
  options: [
    { value: "top", label: "Top" },
    { value: "inline", label: "Inline" },
  ],
};
