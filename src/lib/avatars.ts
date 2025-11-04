/**
 * Avatar configuration for agents
 *
 * AIDEV-NOTE: This uses a JSON config approach with versioning to allow
 * future extensibility without database schema changes.
 * Uses DiceBear for character avatar illustrations.
 */

import { createAvatar } from '@dicebear/core';
import {
  lorelei,
  avataaars,
  openPeeps,
  personas,
  bigSmile,
  bottts,
  adventurer,
  notionists,
} from '@dicebear/collection';

/**
 * Avatar configuration version 1
 */
export interface AvatarConfigV1 {
  version: 1;
  style?: string;  // DiceBear style name
  color?: string;  // Color name for background
  seed?: string;   // Seed for deterministic avatar generation
  options?: Record<string, any>;  // Style-specific customization options
}

/**
 * Union type for all avatar config versions
 * Add new versions here as they're introduced
 */
export type AvatarConfig = AvatarConfigV1;

/**
 * Available avatar styles (DiceBear character illustrations)
 */
export const AVATAR_STYLES = {
  lorelei,
  avataaars,
  openPeeps,
  personas,
  bigSmile,
  bottts,
  adventurer,
  notionists,
} as const;

export type AvatarStyleName = keyof typeof AVATAR_STYLES;

/**
 * Display names for avatar styles
 */
export const AVATAR_STYLE_LABELS: Record<AvatarStyleName, string> = {
  lorelei: 'Lorelei',
  avataaars: 'Avataaars',
  openPeeps: 'Open Peeps',
  personas: 'Personas',
  bigSmile: 'Big Smile',
  bottts: 'Bottts',
  adventurer: 'Adventurer',
  notionists: 'Notionists',
};

/**
 * Available avatar colors with Tailwind classes and hex values
 */
export const AVATAR_COLORS = {
  blue: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-600',
    border: 'border-blue-500/30',
    hover: 'hover:bg-blue-500/30',
    hex: '#3b82f6',
  },
  purple: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-600',
    border: 'border-purple-500/30',
    hover: 'hover:bg-purple-500/30',
    hex: '#a855f7',
  },
  green: {
    bg: 'bg-green-500/20',
    text: 'text-green-600',
    border: 'border-green-500/30',
    hover: 'hover:bg-green-500/30',
    hex: '#22c55e',
  },
  orange: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-600',
    border: 'border-orange-500/30',
    hover: 'hover:bg-orange-500/30',
    hex: '#f97316',
  },
  pink: {
    bg: 'bg-pink-500/20',
    text: 'text-pink-600',
    border: 'border-pink-500/30',
    hover: 'hover:bg-pink-500/30',
    hex: '#ec4899',
  },
  red: {
    bg: 'bg-red-500/20',
    text: 'text-red-600',
    border: 'border-red-500/30',
    hover: 'hover:bg-red-500/30',
    hex: '#ef4444',
  },
  cyan: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-600',
    border: 'border-cyan-500/30',
    hover: 'hover:bg-cyan-500/30',
    hex: '#06b6d4',
  },
  amber: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-600',
    border: 'border-amber-500/30',
    hover: 'hover:bg-amber-500/30',
    hex: '#f59e0b',
  },
  indigo: {
    bg: 'bg-indigo-500/20',
    text: 'text-indigo-600',
    border: 'border-indigo-500/30',
    hover: 'hover:bg-indigo-500/30',
    hex: '#6366f1',
  },
  emerald: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-600',
    border: 'border-emerald-500/30',
    hover: 'hover:bg-emerald-500/30',
    hex: '#10b981',
  },
} as const;

export type AvatarColorName = keyof typeof AVATAR_COLORS;

/**
 * Default avatar configuration
 */
export const DEFAULT_AVATAR_CONFIG: AvatarConfigV1 = {
  version: 1,
  style: 'lorelei',
  color: 'blue',
};

/**
 * Get avatar style from name
 * Returns any to accommodate different DiceBear style types
 */
export function getAvatarStyle(styleName?: string): any {
  if (!styleName || !(styleName in AVATAR_STYLES)) {
    return AVATAR_STYLES.lorelei;
  }
  return AVATAR_STYLES[styleName as AvatarStyleName];
}

/**
 * Get color classes from color name
 */
export function getAvatarColor(colorName?: string) {
  if (!colorName || !(colorName in AVATAR_COLORS)) {
    return AVATAR_COLORS.blue;
  }
  return AVATAR_COLORS[colorName as AvatarColorName];
}

/**
 * Generate a random seed for avatar generation
 * Uses timestamp + random numbers for client-side generation
 */
export function generateRandomSeed(): string {
  // Simple client-side random: timestamp + two random strings
  const timestamp = Date.now();
  const random1 = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random1}-${random2}`;
}

/**
 * Generate avatar data URI using DiceBear
 * @param styleName - The DiceBear style to use
 * @param seed - Unique identifier for deterministic avatar generation (e.g., agent ID)
 * @param colorName - Optional color name for background
 * @param options - Optional style-specific customization options
 * @returns Data URI string for the SVG avatar
 */
export function generateAvatarDataUri(
  styleName?: string,
  seed?: string,
  colorName?: string,
  options?: Record<string, any>
): string {
  try {
    const style = getAvatarStyle(styleName);
    const color = getAvatarColor(colorName);

    // Filter out empty values and wrap feature options in arrays
    // DiceBear 9.x requires arrays for all feature options (eyes, hair, etc.)
    // but probabilities and colors should remain as numbers/strings
    const cleanOptions = options ? Object.fromEntries(
      Object.entries(options)
        .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
        .map(([key, value]) => {
          // Probability and color options stay as-is (numbers/strings)
          if (key.endsWith('Probability') || key.endsWith('Color')) {
            return [key, value];
          }
          // Wrap feature options in arrays (DiceBear requirement)
          return [key, Array.isArray(value) ? value : [value]];
        })
    ) : {};

    const avatar = createAvatar(style, {
      seed: seed || 'default',
      ...cleanOptions  // Spread style-specific options
    });

    return avatar.toDataUri();
  } catch (error) {
    console.error('Error generating avatar:', error);
    // Return a simple fallback SVG data URI
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==';
  }
}

/**
 * Migrate avatar config to latest version
 * Currently only v1 exists, but this allows for future migrations
 */
export function migrateAvatarConfig(config: AvatarConfig | null | undefined): AvatarConfigV1 {
  if (!config) {
    return DEFAULT_AVATAR_CONFIG;
  }

  // In the future, handle version migrations here
  // For now, just return v1 or default
  if (config.version === 1) {
    return config;
  }

  return DEFAULT_AVATAR_CONFIG;
}
