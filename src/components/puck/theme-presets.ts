/**
 * Theme Presets for Puck Page Builder
 *
 * AIDEV-NOTE: Predefined color palettes for quick theme selection
 * Includes popular design systems and industry-specific themes
 */

import { type ThemeColors } from "@/ddd/domain/puck/value-objects/theme-config";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "tailwind-default",
    name: "Tailwind Default",
    description: "Classic Tailwind CSS color palette",
    colors: {
      primary: "#3b82f6",      // blue-500
      secondary: "#8b5cf6",    // violet-500
      background: "#f9fafb",   // gray-50
      surface: "#ffffff",      // white
      text: "#111827",         // gray-900
      textMuted: "#6b7280",    // gray-500
      border: "#e5e7eb",       // gray-200
      link: "#2563eb",         // blue-600
      success: "#10b981",      // emerald-500
      warning: "#f59e0b",      // amber-500
      error: "#ef4444",        // red-500
    },
  },
  {
    id: "material-design",
    name: "Material Design",
    description: "Google's Material Design 3 palette",
    colors: {
      primary: "#6750a4",      // Material purple
      secondary: "#625b71",    // Material secondary
      background: "#fffbfe",   // Material surface
      surface: "#ffffff",
      text: "#1c1b1f",         // Material on-surface
      textMuted: "#79747e",    // Material outline
      border: "#e7e0ec",       // Material outline-variant
      link: "#6750a4",
      success: "#2e7d32",      // Material green
      warning: "#f57c00",      // Material orange
      error: "#b3261e",        // Material error
    },
  },
  {
    id: "ant-design",
    name: "Ant Design Blue",
    description: "Ant Design's professional blue theme",
    colors: {
      primary: "#1890ff",      // Ant blue
      secondary: "#722ed1",    // Ant purple
      background: "#f0f2f5",   // Ant background
      surface: "#ffffff",
      text: "#000000d9",       // Ant text-primary (85% opacity)
      textMuted: "#00000073",  // Ant text-secondary (45% opacity)
      border: "#d9d9d9",       // Ant border
      link: "#1890ff",
      success: "#52c41a",      // Ant green
      warning: "#faad14",      // Ant gold
      error: "#ff4d4f",        // Ant red
    },
  },
  {
    id: "saas-professional",
    name: "SaaS Professional",
    description: "Clean, professional palette for B2B SaaS apps",
    colors: {
      primary: "#0066ff",      // Professional blue
      secondary: "#5f6c7b",    // Slate gray
      background: "#f5f7fa",   // Light gray
      surface: "#ffffff",
      text: "#0a1628",         // Near black
      textMuted: "#5f6c7b",    // Medium gray
      border: "#dfe3e8",       // Light border
      link: "#0052cc",         // Darker blue
      success: "#00875a",      // Professional green
      warning: "#ff8b00",      // Orange
      error: "#de350b",        // Professional red
    },
  },
  {
    id: "marketing-vibrant",
    name: "Marketing Vibrant",
    description: "Bold, eye-catching colors for marketing sites",
    colors: {
      primary: "#ff6b6b",      // Coral red
      secondary: "#4ecdc4",    // Turquoise
      background: "#ffffff",
      surface: "#f8f9fa",
      text: "#2d3436",         // Dark gray
      textMuted: "#636e72",    // Medium gray
      border: "#dfe6e9",       // Light gray
      link: "#ff6b6b",
      success: "#00b894",      // Mint green
      warning: "#fdcb6e",      // Yellow
      error: "#d63031",        // Red
    },
  },
  {
    id: "corporate-minimal",
    name: "Corporate Minimal",
    description: "Conservative grayscale with subtle blue accent",
    colors: {
      primary: "#2c5282",      // Deep blue
      secondary: "#4a5568",    // Gray
      background: "#f7fafc",   // Almost white
      surface: "#ffffff",
      text: "#1a202c",         // Near black
      textMuted: "#718096",    // Medium gray
      border: "#e2e8f0",       // Light gray
      link: "#2c5282",
      success: "#2f855a",      // Muted green
      warning: "#d69e2e",      // Muted yellow
      error: "#c53030",        // Muted red
    },
  },
  {
    id: "creative-bold",
    name: "Creative Bold",
    description: "Saturated, energetic palette for creative portfolios",
    colors: {
      primary: "#9333ea",      // Purple
      secondary: "#ec4899",    // Pink
      background: "#fafafa",   // Off-white
      surface: "#ffffff",
      text: "#18181b",         // Almost black
      textMuted: "#71717a",    // Gray
      border: "#e4e4e7",       // Light gray
      link: "#a855f7",         // Light purple
      success: "#22c55e",      // Green
      warning: "#eab308",      // Yellow
      error: "#f43f5e",        // Rose
    },
  },
  {
    id: "dark-mode",
    name: "Dark Mode",
    description: "Modern dark theme with high contrast",
    colors: {
      primary: "#60a5fa",      // Light blue
      secondary: "#a78bfa",    // Light purple
      background: "#0f172a",   // Dark slate
      surface: "#1e293b",      // Slate 800
      text: "#f1f5f9",         // Light gray
      textMuted: "#94a3b8",    // Slate 400
      border: "#334155",       // Slate 700
      link: "#60a5fa",
      success: "#34d399",      // Emerald
      warning: "#fbbf24",      // Amber
      error: "#f87171",        // Red
    },
  },
];

/**
 * Get a theme preset by ID
 */
export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id);
}

/**
 * Check if colors match a preset (for showing "Custom" label)
 */
export function matchesPreset(colors: ThemeColors): string | null {
  for (const preset of THEME_PRESETS) {
    const matches = Object.keys(preset.colors).every(
      (key) => preset.colors[key as keyof ThemeColors] === colors[key as keyof ThemeColors]
    );
    if (matches) {
      return preset.id;
    }
  }
  return null;
}
