'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-store'
import type { 
  LayoutProviderProps, 
  LayoutBreakpoint,
  PanelState,
  ChatContextConfig,
  CanvasType
} from './types'
import { LAYOUT_BREAKPOINTS } from './types'
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store'
import { storeActions, uiStateActions } from '@/stores/actions'

/**
 * Layout Context Provider - TanStack Store-based Layout State Management
 * 
 * Migrated to use TanStack Store for better performance and consistency.
 * Maintains the same API for backwards compatibility.
 * 
 * AIDEV-NOTE: Migrated from useReducer to TanStack Store for fine-grained
 * reactivity and consistent state management across the application.
 */

// Context interface - maintains backwards compatibility
interface LayoutContextValue {
  // State
  sidebarState: PanelState
  chatState: PanelState
  canvasType: CanvasType
  breakpoint: LayoutBreakpoint
  isMobile: boolean
  chatContext?: ChatContextConfig
  // Actions
  setSidebarState: (state: PanelState) => void
  setChatState: (state: PanelState) => void
  setCanvasType: (type: CanvasType) => void
  setChatContext: (context: ChatContextConfig) => void
  toggleSidebar: () => void
  toggleChat: () => void
  resetLayout: () => void
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined)

// Custom hook to use layout context
/**
 * @deprecated Use fine-grained store subscriptions instead:
 *
 * ```tsx
 * import { useStore } from '@tanstack/react-store'
 * import { uiStateStore, uiStateSelectors, uiStateActions } from '@/stores/ui-state.store'
 *
 * const sidebarState = useStore(uiStateStore, uiStateSelectors.sidebarState)
 * const toggleSidebar = uiStateActions.toggleSidebar
 * ```
 *
 * This prevents unnecessary re-renders when unrelated state changes.
 */
export function useLayout(): LayoutContextValue {
  console.warn('[useLayout] DEPRECATED: Use fine-grained store subscriptions instead. See LayoutProvider.tsx for migration guide.')
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

// Utility to determine current breakpoint
function getCurrentBreakpoint(): LayoutBreakpoint {
  if (typeof window === 'undefined') return 'desktop'
  
  const width = window.innerWidth
  if (width < LAYOUT_BREAKPOINTS.mobile) return 'mobile'
  if (width < LAYOUT_BREAKPOINTS.tablet) return 'tablet'
  return 'desktop'
}

// Store persistence is now handled by the store itself
// AIDEV-NOTE: Persistence logic moved to ui-state.store.ts for centralized management

export function LayoutProvider({ children, initialState = {} }: LayoutProviderProps) {
  const [isClient, setIsClient] = useState(false)
  
  // Use TanStack Store with fine-grained subscriptions
  const sidebarState = useStore(uiStateStore, uiStateSelectors.sidebarState)
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState)
  const canvasType = useStore(uiStateStore, uiStateSelectors.canvasType)
  const breakpoint = useStore(uiStateStore, uiStateSelectors.breakpoint)
  const isMobile = useStore(uiStateStore, uiStateSelectors.isMobile)
  const chatContext = useStore(uiStateStore, uiStateSelectors.chatContext)

  // Client-side initialization effect
  useEffect(() => {
    setIsClient(true)
    
    // Set initial breakpoint and load persisted state
    const currentBreakpoint = getCurrentBreakpoint()
    uiStateActions.setBreakpoint(currentBreakpoint)
    
    // Apply any initial state overrides
    if (initialState.sidebarState) {
      uiStateActions.setSidebarState(initialState.sidebarState)
    }
    if (initialState.chatState) {
      uiStateActions.setChatState(initialState.chatState)
    }
    if (initialState.chatContext) {
      uiStateActions.setChatContext(initialState.chatContext)
    }
  }, [])

  // Handle window resize for responsive behavior
  useEffect(() => {
    function handleResize() {
      const newBreakpoint = getCurrentBreakpoint()
      uiStateActions.setBreakpoint(newBreakpoint)

      // Auto-collapse panels on mobile
      if (newBreakpoint === 'mobile') {
        if (sidebarState === 'expanded') {
          uiStateActions.setSidebarState('collapsed')
        }
        if (chatState === 'expanded') {
          uiStateActions.setChatState('collapsed')
        }
      }
    }

    if (isClient) {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [sidebarState, chatState, isClient])

  // Action handlers - delegate to store actions
  const setSidebarState = (panelState: PanelState) => {
    uiStateActions.setSidebarState(panelState)
  }

  const setChatState = (panelState: PanelState) => {
    uiStateActions.setChatState(panelState)
  }

  const setCanvasType = (type: CanvasType) => {
    uiStateActions.setCanvasType(type)
  }

  const setChatContext = (context: ChatContextConfig) => {
    uiStateActions.setChatContext(context)
  }

  const toggleSidebar = () => {
    uiStateActions.toggleSidebar()
  }

  const toggleChat = () => {
    uiStateActions.toggleChat()
  }

  const resetLayout = () => {
    uiStateActions.resetLayout()
  }

  const contextValue: LayoutContextValue = {
    sidebarState,
    chatState,
    canvasType,
    breakpoint,
    isMobile,
    chatContext,
    setSidebarState,
    setChatState,
    setCanvasType,
    setChatContext,
    toggleSidebar,
    toggleChat,
    resetLayout
  }

  return (
    <LayoutContext.Provider value={contextValue}>
      <div suppressHydrationWarning>
        {children}
      </div>
    </LayoutContext.Provider>
  )
}