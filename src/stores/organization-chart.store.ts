/**
 * Organization Chart Store - Replaces OrganizationChartClient useState patterns
 * 
 * Centralizes all organization chart-related state including tasks, node selection,
 * search, configuration, and view management. This store replaces the complex 
 * useState patterns in OrganizationChartClient with performant state management.
 * 
 * AIDEV-NOTE: This replaces 9 useState calls in OrganizationChartClient and provides
 * fine-grained reactivity for organization visualization and management features.
 */

import { Store } from '@tanstack/react-store'

// Import the proper task type from our mapper
import type { TaskDTO } from '@/app/mappers/task-mapper'

// Use TaskDTO as Task for organization chart store
export type Task = TaskDTO

export interface NodePosition {
  x: number
  y: number
}

export interface ChartNode {
  id: string
  type: 'agent' | 'team' | 'organization' | 'task'
  label: string
  position: NodePosition
  data: any
  selected: boolean
  highlighted: boolean
  collapsed: boolean
}

export interface ChartEdge {
  id: string
  source: string
  target: string
  type: 'assignment' | 'dependency' | 'hierarchy' | 'collaboration'
  label?: string
  animated: boolean
}

export interface ViewConfig {
  layout: 'hierarchical' | 'force' | 'grid' | 'circular'
  direction: 'TB' | 'BT' | 'LR' | 'RL'
  spacing: {
    node: number
    rank: number
  }
  showLabels: boolean
  showEdgeLabels: boolean
  nodeSize: 'small' | 'medium' | 'large'
  colorScheme: 'default' | 'status' | 'type' | 'priority'
  animations: boolean
  minimap: boolean
  grid: boolean
  zoom: number
  center: NodePosition
}

export interface OrgChartState {
  // Task data
  tasks: Task[]
  isTasksLoading: boolean
  tasksError: string | null
  
  // Chart data
  nodes: ChartNode[]
  edges: ChartEdge[]
  
  // Client-side rendering flag
  isClient: boolean
  
  // Selection and interaction
  selectedNodes: string[]
  hoveredNodeId: string | null
  
  // Configuration mode
  isConfiguring: boolean
  
  // Search functionality
  searchTerm: string
  searchResults: string[]
  isSearchExpanded: boolean
  searchFilter: {
    type: 'all' | 'agents' | 'teams' | 'tasks'
    status: 'all' | 'active' | 'completed' | 'pending'
    priority: 'all' | 'low' | 'medium' | 'high' | 'urgent'
  }
  
  // Panel management
  isPanelCollapsed: boolean
  activePanel: 'overview' | 'tasks' | 'agents' | 'teams' | 'settings'
  
  // Notifications
  showResetNotification: boolean
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    timestamp: Date
    dismissed: boolean
  }>
  
  // View configuration
  viewConfig: ViewConfig
  
  // Performance and optimization
  virtualization: {
    enabled: boolean
    viewportNodes: string[]
    renderDistance: number
  }
  
  // Filtering and grouping
  filters: {
    showAgents: boolean
    showTeams: boolean
    showTasks: boolean
    showCompleted: boolean
    showInactive: boolean
  }
  
  groupBy: 'none' | 'type' | 'status' | 'priority' | 'assignee'
  
  // History and undo/redo
  history: Array<{
    action: string
    data: any
    timestamp: Date
  }>
  canUndo: boolean
  canRedo: boolean
  
  // Export and sharing
  exportInProgress: boolean
  exportFormat: 'png' | 'svg' | 'json' | 'pdf'
  
  // Real-time updates
  subscribeToUpdates: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  
  // Analytics
  analytics: {
    totalNodes: number
    totalEdges: number
    averageConnections: number
    taskCompletionRate: number
    mostConnectedNode: string | null
  }
}

const initialViewConfig: ViewConfig = {
  layout: 'hierarchical',
  direction: 'TB',
  spacing: {
    node: 100,
    rank: 150
  },
  showLabels: true,
  showEdgeLabels: false,
  nodeSize: 'medium',
  colorScheme: 'default',
  animations: true,
  minimap: true,
  grid: true,
  zoom: 1,
  center: { x: 0, y: 0 }
}

const initialState: OrgChartState = {
  // Task data
  tasks: [],
  isTasksLoading: true,
  tasksError: null,
  
  // Chart data
  nodes: [],
  edges: [],
  
  // Client state
  isClient: false,
  
  // Selection
  selectedNodes: [],
  hoveredNodeId: null,
  
  // Configuration
  isConfiguring: false,
  
  // Search
  searchTerm: '',
  searchResults: [],
  isSearchExpanded: false,
  searchFilter: {
    type: 'all',
    status: 'all',
    priority: 'all'
  },
  
  // Panel
  isPanelCollapsed: false,
  activePanel: 'overview',
  
  // Notifications
  showResetNotification: false,
  notifications: [],
  
  // View config
  viewConfig: initialViewConfig,
  
  // Virtualization
  virtualization: {
    enabled: false,
    viewportNodes: [],
    renderDistance: 2
  },
  
  // Filters
  filters: {
    showAgents: true,
    showTeams: true,
    showTasks: true,
    showCompleted: true,
    showInactive: false
  },
  
  groupBy: 'none',
  
  // History
  history: [],
  canUndo: false,
  canRedo: false,
  
  // Export
  exportInProgress: false,
  exportFormat: 'png',
  
  // Real-time
  subscribeToUpdates: true,
  connectionStatus: 'connected',
  
  // Analytics
  analytics: {
    totalNodes: 0,
    totalEdges: 0,
    averageConnections: 0,
    taskCompletionRate: 0,
    mostConnectedNode: null
  }
}

// Create the organization chart store
export const orgChartStore = new Store(initialState)

// Store actions for organization chart management
export const orgChartActions = {
  // Task actions
  setTasks: (tasks: Task[]) => {
    orgChartStore.setState((state) => ({
      ...state,
      tasks,
      isTasksLoading: false,
      tasksError: null
    }))
  },

  setTasksLoading: (loading: boolean) => {
    orgChartStore.setState((state) => ({ 
      ...state, 
      isTasksLoading: loading,
      tasksError: loading ? null : state.tasksError
    }))
  },

  setTasksError: (error: string | null) => {
    orgChartStore.setState((state) => ({
      ...state,
      tasksError: error,
      isTasksLoading: false
    }))
  },

  addTask: (task: Task) => {
    orgChartStore.setState((state) => ({
      ...state,
      tasks: [...state.tasks, task]
    }))
  },

  updateTask: (taskId: string, updates: Partial<Task>) => {
    orgChartStore.setState((state) => ({
      ...state,
      tasks: state.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates, updatedAt: new Date() } : task
      )
    }))
  },

  removeTask: (taskId: string) => {
    orgChartStore.setState((state) => ({
      ...state,
      tasks: state.tasks.filter(task => task.id !== taskId)
    }))
  },

  // Chart data actions
  setNodes: (nodes: ChartNode[]) => {
    orgChartStore.setState((state) => ({
      ...state,
      nodes,
      analytics: {
        ...state.analytics,
        totalNodes: nodes.length
      }
    }))
  },

  setEdges: (edges: ChartEdge[]) => {
    orgChartStore.setState((state) => ({
      ...state,
      edges,
      analytics: {
        ...state.analytics,
        totalEdges: edges.length
      }
    }))
  },

  updateNode: (nodeId: string, updates: Partial<ChartNode>) => {
    orgChartStore.setState((state) => ({
      ...state,
      nodes: state.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      )
    }))
  },

  updateNodePosition: (nodeId: string, position: NodePosition) => {
    orgChartActions.updateNode(nodeId, { position })
  },

  // Client state
  setIsClient: (isClient: boolean) => {
    orgChartStore.setState((state) => ({ ...state, isClient }))
  },

  // Selection actions
  setSelectedNodes: (nodeIds: string[]) => {
    orgChartStore.setState((state) => ({ ...state, selectedNodes: nodeIds }))
  },

  toggleNodeSelection: (nodeId: string) => {
    orgChartStore.setState((state) => ({
      ...state,
      selectedNodes: state.selectedNodes.includes(nodeId)
        ? state.selectedNodes.filter(id => id !== nodeId)
        : [...state.selectedNodes, nodeId]
    }))
  },

  selectAllNodes: () => {
    orgChartStore.setState((state) => ({
      ...state,
      selectedNodes: state.nodes.map(node => node.id)
    }))
  },

  clearSelection: () => {
    orgChartStore.setState((state) => ({ ...state, selectedNodes: [] }))
  },

  setHoveredNode: (nodeId: string | null) => {
    orgChartStore.setState((state) => ({ ...state, hoveredNodeId: nodeId }))
  },

  // Configuration actions
  setConfiguring: (isConfiguring: boolean) => {
    orgChartStore.setState((state) => ({ ...state, isConfiguring }))
  },

  toggleConfiguring: () => {
    orgChartStore.setState((state) => ({ 
      ...state, 
      isConfiguring: !state.isConfiguring 
    }))
  },

  // Search actions
  setSearchTerm: (searchTerm: string) => {
    orgChartStore.setState((state) => ({ ...state, searchTerm }))
  },

  setSearchResults: (results: string[]) => {
    orgChartStore.setState((state) => ({ ...state, searchResults: results }))
  },

  setSearchExpanded: (expanded: boolean) => {
    orgChartStore.setState((state) => ({ ...state, isSearchExpanded: expanded }))
  },

  toggleSearchExpanded: () => {
    orgChartStore.setState((state) => ({ 
      ...state, 
      isSearchExpanded: !state.isSearchExpanded 
    }))
  },

  setSearchFilter: (filter: Partial<OrgChartState['searchFilter']>) => {
    orgChartStore.setState((state) => ({
      ...state,
      searchFilter: { ...state.searchFilter, ...filter }
    }))
  },

  clearSearch: () => {
    orgChartStore.setState((state) => ({
      ...state,
      searchTerm: '',
      searchResults: [],
      isSearchExpanded: false
    }))
  },

  // Panel actions
  setPanelCollapsed: (collapsed: boolean) => {
    orgChartStore.setState((state) => ({ ...state, isPanelCollapsed: collapsed }))
  },

  togglePanelCollapsed: () => {
    orgChartStore.setState((state) => ({ 
      ...state, 
      isPanelCollapsed: !state.isPanelCollapsed 
    }))
  },

  setActivePanel: (panel: OrgChartState['activePanel']) => {
    orgChartStore.setState((state) => ({ ...state, activePanel: panel }))
  },

  // Notification actions
  setShowResetNotification: (show: boolean) => {
    orgChartStore.setState((state) => ({ ...state, showResetNotification: show }))
  },

  addNotification: (notification: Omit<OrgChartState['notifications'][0], 'id' | 'timestamp' | 'dismissed'>) => {
    const newNotification = {
      ...notification,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      dismissed: false
    }

    orgChartStore.setState((state) => ({
      ...state,
      notifications: [newNotification, ...state.notifications]
    }))
  },

  dismissNotification: (notificationId: string) => {
    orgChartStore.setState((state) => ({
      ...state,
      notifications: state.notifications.map(n =>
        n.id === notificationId ? { ...n, dismissed: true } : n
      )
    }))
  },

  removeNotification: (notificationId: string) => {
    orgChartStore.setState((state) => ({
      ...state,
      notifications: state.notifications.filter(n => n.id !== notificationId)
    }))
  },

  clearNotifications: () => {
    orgChartStore.setState((state) => ({ ...state, notifications: [] }))
  },

  // View configuration actions
  setViewConfig: (config: Partial<ViewConfig>) => {
    orgChartStore.setState((state) => ({
      ...state,
      viewConfig: { ...state.viewConfig, ...config }
    }))
  },

  setLayout: (layout: ViewConfig['layout']) => {
    orgChartActions.setViewConfig({ layout })
  },

  setZoom: (zoom: number) => {
    orgChartActions.setViewConfig({ zoom })
  },

  setCenter: (center: NodePosition) => {
    orgChartActions.setViewConfig({ center })
  },

  resetViewConfig: () => {
    orgChartStore.setState((state) => ({
      ...state,
      viewConfig: initialViewConfig
    }))
  },

  // Filter actions
  setFilters: (filters: Partial<OrgChartState['filters']>) => {
    orgChartStore.setState((state) => ({
      ...state,
      filters: { ...state.filters, ...filters }
    }))
  },

  toggleFilter: (filterKey: keyof OrgChartState['filters']) => {
    orgChartStore.setState((state) => ({
      ...state,
      filters: {
        ...state.filters,
        [filterKey]: !state.filters[filterKey]
      }
    }))
  },

  setGroupBy: (groupBy: OrgChartState['groupBy']) => {
    orgChartStore.setState((state) => ({ ...state, groupBy }))
  },

  // History actions
  addToHistory: (action: string, data: any) => {
    const historyItem = {
      action,
      data,
      timestamp: new Date()
    }

    orgChartStore.setState((state) => ({
      ...state,
      history: [historyItem, ...state.history.slice(0, 49)], // Keep last 50 actions
      canUndo: true
    }))
  },

  clearHistory: () => {
    orgChartStore.setState((state) => ({
      ...state,
      history: [],
      canUndo: false,
      canRedo: false
    }))
  },

  // Export actions
  setExportInProgress: (inProgress: boolean) => {
    orgChartStore.setState((state) => ({ ...state, exportInProgress: inProgress }))
  },

  setExportFormat: (format: OrgChartState['exportFormat']) => {
    orgChartStore.setState((state) => ({ ...state, exportFormat: format }))
  },

  // Real-time actions
  setSubscribeToUpdates: (subscribe: boolean) => {
    orgChartStore.setState((state) => ({ ...state, subscribeToUpdates: subscribe }))
  },

  setConnectionStatus: (status: OrgChartState['connectionStatus']) => {
    orgChartStore.setState((state) => ({ ...state, connectionStatus: status }))
  },

  // Analytics actions
  updateAnalytics: (analytics: Partial<OrgChartState['analytics']>) => {
    orgChartStore.setState((state) => ({
      ...state,
      analytics: { ...state.analytics, ...analytics }
    }))
  },

  recalculateAnalytics: () => {
    const state = orgChartStore.state
    
    // Calculate task completion rate
    const completedTasks = state.tasks.filter(task => task.status === 'completed').length
    const taskCompletionRate = state.tasks.length > 0 
      ? (completedTasks / state.tasks.length) * 100 
      : 0

    // Calculate average connections
    const connectionCounts = state.nodes.map(node => 
      state.edges.filter(edge => edge.source === node.id || edge.target === node.id).length
    )
    const averageConnections = connectionCounts.length > 0
      ? connectionCounts.reduce((sum, count) => sum + count, 0) / connectionCounts.length
      : 0

    // Find most connected node
    const mostConnectedNode = state.nodes.reduce((max, node) => {
      const connections = state.edges.filter(edge => 
        edge.source === node.id || edge.target === node.id
      ).length
      const maxConnections = state.edges.filter(edge => 
        edge.source === max.id || edge.target === max.id
      ).length
      return connections > maxConnections ? node : max
    }, state.nodes[0])

    orgChartActions.updateAnalytics({
      taskCompletionRate,
      averageConnections,
      mostConnectedNode: mostConnectedNode?.id || null
    })
  },

  // Reset actions
  reset: () => {
    orgChartStore.setState(initialState)
  }
}

// Common selectors for organization chart state
export const orgChartSelectors = {
  // Task selectors
  tasks: (state: OrgChartState) => state.tasks,
  isTasksLoading: (state: OrgChartState) => state.isTasksLoading,
  tasksError: (state: OrgChartState) => state.tasksError,
  tasksByStatus: (status: Task['status']) => (state: OrgChartState) =>
    state.tasks.filter(task => task.status === status),
  // Note: Priority field not available in TaskDTO
  // tasksByPriority selector removed until priority is added to TaskDTO

  // Chart data selectors
  nodes: (state: OrgChartState) => state.nodes,
  edges: (state: OrgChartState) => state.edges,
  filteredNodes: (state: OrgChartState) => {
    return state.nodes.filter(node => {
      if (!state.filters.showAgents && node.type === 'agent') return false
      if (!state.filters.showTeams && node.type === 'team') return false
      if (!state.filters.showTasks && node.type === 'task') return false
      return true
    })
  },

  // Client state
  isClient: (state: OrgChartState) => state.isClient,

  // Selection selectors
  selectedNodes: (state: OrgChartState) => state.selectedNodes,
  selectedNodeObjects: (state: OrgChartState) =>
    state.nodes.filter(node => state.selectedNodes.includes(node.id)),
  hasSelection: (state: OrgChartState) => state.selectedNodes.length > 0,
  hoveredNodeId: (state: OrgChartState) => state.hoveredNodeId,

  // Configuration selectors
  isConfiguring: (state: OrgChartState) => state.isConfiguring,

  // Search selectors
  searchTerm: (state: OrgChartState) => state.searchTerm,
  searchResults: (state: OrgChartState) => state.searchResults,
  isSearchExpanded: (state: OrgChartState) => state.isSearchExpanded,
  hasSearchResults: (state: OrgChartState) => state.searchResults.length > 0,
  searchFilter: (state: OrgChartState) => state.searchFilter,

  // Panel selectors
  isPanelCollapsed: (state: OrgChartState) => state.isPanelCollapsed,
  activePanel: (state: OrgChartState) => state.activePanel,

  // Notification selectors
  showResetNotification: (state: OrgChartState) => state.showResetNotification,
  notifications: (state: OrgChartState) => state.notifications,
  activeNotifications: (state: OrgChartState) =>
    state.notifications.filter(n => !n.dismissed),
  hasNotifications: (state: OrgChartState) =>
    state.notifications.some(n => !n.dismissed),

  // View config selectors
  viewConfig: (state: OrgChartState) => state.viewConfig,
  layout: (state: OrgChartState) => state.viewConfig.layout,
  zoom: (state: OrgChartState) => state.viewConfig.zoom,

  // Filter selectors
  filters: (state: OrgChartState) => state.filters,
  groupBy: (state: OrgChartState) => state.groupBy,

  // History selectors
  canUndo: (state: OrgChartState) => state.canUndo,
  canRedo: (state: OrgChartState) => state.canRedo,
  history: (state: OrgChartState) => state.history,

  // Export selectors
  exportInProgress: (state: OrgChartState) => state.exportInProgress,
  exportFormat: (state: OrgChartState) => state.exportFormat,

  // Real-time selectors
  subscribeToUpdates: (state: OrgChartState) => state.subscribeToUpdates,
  connectionStatus: (state: OrgChartState) => state.connectionStatus,
  isConnected: (state: OrgChartState) => state.connectionStatus === 'connected',

  // Analytics selectors
  analytics: (state: OrgChartState) => state.analytics,
  totalNodes: (state: OrgChartState) => state.analytics.totalNodes,
  totalEdges: (state: OrgChartState) => state.analytics.totalEdges,
  taskCompletionRate: (state: OrgChartState) => state.analytics.taskCompletionRate
}

