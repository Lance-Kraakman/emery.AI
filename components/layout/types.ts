/**
 * Layout-specific types using domain entities and value objects
 * AIDEV-NOTE: Layout types that integrate with domain entities for type-safe UI state management
 */

import type { DomainType } from '@/ddd/domain/rag/value-objects'
import type { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects'
import type { DocumentField } from '@/ddd/domain/tables/entities/document-field-entity'

// Layout panel states
export type PanelState = 'expanded' | 'collapsed' | 'hidden'

// Responsive breakpoints
export type LayoutBreakpoint = 'mobile' | 'tablet' | 'desktop'

// Canvas types
export type CanvasType = 'chat' | 'document' | 'file-viewer'

// Document context for canvas
export interface DocumentContextConfig {
  tableId: number
  fieldId: number
  documentField: DocumentField
  mode: 'view' | 'edit'
}

// File viewer context for canvas
export interface FileViewerContextConfig {
  tableId: number
  fieldId: number
  fileField: any // Will be enhanced with FileField entity later
  viewerType: 'pdf' | 'image' | 'text' | 'office' | 'generic'
  fileName: string
  fileUrl?: string
}

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
  canvasState: PanelState // New canvas state
  
  // Canvas configuration
  canvasType: CanvasType
  documentContext?: DocumentContextConfig
  fileViewerContext?: FileViewerContextConfig
  
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
  | { type: 'SET_CANVAS_STATE'; state: PanelState }
  | { type: 'SET_CANVAS_TYPE'; canvasType: CanvasType }
  | { type: 'SET_BREAKPOINT'; breakpoint: LayoutBreakpoint }
  | { type: 'SET_CHAT_CONTEXT'; context: ChatContextConfig }
  | { type: 'SET_DOCUMENT_CONTEXT'; context: DocumentContextConfig }
  | { type: 'SET_FILE_VIEWER_CONTEXT'; context: FileViewerContextConfig }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'TOGGLE_CANVAS' }
  | { type: 'RESET_LAYOUT' }

// Props for layout components
export interface EmeryLayoutProps {
  children: React.ReactNode
  chatContext?: ChatContextConfig
  enableChat?: boolean
  initialSidebarState?: PanelState
  initialChatState?: PanelState
  initialCanvasState?: PanelState
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
  canvasState: 'collapsed', // Canvas starts collapsed by default
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