/**
 * Search Display Utilities
 * 
 * Utility functions for displaying search results in the unified search UI.
 * Handles category icons, display names, and formatting.
 * 
 * AIDEV-NOTE: Extracted from old type mappers for cleaner architecture
 */

import React from 'react'
import { 
  Wrench, 
  Bot, 
  Users, 
  Settings, 
  Database,
  Key,
  UserCog,
  Monitor,
  FileText
} from 'lucide-react'

/**
 * Get appropriate icon for a category
 */
export function getCategoryIcon(category: string, className: string = 'h-4 w-4') {
  switch (category) {
    case 'tools':
      return React.createElement(Wrench, { className })
    case 'agents':
      return React.createElement(Bot, { className })
    case 'teams':
      return React.createElement(Users, { className })
    case 'tables':
    case 'data':
      return React.createElement(Database, { className })
    case 'settings':
      return React.createElement(Settings, { className })
    case 'documents':
      return React.createElement(FileText, { className })
    default:
      return React.createElement(FileText, { className })
  }
}

/**
 * Map store categories to display names
 */
export function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'tools':
      return 'Tools'
    case 'agents':
      return 'Agents'
    case 'teams':
      return 'Teams'
    case 'tables':
      return 'Tables'
    case 'data':
      return 'Data'
    case 'settings':
      return 'Settings'
    case 'documents':
      return 'Documents'
    default:
      return category.charAt(0).toUpperCase() + category.slice(1)
  }
}

/**
 * Get category-specific icon based on setting type
 */
export function getSettingsIcon(settingType: string, className: string = 'h-4 w-4') {
  switch (settingType) {
    case 'oauth':
      return React.createElement(Key, { className })
    case 'users':
      return React.createElement(UserCog, { className })
    case 'system':
      return React.createElement(Monitor, { className })
    default:
      return React.createElement(Settings, { className })
  }
}