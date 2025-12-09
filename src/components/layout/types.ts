/**
 * Layout-specific types using domain entities and value objects
 * AIDEV-NOTE: Layout types that integrate with domain entities for type-safe UI state management
 */

import type { DomainType } from '@/ddd/domain/shared/types/domain-type'
import type { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects'

// Layout panel states
export type PanelState = 'expanded' | 'collapsed' | 'hidden'

// Responsive breakpoints
export type LayoutBreakpoint = 'mobile' | 'tablet' | 'desktop'

// Canvas types - now only chat since documents/files use chat-ui artifacts
export type CanvasType = 'chat'

// Chat context for different domain types
export interface ChatContextConfig {
  domainType?: DomainType | 'organizations' | 'general'
  domainId?: number
  domainName?: string
  // Context-specific features
  enableDomainQueries?: boolean
  enableFileAttachments?: boolean
  enableCodeGeneration?: boolean
  enableDataAnalysis?: boolean
}

// Layout state interface
export interface LayoutState {
  // Panel states
  sidebarState: PanelState
  chatState: PanelState

  // Canvas configuration
  canvasType: CanvasType

  // Responsive state
  breakpoint: LayoutBreakpoint
  isMobile: boolean

  // Chat configuration
  chatContext?: ChatContextConfig

  // User context (for permissions and personalization)
  userId?: UserId
  organizationId?: OrganizationId
}

// Layout actions
export type LayoutAction =
  | { type: 'SET_SIDEBAR_STATE'; state: PanelState }
  | { type: 'SET_CHAT_STATE'; state: PanelState }
  | { type: 'SET_CANVAS_TYPE'; canvasType: CanvasType }
  | { type: 'SET_BREAKPOINT'; breakpoint: LayoutBreakpoint }
  | { type: 'SET_CHAT_CONTEXT'; context: ChatContextConfig }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'RESET_LAYOUT' }

// Props for layout components
export interface EmeryLayoutProps {
  children: React.ReactNode
  chatContext?: ChatContextConfig
  enableChat?: boolean
  initialSidebarState?: PanelState
  initialChatState?: PanelState
}

export interface LayoutProviderProps {
  children: React.ReactNode
  initialState?: Partial<LayoutState>
}

// Layout utilities
export const LAYOUT_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440
} as const

export const DEFAULT_LAYOUT_STATE: LayoutState = {
  sidebarState: 'expanded',
  chatState: 'expanded',
  canvasType: 'chat',
  breakpoint: 'desktop',
  isMobile: false
}

// Helper functions for context-aware chat configuration
export const createChatContextForPage = (
  page: string, 
  domainId?: number, 
  domainName?: string
): ChatContextConfig => {
  const baseConfig: ChatContextConfig = {
    enableFileAttachments: true,
    enableCodeGeneration: false,
    enableDataAnalysis: false,
    enableDomainQueries: false
  }

  switch (page) {
    case 'mission-control':
      return {
        ...baseConfig,
        domainType: 'general',
        enableCodeGeneration: true,
        enableDataAnalysis: true
      }
    
    case 'agents':
      return {
        ...baseConfig,
        domainType: 'agents',
        domainId,
        domainName,
        enableCodeGeneration: true,
        enableDomainQueries: true
      }
    
    case 'teams':
      return {
        ...baseConfig,
        domainType: 'teams',
        domainId,
        domainName,
        enableDomainQueries: true
      }
    
    case 'data':
      return {
        ...baseConfig,
        domainType: 'tables',
        domainId,
        domainName,
        enableDataAnalysis: true,
        enableDomainQueries: true
      }
    
    case 'organization':
      return {
        ...baseConfig,
        domainType: 'organizations',
        enableDomainQueries: true
      }
    
    default:
      return {
        ...baseConfig,
        domainType: 'organizations'
      }
  }
}