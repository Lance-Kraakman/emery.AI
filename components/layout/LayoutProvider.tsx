'use client'

import { createContext, useContext, useReducer, useEffect, useState } from 'react'
import type { 
  LayoutState, 
  LayoutAction, 
  LayoutProviderProps, 
  LayoutBreakpoint,
  PanelState,
  ChatContextConfig 
} from './types'
import { DEFAULT_LAYOUT_STATE, LAYOUT_BREAKPOINTS } from './types'

/**
 * Layout Context Provider - Client Component for Layout State Management
 * 
 * Manages global layout state including:
 * - Panel states (sidebar, chat)
 * - Responsive breakpoints
 * - Chat context configuration
 * - Persistence in localStorage
 * 
 * AIDEV-NOTE: Client component that provides layout state management with 
 * persistence and responsive behavior. Uses domain types for type safety.
 */

// Layout reducer
function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'SET_SIDEBAR_STATE':
      return { ...state, sidebarState: action.state }
    
    case 'SET_CHAT_STATE':
      return { ...state, chatState: action.state }
    
    case 'SET_CANVAS_STATE':
      return { ...state, canvasState: action.state }
    
    case 'SET_BREAKPOINT':
      return { 
        ...state, 
        breakpoint: action.breakpoint,
        isMobile: action.breakpoint === 'mobile'
      }
    
    case 'SET_CHAT_CONTEXT':
      return { ...state, chatContext: action.context }
    
    case 'TOGGLE_SIDEBAR':
      return { 
        ...state, 
        sidebarState: state.sidebarState === 'expanded' ? 'collapsed' : 'expanded' 
      }
    
    case 'TOGGLE_CHAT':
      return { 
        ...state, 
        chatState: state.chatState === 'expanded' ? 'collapsed' : 'expanded' 
      }
    
    case 'TOGGLE_CANVAS':
      return { 
        ...state, 
        canvasState: state.canvasState === 'expanded' ? 'collapsed' : 'expanded' 
      }
    
    case 'RESET_LAYOUT':
      return DEFAULT_LAYOUT_STATE
    
    default:
      return state
  }
}

// Context interface
interface LayoutContextValue extends LayoutState {
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

// Utility to load state from localStorage
function loadPersistedState(): Partial<LayoutState> {
  if (typeof window === 'undefined') return {}
  
  try {
    const saved = localStorage.getItem('emery-layout-state')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Only restore panel states, not responsive/context state
      return {
        sidebarState: parsed.sidebarState || 'expanded',
        chatState: parsed.chatState || 'expanded',
        canvasState: parsed.canvasState || 'collapsed'
      }
    }
  } catch (error) {
    console.warn('Failed to load layout state from localStorage:', error)
  }
  
  return {}
}

// Utility to save state to localStorage
function persistState(state: LayoutState): void {
  if (typeof window === 'undefined') return
  
  try {
    // Only persist panel states, not responsive/context state
    const toSave = {
      sidebarState: state.sidebarState,
      chatState: state.chatState,
      canvasState: state.canvasState
    }
    localStorage.setItem('emery-layout-state', JSON.stringify(toSave))
  } catch (error) {
    console.warn('Failed to save layout state to localStorage:', error)
  }
}

export function LayoutProvider({ children, initialState = {} }: LayoutProviderProps) {
  const [isClient, setIsClient] = useState(false)
  
  // Initialize state with persistence and responsive detection
  const [state, dispatch] = useReducer(layoutReducer, {
    ...DEFAULT_LAYOUT_STATE,
    ...initialState,
    breakpoint: 'desktop', // Safe default
    isMobile: false
  })

  // Client-side initialization effect
  useEffect(() => {
    setIsClient(true)
    
    // Load persisted state and set responsive breakpoint
    const persistedState = loadPersistedState()
    const currentBreakpoint = getCurrentBreakpoint()
    
    // Update with persisted state
    if (persistedState.sidebarState) {
      dispatch({ type: 'SET_SIDEBAR_STATE', state: persistedState.sidebarState })
    }
    if (persistedState.chatState) {
      dispatch({ type: 'SET_CHAT_STATE', state: persistedState.chatState })
    }
    if (persistedState.canvasState) {
      dispatch({ type: 'SET_CANVAS_STATE', state: persistedState.canvasState })
    }
    
    // Set responsive breakpoint
    dispatch({ type: 'SET_BREAKPOINT', breakpoint: currentBreakpoint })
  }, [])

  // Handle window resize for responsive behavior
  useEffect(() => {
    function handleResize() {
      const breakpoint = getCurrentBreakpoint()
      dispatch({ type: 'SET_BREAKPOINT', breakpoint })
      
      // Auto-collapse panels on mobile
      if (breakpoint === 'mobile') {
        if (state.sidebarState === 'expanded') {
          dispatch({ type: 'SET_SIDEBAR_STATE', state: 'collapsed' })
        }
        if (state.chatState === 'expanded') {
          dispatch({ type: 'SET_CHAT_STATE', state: 'collapsed' })
        }
        if (state.canvasState === 'expanded') {
          dispatch({ type: 'SET_CANVAS_STATE', state: 'collapsed' })
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [state.sidebarState, state.chatState, state.canvasState])

  // Persist state changes (client-side only)
  useEffect(() => {
    if (isClient) {
      persistState(state)
    }
  }, [state.sidebarState, state.chatState, state.canvasState, isClient])

  // Action handlers
  const setSidebarState = (panelState: PanelState) => {
    dispatch({ type: 'SET_SIDEBAR_STATE', state: panelState })
  }

  const setChatState = (panelState: PanelState) => {
    dispatch({ type: 'SET_CHAT_STATE', state: panelState })
  }

  const setCanvasState = (panelState: PanelState) => {
    dispatch({ type: 'SET_CANVAS_STATE', state: panelState })
  }

  const setChatContext = (context: ChatContextConfig) => {
    dispatch({ type: 'SET_CHAT_CONTEXT', context })
  }

  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' })
  }

  const toggleChat = () => {
    dispatch({ type: 'TOGGLE_CHAT' })
  }

  const toggleCanvas = () => {
    dispatch({ type: 'TOGGLE_CANVAS' })
  }

  const resetLayout = () => {
    dispatch({ type: 'RESET_LAYOUT' })
  }

  const contextValue: LayoutContextValue = {
    ...state,
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