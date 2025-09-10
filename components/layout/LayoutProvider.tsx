'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-store'
import type { 
  LayoutProviderProps, 
  LayoutBreakpoint,
  PanelState,
  ChatContextConfig 
} from './types'
import { LAYOUT_BREAKPOINTS } from './types'
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store'
import { storeActions } from '@/stores/actions'

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
  canvasState: PanelState
  breakpoint: LayoutBreakpoint
  isMobile: boolean
  chatContext?: ChatContextConfig
  // Actions
  setSidebarState: (state: PanelState) => void
  setChatState: (state: PanelState) => void
  setCanvasState: (state: PanelState) => void
  setChatContext: (context: ChatContextConfig) => void
  toggleSidebar: () => void
  toggleChat: () => void
  toggleCanvas: () => void
  resetLayout: () => void
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined)

// Custom hook to use layout context
export function useLayout(): LayoutContextValue {
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
  const canvasState = useStore(uiStateStore, uiStateSelectors.canvasState)
  const breakpoint = useStore(uiStateStore, uiStateSelectors.breakpoint)
  const isMobile = useStore(uiStateStore, uiStateSelectors.isMobile)
  const chatContext = useStore(uiStateStore, uiStateSelectors.chatContext)

  // Client-side initialization effect
  useEffect(() => {
    setIsClient(true)
    
    // Set initial breakpoint and load persisted state
    const currentBreakpoint = getCurrentBreakpoint()
    storeActions.uiStateActions.setBreakpoint(currentBreakpoint)
    
    // Apply any initial state overrides
    if (initialState.sidebarState) {
      storeActions.uiStateActions.setSidebarState(initialState.sidebarState)
    }
    if (initialState.chatState) {
      storeActions.uiStateActions.setChatState(initialState.chatState)
    }
    if (initialState.canvasState) {
      storeActions.uiStateActions.setCanvasState(initialState.canvasState)
    }
    if (initialState.chatContext) {
      storeActions.uiStateActions.setChatContext(initialState.chatContext)
    }
  }, [])

  // Handle window resize for responsive behavior
  useEffect(() => {
    function handleResize() {
      const newBreakpoint = getCurrentBreakpoint()
      storeActions.uiStateActions.setBreakpoint(newBreakpoint)
      
      // Auto-collapse panels on mobile
      if (newBreakpoint === 'mobile') {
        if (sidebarState === 'expanded') {
          storeActions.uiStateActions.setSidebarState('collapsed')
        }
        if (chatState === 'expanded') {
          storeActions.uiStateActions.setChatState('collapsed')
        }
        if (canvasState === 'expanded') {
          storeActions.uiStateActions.setCanvasState('collapsed')
        }
      }
    }

    if (isClient) {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [sidebarState, chatState, canvasState, isClient])

  // Action handlers - delegate to store actions
  const setSidebarState = (panelState: PanelState) => {
    storeActions.uiStateActions.setSidebarState(panelState)
  }

  const setChatState = (panelState: PanelState) => {
    storeActions.uiStateActions.setChatState(panelState)
  }

  const setCanvasState = (panelState: PanelState) => {
    storeActions.uiStateActions.setCanvasState(panelState)
  }

  const setChatContext = (context: ChatContextConfig) => {
    storeActions.uiStateActions.setChatContext(context)
  }

  const toggleSidebar = () => {
    storeActions.uiStateActions.toggleSidebar()
  }

  const toggleChat = () => {
    storeActions.uiStateActions.toggleChat()
  }

  const toggleCanvas = () => {
    storeActions.uiStateActions.toggleCanvas()
  }

  const resetLayout = () => {
    storeActions.uiStateActions.resetLayout()
  }

  const contextValue: LayoutContextValue = {
    sidebarState,
    chatState,
    canvasState,
    breakpoint,
    isMobile,
    chatContext,
    setSidebarState,
    setChatState,
    setCanvasState,
    setChatContext,
    toggleSidebar,
    toggleChat,
    toggleCanvas,
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