/**
 * UI State Store - Replaces DataDialogsContext and LayoutProvider
 * 
 * Centralizes all UI state including layout, dialogs, modals, and panel states.
 * This store replaces multiple Context providers with a single, performant store.
 * 
 * AIDEV-NOTE: This replaces DataDialogsContext, LayoutProvider and manages all
 * UI state with fine-grained reactivity and persistence capabilities.
 */

import { Store } from '@tanstack/react-store'
import { persistence } from './utils'

export type PanelState = 'expanded' | 'collapsed' | 'hidden'
export type LayoutBreakpoint = 'mobile' | 'tablet' | 'desktop'
export type ChatWidthMode = 'normal' | 'full' // 'full' = 50% of available space (excluding sidebar)

// Import ChatContextConfig and canvas types from layout types to avoid duplication
import type { ChatContextConfig, CanvasType } from '@/components/layout/types'
// Import artifact types for canvas display (both custom Emery and standard LlamaIndex)
import type { Artifact } from '@llamaindex/chat-ui'

export interface UIState {
  // Layout state (from LayoutProvider)
  sidebarState: PanelState
  chatState: PanelState
  chatWidthMode: ChatWidthMode // Width mode when chat is expanded
  canvasType: CanvasType
  breakpoint: LayoutBreakpoint
  isMobile: boolean

  // Canvas/Artifact state (supports both Emery custom and standard LlamaIndex artifacts)
  displayedArtifact: Artifact | null

  // Context states
  chatContext: ChatContextConfig | undefined
  
  // Dialog states (from DataDialogsContext)
  isCreateDatabaseOpen: boolean
  isCreateTableOpen: boolean
  selectedDatabaseForTable?: number
  
  // Sidebar collapsible states
  openCollapsibles: string[]
  
  // Panel collapse states for various components
  isPanelCollapsed: {
    agents: boolean
    teams: boolean
    organization: boolean
    data: boolean
  }
  
  // Search and filter states
  isSearchExpanded: {
    agents: boolean
    teams: boolean
    organization: boolean
    data: boolean
  }
  
  // Modal and dialog states
  modals: {
    agentCreate: boolean
    teamCreate: boolean
    teamEdit: boolean
    fieldManager: boolean
    scheduleDialog: boolean
    taskFormDialog: boolean
    permissionsEdit: boolean
    roleCreate: boolean
    roleEdit: boolean
    entityMultiSelect: boolean
  }
  
  // Form states for various components
  forms: {
    agentCreate: {
      isOpen: boolean
      editingAgent: string | null
    }
    teamForm: {
      isOpen: boolean
      editingTeam: number | null
    }
  }
  
  // Notification states
  notifications: {
    showResetNotification: boolean
    toasts: Array<{
      id: string
      type: 'success' | 'error' | 'info' | 'warning'
      message: string
      timestamp: Date
    }>
  }
}

const initialState: UIState = {
  // Layout defaults
  sidebarState: 'expanded',
  chatState: 'collapsed',
  chatWidthMode: 'normal',
  canvasType: 'chat',
  breakpoint: 'desktop',
  isMobile: false,

  // Canvas/Artifact state
  displayedArtifact: null,

  // Context states
  chatContext: undefined,
  
  // Dialog states
  isCreateDatabaseOpen: false,
  isCreateTableOpen: false,
  selectedDatabaseForTable: undefined,
  
  // Collapsible states
  openCollapsibles: [],
  
  // Panel states
  isPanelCollapsed: {
    agents: false,
    teams: false,
    organization: false,
    data: false
  },
  
  // Search states
  isSearchExpanded: {
    agents: false,
    teams: false,
    organization: false,
    data: false
  },
  
  // Modal states
  modals: {
    agentCreate: false,
    teamCreate: false,
    teamEdit: false,
    fieldManager: false,
    scheduleDialog: false,
    taskFormDialog: false,
    permissionsEdit: false,
    roleCreate: false,
    roleEdit: false,
    entityMultiSelect: false
  },
  
  // Form states
  forms: {
    agentCreate: {
      isOpen: false,
      editingAgent: null
    },
    teamForm: {
      isOpen: false,
      editingTeam: null
    }
  },
  
  // Notifications
  notifications: {
    showResetNotification: false,
    toasts: []
  }
}

// Create the UI state store
export const uiStateStore = new Store(initialState)

// Setup persistence for layout state
let persistenceCleanup: (() => void) | null = null

if (typeof window !== 'undefined') {
  // Load persisted state
  const persistedState = persistence.load('emery-ui-state', initialState)

  if (Object.keys(persistedState).length > 0) {
    uiStateStore.setState((state) => ({ ...state, ...persistedState }))
  }

  // Setup auto-persistence
  persistenceCleanup = persistence.setupAutoPersist(
    uiStateStore,
    'emery-ui-state',
    {
      key: 'emery-ui-state',
      enabled: true,
      whitelist: ['sidebarState', 'chatState', 'chatWidthMode', 'canvasType', 'openCollapsibles', 'isPanelCollapsed']
    }
  )
}

// Store actions for UI state management
export const uiStateActions = {
  // Layout actions
  setSidebarState: (state: PanelState) => {
    uiStateStore.setState((currentState) => ({ ...currentState, sidebarState: state }))
  },

  setChatState: (state: PanelState) => {
    uiStateStore.setState((currentState) => ({ ...currentState, chatState: state }))
  },

  setBreakpoint: (breakpoint: LayoutBreakpoint) => {
    uiStateStore.setState((state) => ({ 
      ...state, 
      breakpoint, 
      isMobile: breakpoint === 'mobile' 
    }))
  },

  toggleSidebar: () => {
    uiStateStore.setState((state) => ({
      ...state,
      sidebarState: state.sidebarState === 'expanded' ? 'collapsed' : 'expanded'
    }))
  },

  toggleChat: () => {
    uiStateStore.setState((state) => ({
      ...state,
      chatState: state.chatState === 'expanded' ? 'collapsed' : 'expanded'
    }))
  },

  setChatWidthMode: (mode: ChatWidthMode) => {
    uiStateStore.setState((state) => ({ ...state, chatWidthMode: mode }))
  },

  toggleChatWidthMode: () => {
    uiStateStore.setState((state) => ({
      ...state,
      chatWidthMode: state.chatWidthMode === 'normal' ? 'full' : 'normal'
    }))
  },

  // Canvas type actions
  setCanvasType: (canvasType: CanvasType) => {
    uiStateStore.setState((state) => ({ ...state, canvasType }))
  },

  // Canvas/Artifact actions (supports both Emery and standard LlamaIndex artifacts)
  openArtifact: (artifact: Artifact) => {
    uiStateStore.setState((state) => ({
      ...state,
      displayedArtifact: artifact
    }))
  },

  closeArtifact: () => {
    uiStateStore.setState((state) => ({
      ...state,
      displayedArtifact: null
    }))
  },

  updateArtifact: (artifact: Artifact) => {
    uiStateStore.setState((state) => ({
      ...state,
      displayedArtifact: artifact
    }))
  },

  // Context actions
  setChatContext: (context: ChatContextConfig | undefined) => {
    uiStateStore.setState((state) => ({ ...state, chatContext: context }))
  },

  // Dialog actions
  setCreateDatabaseOpen: (isOpen: boolean) => {
    uiStateStore.setState((state) => ({ ...state, isCreateDatabaseOpen: isOpen }))
  },

  setCreateTableOpen: (isOpen: boolean) => {
    uiStateStore.setState((state) => ({ ...state, isCreateTableOpen: isOpen }))
  },

  setSelectedDatabaseForTable: (databaseId?: number) => {
    uiStateStore.setState((state) => ({ ...state, selectedDatabaseForTable: databaseId }))
  },

  closeModal: (modal: keyof UIState['modals']) => {
    uiStateStore.setState((state) => ({
      ...state,
      modals: {
        ...state.modals,
        [modal]: false
      }
    }))
  },

  setTeamForm: (isOpen: boolean, editingTeam: number | null = null) => {
    uiStateStore.setState((state) => ({
      ...state,
      forms: {
        ...state.forms,
        teamForm: { isOpen, editingTeam }
      }
    }))
  },

  // Notification actions
  setShowResetNotification: (show: boolean) => {
    uiStateStore.setState((state) => ({
      ...state,
      notifications: {
        ...state.notifications,
        showResetNotification: show
      }
    }))
  },

  addToast: (toast: Omit<UIState['notifications']['toasts'][0], 'id' | 'timestamp'>) => {
    const newToast = {
      ...toast,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date()
    }

    uiStateStore.setState((state) => ({
      ...state,
      notifications: {
        ...state.notifications,
        toasts: [...state.notifications.toasts, newToast]
      }
    }))
  },

  removeToast: (id: string) => {
    uiStateStore.setState((state) => ({
      ...state,
      notifications: {
        ...state.notifications,
        toasts: state.notifications.toasts.filter(toast => toast.id !== id)
      }
    }))
  },

  // Reset UI state
  resetLayout: () => {
    uiStateStore.setState((state) => ({
      ...state,
      sidebarState: 'expanded',
      chatState: 'collapsed'
    }))
  },

  reset: () => {
    uiStateStore.setState(initialState)
  }
}

// Common selectors for UI state
export const uiStateSelectors = {
  // Layout selectors
  sidebarState: (state: UIState) => state.sidebarState,
  chatState: (state: UIState) => state.chatState,
  chatWidthMode: (state: UIState) => state.chatWidthMode,
  canvasType: (state: UIState) => state.canvasType,
  breakpoint: (state: UIState) => state.breakpoint,
  isMobile: (state: UIState) => state.isMobile,
  
  // Canvas/Artifact selectors
  displayedArtifact: (state: UIState) => state.displayedArtifact,

  // Context selectors
  chatContext: (state: UIState) => state.chatContext,
  
  // Dialog selectors
  isCreateDatabaseOpen: (state: UIState) => state.isCreateDatabaseOpen,
  isCreateTableOpen: (state: UIState) => state.isCreateTableOpen,
  selectedDatabaseForTable: (state: UIState) => state.selectedDatabaseForTable,
  
  // Collapsible selectors
  openCollapsibles: (state: UIState) => state.openCollapsibles,
  isCollapsibleOpen: (id: string) => (state: UIState) => 
    state.openCollapsibles.includes(id),
  
  // Panel selectors
  isPanelCollapsed: (panel: keyof UIState['isPanelCollapsed']) => (state: UIState) =>
    state.isPanelCollapsed[panel],
  
  // Search selectors
  isSearchExpanded: (section: keyof UIState['isSearchExpanded']) => (state: UIState) =>
    state.isSearchExpanded[section],
  
  // Modal selectors
  isModalOpen: (modal: keyof UIState['modals']) => (state: UIState) =>
    state.modals[modal],
  
  // Form selectors
  agentCreateForm: (state: UIState) => state.forms.agentCreate,
  teamForm: (state: UIState) => state.forms.teamForm,
  
  // Notification selectors
  showResetNotification: (state: UIState) => state.notifications.showResetNotification,
  toasts: (state: UIState) => state.notifications.toasts
}

// Cleanup function for persistence
export const cleanupUIStatePersistence = () => {
  if (persistenceCleanup) {
    persistenceCleanup()
    persistenceCleanup = null
  }
}

