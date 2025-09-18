/**
 * Reference Type Enums and Constants
 *
 * Type definitions for chat references across the system.
 * Provides type safety for reference categories and operations.
 *
 * AIDEV-NOTE: Centralized type definitions for all reference-related operations.
 * Ensures consistency across UI, application services, and domain logic.
 */

/**
 * Reference categories for chat mentions
 */
export enum ReferenceCategory {
  DOC = 'doc',               // Documents from tables
  FILE = 'file',             // Files from tables
  AGENT = 'agent',           // AI agents
  TABLE = 'table',           // Database tables
  DATABASE = 'database'      // Databases
}

/**
 * Reference category display information
 */
export interface ReferenceCategoryInfo {
  category: ReferenceCategory
  label: string
  description: string
  icon: string
  prefix: string
}

/**
 * Reference category metadata for UI display
 */
export const REFERENCE_CATEGORY_INFO: Record<ReferenceCategory, ReferenceCategoryInfo> = {
  [ReferenceCategory.DOC]: {
    category: ReferenceCategory.DOC,
    label: 'Documents',
    description: 'Documents from your organization\'s tables',
    icon: 'file-text',
    prefix: '@doc:'
  },
  [ReferenceCategory.FILE]: {
    category: ReferenceCategory.FILE,
    label: 'Files',
    description: 'Files and attachments from your organization',
    icon: 'paperclip',
    prefix: '@file:'
  },
  [ReferenceCategory.AGENT]: {
    category: ReferenceCategory.AGENT,
    label: 'Agents',
    description: 'AI agents in your organization',
    icon: 'bot',
    prefix: '@agent:'
  },
  [ReferenceCategory.TABLE]: {
    category: ReferenceCategory.TABLE,
    label: 'Tables',
    description: 'Data tables in your databases',
    icon: 'table',
    prefix: '@table:'
  },
  [ReferenceCategory.DATABASE]: {
    category: ReferenceCategory.DATABASE,
    label: 'Databases',
    description: 'Databases in your organization',
    icon: 'database',
    prefix: '@database:'
  }
} as const

/**
 * Get category info for a specific category
 */
export function getCategoryInfo(category: ReferenceCategory): ReferenceCategoryInfo {
  return REFERENCE_CATEGORY_INFO[category]
}

/**
 * Get all reference categories for UI display
 */
export function getAllReferenceCategories(): ReferenceCategoryInfo[] {
  return Object.values(REFERENCE_CATEGORY_INFO)
}

/**
 * Get category from insert text prefix
 */
export function getCategoryFromPrefix(insertText: string): ReferenceCategory | null {
  for (const [category, info] of Object.entries(REFERENCE_CATEGORY_INFO)) {
    if (insertText.startsWith(info.prefix)) {
      return category as ReferenceCategory
    }
  }
  return null
}

/**
 * Check if a string is a valid reference insert text
 */
export function isValidReferenceText(text: string): boolean {
  return getCategoryFromPrefix(text) !== null
}

/**
 * Legacy type aliases for backward compatibility
 */
export type ReferenceCategoryLegacy = 'doc' | 'file' | 'agent' | 'table' | 'database'

/**
 * Convert legacy category to enum
 */
export function categoryFromLegacy(legacy: ReferenceCategoryLegacy): ReferenceCategory {
  return legacy as ReferenceCategory
}

/**
 * Convert enum to legacy category
 */
export function categoryToLegacy(category: ReferenceCategory): ReferenceCategoryLegacy {
  return category as ReferenceCategoryLegacy
}