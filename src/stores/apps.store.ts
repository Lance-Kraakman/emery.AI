/**
 * Apps Management Store - Puck CMS Apps Management
 *
 * Centralizes all app-related state including selection, filtering, creation mode,
 * and loading states for the Puck visual page builder apps.
 *
 * AIDEV-NOTE: Simplified compared to agents store - apps don't have tasks,
 * capabilities, or worker status. Focused on CRUD operations and page management.
 */

import { Store } from '@tanstack/react-store'
import type { AppDTO } from '@/app/mappers/puck-app-mapper'
import type { PageDTO } from '@/app/mappers/puck-page-mapper'

export interface AppsState {
  // App data
  apps: AppDTO[]
  selectedApp: AppDTO | null

  // Pages for selected app
  pages: PageDTO[]
  selectedPage: PageDTO | null

  // Filtering and search
  searchQuery: string
  sortBy: 'name' | 'created' | 'updated'
  sortOrder: 'asc' | 'desc'

  // UI state
  isPanelCollapsed: boolean
  isCreateMode: boolean
  isEditMode: boolean
  editingAppId: number | null

  // Loading states
  loading: boolean
  loadingPages: boolean
  error: string | null

  // Form dialog states
  formDialogOpen: boolean
  pageFormDialogOpen: boolean
}

const initialState: AppsState = {
  // App data
  apps: [],
  selectedApp: null,

  // Pages
  pages: [],
  selectedPage: null,

  // Filtering and search
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',

  // UI state
  isPanelCollapsed: false,
  isCreateMode: false,
  isEditMode: false,
  editingAppId: null,

  // Loading states
  loading: false,
  loadingPages: false,
  error: null,

  // Form dialogs
  formDialogOpen: false,
  pageFormDialogOpen: false,
}

// Create the apps store
export const appsStore = new Store(initialState)

// Store actions for app management
export const appsActions = {
  // App data actions
  setApps: (apps: AppDTO[]) => {
    appsStore.setState((state) => ({
      ...state,
      apps,
      loading: false,
      error: null
    }))
  },

  setSelectedApp: (app: AppDTO | null) => {
    appsStore.setState((state) => ({
      ...state,
      selectedApp: app,
      isCreateMode: false, // Exit create mode when selecting an app
      selectedPage: null, // Clear page selection when changing apps
    }))
  },

  addApp: (app: AppDTO) => {
    appsStore.setState((state) => ({
      ...state,
      apps: [...state.apps, app],
      selectedApp: app, // Auto-select newly created app
      isCreateMode: false,
      formDialogOpen: false
    }))
  },

  updateApp: (appId: number, updates: Partial<AppDTO>) => {
    appsStore.setState((state) => ({
      ...state,
      apps: state.apps.map(app =>
        app.id === appId ? { ...app, ...updates } : app
      ),
      selectedApp: state.selectedApp?.id === appId
        ? { ...state.selectedApp, ...updates }
        : state.selectedApp,
      formDialogOpen: false
    }))
  },

  removeApp: (appId: number) => {
    appsStore.setState((state) => ({
      ...state,
      apps: state.apps.filter(app => app.id !== appId),
      selectedApp: state.selectedApp?.id === appId ? null : state.selectedApp,
      pages: state.selectedApp?.id === appId ? [] : state.pages
    }))
  },

  // Page data actions
  setPages: (pages: PageDTO[]) => {
    appsStore.setState((state) => ({
      ...state,
      pages,
      loadingPages: false
    }))
  },

  setSelectedPage: (page: PageDTO | null) => {
    appsStore.setState((state) => ({
      ...state,
      selectedPage: page
    }))
  },

  addPage: (page: PageDTO) => {
    appsStore.setState((state) => ({
      ...state,
      pages: [...state.pages, page],
      pageFormDialogOpen: false
    }))
  },

  updatePage: (pageId: number, updates: Partial<PageDTO>) => {
    appsStore.setState((state) => ({
      ...state,
      pages: state.pages.map(page =>
        page.id === pageId ? { ...page, ...updates } : page
      ),
      selectedPage: state.selectedPage?.id === pageId
        ? { ...state.selectedPage, ...updates }
        : state.selectedPage
    }))
  },

  removePage: (pageId: number) => {
    appsStore.setState((state) => ({
      ...state,
      pages: state.pages.filter(page => page.id !== pageId),
      selectedPage: state.selectedPage?.id === pageId ? null : state.selectedPage
    }))
  },

  // Filter and search actions
  setSearchQuery: (searchQuery: string) => {
    appsStore.setState((state) => ({ ...state, searchQuery }))
  },

  setSorting: (sortBy: AppsState['sortBy'], sortOrder: AppsState['sortOrder']) => {
    appsStore.setState((state) => ({ ...state, sortBy, sortOrder }))
  },

  clearFilters: () => {
    appsStore.setState((state) => ({
      ...state,
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc'
    }))
  },

  // UI state actions
  setPanelCollapsed: (isPanelCollapsed: boolean) => {
    appsStore.setState((state) => ({ ...state, isPanelCollapsed }))
  },

  togglePanelCollapsed: () => {
    appsStore.setState((state) => ({
      ...state,
      isPanelCollapsed: !state.isPanelCollapsed
    }))
  },

  setCreateMode: (isCreateMode: boolean) => {
    appsStore.setState((state) => ({
      ...state,
      isCreateMode,
      selectedApp: isCreateMode ? null : state.selectedApp,
      isEditMode: isCreateMode ? false : state.isEditMode,
      formDialogOpen: isCreateMode
    }))
  },

  setEditMode: (isEditMode: boolean, appId: number | null = null) => {
    appsStore.setState((state) => ({
      ...state,
      isEditMode,
      editingAppId: appId,
      isCreateMode: isEditMode ? false : state.isCreateMode,
      formDialogOpen: isEditMode
    }))
  },

  // Loading state actions
  setLoading: (loading: boolean) => {
    appsStore.setState((state) => ({
      ...state,
      loading,
      error: loading ? null : state.error
    }))
  },

  setLoadingPages: (loadingPages: boolean) => {
    appsStore.setState((state) => ({ ...state, loadingPages }))
  },

  setError: (error: string | null) => {
    appsStore.setState((state) => ({
      ...state,
      error,
      loading: false,
      loadingPages: false
    }))
  },

  // Dialog actions
  setFormDialogOpen: (open: boolean) => {
    appsStore.setState((state) => ({
      ...state,
      formDialogOpen: open,
      isEditMode: open ? state.isEditMode : false,
      isCreateMode: open ? state.isCreateMode : false
    }))
  },

  setPageFormDialogOpen: (open: boolean) => {
    appsStore.setState((state) => ({
      ...state,
      pageFormDialogOpen: open
    }))
  },

  // Reset actions
  reset: () => {
    appsStore.setState(initialState)
  },

  resetFilters: () => {
    appsStore.setState((state) => ({
      ...state,
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc'
    }))
  }
}

// Common selectors for app state
export const appsSelectors = {
  // Data selectors
  apps: (state: AppsState) => state.apps,
  selectedApp: (state: AppsState) => state.selectedApp,
  pages: (state: AppsState) => state.pages,
  selectedPage: (state: AppsState) => state.selectedPage,
  getAppById: (appId: number) => (state: AppsState) =>
    state.apps.find(app => app.id === appId),

  // Filtered data selectors
  filteredApps: (state: AppsState) => {
    let filtered = state.apps

    // Apply search filter
    if (state.searchQuery) {
      filtered = filtered.filter(app =>
        app.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        app.slug.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let compareResult = 0

      switch (state.sortBy) {
        case 'name':
          compareResult = a.name.localeCompare(b.name)
          break
        case 'created':
          compareResult = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
          break
        case 'updated':
          compareResult = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime()
          break
      }

      return state.sortOrder === 'asc' ? compareResult : -compareResult
    })

    return filtered
  },

  // Sorted pages (by order field)
  sortedPages: (state: AppsState) => {
    return [...state.pages].sort((a, b) => a.order - b.order)
  },

  // Filter selectors
  searchQuery: (state: AppsState) => state.searchQuery,
  sortBy: (state: AppsState) => state.sortBy,
  sortOrder: (state: AppsState) => state.sortOrder,

  // UI state selectors
  isPanelCollapsed: (state: AppsState) => state.isPanelCollapsed,
  isCreateMode: (state: AppsState) => state.isCreateMode,
  isEditMode: (state: AppsState) => state.isEditMode,
  editingAppId: (state: AppsState) => state.editingAppId,

  // Loading selectors
  loading: (state: AppsState) => state.loading,
  loadingPages: (state: AppsState) => state.loadingPages,
  error: (state: AppsState) => state.error,
  hasError: (state: AppsState) => !!state.error,

  // Dialog selectors
  formDialogOpen: (state: AppsState) => state.formDialogOpen,
  pageFormDialogOpen: (state: AppsState) => state.pageFormDialogOpen,

  // Computed selectors
  appCount: (state: AppsState) => state.apps.length,
  pageCount: (state: AppsState) => state.pages.length,
  hasApps: (state: AppsState) => state.apps.length > 0,
  hasPages: (state: AppsState) => state.pages.length > 0,
}
