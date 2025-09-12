/**
 * Chat Mentions Type Definitions
 * 
 * Types for the + button and @ mention system in EmeryChat.
 * Supports hierarchical menus for Tools, Agents, Teams, Settings, and Data.
 * 
 * AIDEV-NOTE: Comprehensive type system for chat contextual references
 */

import { ReactNode } from 'react'
import { ToolDefinition } from '@/lib/agents/tools-registry'
import type { AgentDTO } from '@/app/mappers/agent-mapper'
import type { TeamDTO } from '@/app/mappers/team-mapper'
import type { DatabaseWithTables } from '@/stores/app-state.store'

// Main category types for + button menu
export type MentionCategory = 'tools' | 'agents' | 'teams' | 'settings' | 'data' | 'documents'

// Menu level tracking
export type MenuLevel = 'main' | 'submenu'

// Base interface for all mentionable items
export interface MentionItem {
  id: string
  name: string
  displayName: string
  description?: string
  icon: ReactNode
  category: MentionCategory
  insertText: string // What gets inserted into chat
  available?: boolean // For tools requiring OAuth
  metadata?: Record<string, any>
}

// Tool mention item (extends base with tool-specific data)
export interface ToolMentionItem extends MentionItem {
  category: 'tools'
  tool: ToolDefinition
  requiresAuth: boolean
  oauthService?: string
  subcategory: string // tool.category (communication, data, etc.)
}

// Agent mention item
export interface AgentMentionItem extends MentionItem {
  category: 'agents'
  agent: AgentDTO
  status: string
  organizationId: number
}

// Team mention item
export interface TeamMentionItem extends MentionItem {
  category: 'teams'
  team: TeamDTO
  memberCount?: number
  organizationId: number
}

// Data mention item (database or table)
export interface DataMentionItem extends MentionItem {
  category: 'data'
  type: 'database' | 'table'
  databaseId?: number
  tableId?: number
  parentName?: string // For tables, the database name
}

// Settings mention item
export interface SettingsMentionItem extends MentionItem {
  category: 'settings'
  settingType: 'oauth' | 'users' | 'system' | 'organization'
  route?: string // Navigation route if applicable
}

// Document mention item
export interface DocumentMentionItem extends MentionItem {
  category: 'documents'
  documentType: 'tiptap' | 'file'
  tableId?: number
  fieldId?: number
  documentId?: string
  fileUrl?: string
  mimeType?: string
  parentTable?: string // Table name for context
}

// Union type for all mention items
export type AnyMentionItem = 
  | ToolMentionItem 
  | AgentMentionItem 
  | TeamMentionItem 
  | DataMentionItem 
  | SettingsMentionItem
  | DocumentMentionItem

// Main category configuration
export interface CategoryConfig {
  id: MentionCategory
  name: string
  icon: ReactNode
  description: string
  shortcut?: string
}

// Dropdown state management
export interface MentionDropdownState {
  isOpen: boolean
  currentLevel: MenuLevel
  selectedCategory?: MentionCategory
  searchTerm: string
  cursorPosition: number
  triggerPosition: number // Position where @ or + was triggered
  filteredItems: AnyMentionItem[]
  selectedIndex: number
  triggerType: 'plus' | 'at' // How the dropdown was triggered
}

// Search configuration
export interface MentionSearchConfig {
  placeholder: string
  categories: MentionCategory[]
  maxResults: number
  fuzzySearch: boolean
}

// Dropdown position and layout
export interface DropdownPosition {
  top?: number
  bottom?: number
  left: number
  maxHeight: number
  direction: 'up' | 'down'
}

// Event handlers for mention interactions
export interface MentionHandlers {
  onItemSelect: (item: AnyMentionItem) => void
  onCategorySelect: (category: MentionCategory) => void
  onSearchChange: (term: string) => void
  onClose: () => void
  onKeyDown: (event: React.KeyboardEvent) => void
}

// Hook return type for useChatMentions
export interface ChatMentionsHook {
  // State
  dropdownState: MentionDropdownState
  availableItems: Record<MentionCategory, AnyMentionItem[]>
  categories: CategoryConfig[]
  
  // Actions
  openDropdown: (triggerType: 'plus' | 'at', position: number) => void
  closeDropdown: () => void
  selectCategory: (category: MentionCategory) => void
  selectItem: (item: AnyMentionItem) => void
  setSearchTerm: (term: string) => void
  navigateItems: (direction: 'up' | 'down') => void
  goBackToMain: () => void
  
  // Handlers (pre-bound)
  handlers: MentionHandlers
}

// Configuration for the mention system
export interface ChatMentionsConfig {
  enablePlusButton: boolean
  enableAtMentions: boolean
  enableSearch: boolean
  maxDropdownHeight: number
  searchDebounceMs: number
  categories: MentionCategory[]
}

// Default insertion text templates
export const MENTION_TEMPLATES = {
  tools: (name: string) => `@tool:${name}`,
  agents: (name: string) => `@agent:${name}`,
  teams: (name: string) => `@team:${name}`,
  data: (type: 'database' | 'table', name: string) => `@${type}:${name}`,
  settings: (type: string) => `@setting:${type}`,
  documents: (name: string) => `@doc:${name}`
} as const

// Icons for categories (to be imported from lucide-react)
export const CATEGORY_ICONS = {
  tools: 'Wrench',
  agents: 'Bot', 
  teams: 'Users',
  settings: 'Settings',
  data: 'Database',
  documents: 'FileText'
} as const

// AIDEV-NOTE: These types provide a comprehensive foundation for the mention system
// AIDEV-NOTE: Supports both + button hierarchical menus and @ inline mentions
// AIDEV-NOTE: Extensible design allows adding new categories and item types easily