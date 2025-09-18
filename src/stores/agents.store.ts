/**
 * Agents Management Store - Replaces AgentDashboardClient useState patterns
 * 
 * Centralizes all agent-related state including selection, filtering, creation mode,
 * and loading states. This store replaces the complex useState patterns in 
 * AgentDashboardClient with performant, type-safe state management.
 * 
 * AIDEV-NOTE: This replaces 8 useState calls in AgentDashboardClient and provides
 * fine-grained reactivity for agent management features.
 */

import { Store } from '@tanstack/react-store'
import type { AgentDTO } from '@/src/app/mappers/agent-mapper'

export interface AgentTask {
  id: string
  agentId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  instruction: string
  result?: any
  createdAt: Date
  completedAt?: Date
}

export interface AgentCapability {
  id: string
  name: string
  description: string
  enabled: boolean
  config?: Record<string, any>
}

export interface AgentsState {
  // Agent data
  agents: AgentDTO[]
  selectedAgent: AgentDTO | null
  
  // Filtering and search
  searchQuery: string
  selectedTeam: string
  statusFilter: 'all' | 'active' | 'inactive'
  sortBy: 'name' | 'created' | 'lastActive'
  sortOrder: 'asc' | 'desc'
  
  // UI state
  isPanelCollapsed: boolean
  isCreateMode: boolean
  isEditMode: boolean
  editingAgentId: string | null
  
  // Loading states
  loading: boolean
  refreshing: boolean
  error: string | null
  
  // Agent-specific data
  agentTasks: Record<string, AgentTask[]>
  agentCapabilities: Record<string, AgentCapability[]>
  
  // Bulk operations
  selectedAgentIds: number[]
  bulkOperationInProgress: boolean
  
  // Activity panel state
  activityPanelOpen: boolean
  selectedActivityType: 'tasks' | 'capabilities' | 'schedule'
  
  // Task form state
  taskFormOpen: boolean
  taskFormData: {
    instruction: string
    agentId: string | null
  }
  
  // Schedule state
  scheduleDialogOpen: boolean
  selectedSchedule: any | null
  
  // Capability management
  capabilityManagerOpen: boolean
  
  // Worker status tracking
  workerStatus: Record<string, {
    online: boolean
    lastSeen: Date | null
    capabilities: string[]
  }>
}

const initialState: AgentsState = {
  // Agent data
  agents: [],
  selectedAgent: null,
  
  // Filtering and search
  searchQuery: '',
  selectedTeam: 'all',
  statusFilter: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
  
  // UI state
  isPanelCollapsed: false,
  isCreateMode: false,
  isEditMode: false,
  editingAgentId: null,
  
  // Loading states
  loading: false,
  refreshing: false,
  error: null,
  
  // Agent-specific data
  agentTasks: {},
  agentCapabilities: {},
  
  // Bulk operations
  selectedAgentIds: [],
  bulkOperationInProgress: false,
  
  // Activity panel
  activityPanelOpen: false,
  selectedActivityType: 'tasks',
  
  // Task form
  taskFormOpen: false,
  taskFormData: {
    instruction: '',
    agentId: null
  },
  
  // Schedule
  scheduleDialogOpen: false,
  selectedSchedule: null,
  
  // Capability management
  capabilityManagerOpen: false,
  
  // Worker status
  workerStatus: {}
}

// Create the agents store
export const agentsStore = new Store(initialState)

// Store actions for agent management
export const agentsActions = {
  // Agent data actions
  setAgents: (agents: AgentDTO[]) => {
    agentsStore.setState((state) => ({
      ...state,
      agents,
      loading: false,
      refreshing: false,
      error: null
    }))
  },

  setSelectedAgent: (agent: AgentDTO | null) => {
    agentsStore.setState((state) => ({
      ...state,
      selectedAgent: agent,
      isCreateMode: false // Exit create mode when selecting an agent
    }))
  },

  addAgent: (agent: AgentDTO) => {
    agentsStore.setState((state) => ({
      ...state,
      agents: [...state.agents, agent]
    }))
  },

  updateAgent: (agentId: number, updates: Partial<AgentDTO>) => {
    agentsStore.setState((state) => ({
      ...state,
      agents: state.agents.map(agent => 
        agent.id === agentId ? { ...agent, ...updates } : agent
      ),
      selectedAgent: state.selectedAgent?.id === agentId 
        ? { ...state.selectedAgent, ...updates } 
        : state.selectedAgent
    }))
  },

  removeAgent: (agentId: number) => {
    agentsStore.setState((state) => ({
      ...state,
      agents: state.agents.filter(agent => agent.id !== agentId),
      selectedAgent: state.selectedAgent?.id === agentId ? null : state.selectedAgent
    }))
  },

  // Filter and search actions
  setSearchQuery: (searchQuery: string) => {
    agentsStore.setState((state) => ({ ...state, searchQuery }))
  },

  setSelectedTeam: (selectedTeam: string) => {
    agentsStore.setState((state) => ({ ...state, selectedTeam }))
  },

  setStatusFilter: (statusFilter: AgentsState['statusFilter']) => {
    agentsStore.setState((state) => ({ ...state, statusFilter }))
  },

  setSorting: (sortBy: AgentsState['sortBy'], sortOrder: AgentsState['sortOrder']) => {
    agentsStore.setState((state) => ({ ...state, sortBy, sortOrder }))
  },

  clearFilters: () => {
    agentsStore.setState((state) => ({
      ...state,
      searchQuery: '',
      selectedTeam: 'all',
      statusFilter: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    }))
  },

  // UI state actions
  setPanelCollapsed: (isPanelCollapsed: boolean) => {
    agentsStore.setState((state) => ({ ...state, isPanelCollapsed }))
  },

  togglePanelCollapsed: () => {
    agentsStore.setState((state) => ({ 
      ...state, 
      isPanelCollapsed: !state.isPanelCollapsed 
    }))
  },

  setCreateMode: (isCreateMode: boolean) => {
    agentsStore.setState((state) => ({
      ...state,
      isCreateMode,
      selectedAgent: isCreateMode ? null : state.selectedAgent,
      isEditMode: isCreateMode ? false : state.isEditMode
    }))
  },

  setEditMode: (isEditMode: boolean, agentId: string | null = null) => {
    agentsStore.setState((state) => ({
      ...state,
      isEditMode,
      editingAgentId: agentId,
      isCreateMode: isEditMode ? false : state.isCreateMode
    }))
  },

  // Loading state actions
  setLoading: (loading: boolean) => {
    agentsStore.setState((state) => ({
      ...state,
      loading,
      error: loading ? null : state.error
    }))
  },

  setRefreshing: (refreshing: boolean) => {
    agentsStore.setState((state) => ({ ...state, refreshing }))
  },

  setError: (error: string | null) => {
    agentsStore.setState((state) => ({
      ...state,
      error,
      loading: false,
      refreshing: false
    }))
  },

  // Task management actions
  setAgentTasks: (agentId: string, tasks: AgentTask[]) => {
    agentsStore.setState((state) => ({
      ...state,
      agentTasks: {
        ...state.agentTasks,
        [agentId]: tasks
      }
    }))
  },

  addTask: (task: AgentTask) => {
    agentsStore.setState((state) => ({
      ...state,
      agentTasks: {
        ...state.agentTasks,
        [task.agentId]: [...(state.agentTasks[task.agentId] || []), task]
      }
    }))
  },

  updateTask: (taskId: string, updates: Partial<AgentTask>) => {
    agentsStore.setState((state) => {
      const newAgentTasks = { ...state.agentTasks }
      
      Object.keys(newAgentTasks).forEach(agentId => {
        newAgentTasks[agentId] = newAgentTasks[agentId].map(task =>
          task.id === taskId ? { ...task, ...updates } : task
        )
      })

      return { ...state, agentTasks: newAgentTasks }
    })
  },

  // Capability management actions
  setAgentCapabilities: (agentId: string, capabilities: AgentCapability[]) => {
    agentsStore.setState((state) => ({
      ...state,
      agentCapabilities: {
        ...state.agentCapabilities,
        [agentId]: capabilities
      }
    }))
  },

  updateCapability: (agentId: string, capabilityId: string, updates: Partial<AgentCapability>) => {
    agentsStore.setState((state) => ({
      ...state,
      agentCapabilities: {
        ...state.agentCapabilities,
        [agentId]: (state.agentCapabilities[agentId] || []).map(cap =>
          cap.id === capabilityId ? { ...cap, ...updates } : cap
        )
      }
    }))
  },

  // Bulk operations
  setSelectedAgentIds: (agentIds: number[]) => {
    agentsStore.setState((state) => ({ ...state, selectedAgentIds: agentIds }))
  },

  toggleAgentSelection: (agentId: number) => {
    agentsStore.setState((state) => ({
      ...state,
      selectedAgentIds: state.selectedAgentIds.includes(agentId)
        ? state.selectedAgentIds.filter(id => id !== agentId)
        : [...state.selectedAgentIds, agentId]
    }))
  },

  setBulkOperationInProgress: (inProgress: boolean) => {
    agentsStore.setState((state) => ({ ...state, bulkOperationInProgress: inProgress }))
  },

  // Panel actions
  setActivityPanelOpen: (open: boolean) => {
    agentsStore.setState((state) => ({ ...state, activityPanelOpen: open }))
  },

  setSelectedActivityType: (type: AgentsState['selectedActivityType']) => {
    agentsStore.setState((state) => ({ ...state, selectedActivityType: type }))
  },

  setTaskFormOpen: (open: boolean) => {
    agentsStore.setState((state) => ({ ...state, taskFormOpen: open }))
  },

  setTaskFormData: (data: Partial<AgentsState['taskFormData']>) => {
    agentsStore.setState((state) => ({
      ...state,
      taskFormData: { ...state.taskFormData, ...data }
    }))
  },

  setScheduleDialogOpen: (open: boolean) => {
    agentsStore.setState((state) => ({ ...state, scheduleDialogOpen: open }))
  },

  setSelectedSchedule: (schedule: any | null) => {
    agentsStore.setState((state) => ({ ...state, selectedSchedule: schedule }))
  },

  setCapabilityManagerOpen: (open: boolean) => {
    agentsStore.setState((state) => ({ ...state, capabilityManagerOpen: open }))
  },

  // Worker status actions
  setWorkerStatus: (agentId: string, status: AgentsState['workerStatus'][string]) => {
    agentsStore.setState((state) => ({
      ...state,
      workerStatus: {
        ...state.workerStatus,
        [agentId]: status
      }
    }))
  },

  // Reset actions
  reset: () => {
    agentsStore.setState(initialState)
  },

  resetFilters: () => {
    agentsStore.setState((state) => ({
      ...state,
      searchQuery: '',
      selectedTeam: 'all',
      statusFilter: 'all'
    }))
  }
}

// Common selectors for agent state
export const agentsSelectors = {
  // Data selectors
  agents: (state: AgentsState) => state.agents,
  selectedAgent: (state: AgentsState) => state.selectedAgent,
  getAgentById: (agentId: number) => (state: AgentsState) => 
    state.agents.find(agent => agent.id === agentId),
  
  // Filtered data selectors
  filteredAgents: (teams: Array<{id: number, agentIds?: string[] | null}> = []) => (state: AgentsState) => {
    let filtered = state.agents

    // Apply search filter
    if (state.searchQuery) {
      filtered = filtered.filter(agent => 
        agent.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        agent.description?.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    }

    // Apply team filter
    if (state.selectedTeam !== 'all') {
      const team = teams.find(t => t.id.toString() === state.selectedTeam)
      if (team?.agentIds) {
        filtered = filtered.filter(agent => team.agentIds?.includes(agent.id.toString()))
      }
    }

    // Apply status filter
    if (state.statusFilter !== 'all') {
      filtered = filtered.filter(agent => agent.status === state.statusFilter)
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
        case 'lastActive':
          compareResult = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime()
          break
      }

      return state.sortOrder === 'asc' ? compareResult : -compareResult
    })

    return filtered
  },

  // Filter selectors
  searchQuery: (state: AgentsState) => state.searchQuery,
  selectedTeam: (state: AgentsState) => state.selectedTeam,
  statusFilter: (state: AgentsState) => state.statusFilter,
  sortBy: (state: AgentsState) => state.sortBy,
  sortOrder: (state: AgentsState) => state.sortOrder,

  // UI state selectors
  isPanelCollapsed: (state: AgentsState) => state.isPanelCollapsed,
  isCreateMode: (state: AgentsState) => state.isCreateMode,
  isEditMode: (state: AgentsState) => state.isEditMode,
  editingAgentId: (state: AgentsState) => state.editingAgentId,

  // Loading selectors
  loading: (state: AgentsState) => state.loading,
  refreshing: (state: AgentsState) => state.refreshing,
  error: (state: AgentsState) => state.error,
  hasError: (state: AgentsState) => !!state.error,

  // Task selectors
  agentTasks: (agentId: string) => (state: AgentsState) => 
    state.agentTasks[agentId] || [],
  allTasks: (state: AgentsState) => 
    Object.values(state.agentTasks).flat(),
  taskCount: (agentId: string) => (state: AgentsState) => 
    (state.agentTasks[agentId] || []).length,

  // Capability selectors
  agentCapabilities: (agentId: string) => (state: AgentsState) => 
    state.agentCapabilities[agentId] || [],
  
  // Bulk operation selectors
  selectedAgentIds: (state: AgentsState) => state.selectedAgentIds,
  selectedAgents: (state: AgentsState) => 
    state.agents.filter(agent => state.selectedAgentIds.includes(agent.id)),
  bulkOperationInProgress: (state: AgentsState) => state.bulkOperationInProgress,

  // Panel selectors
  activityPanelOpen: (state: AgentsState) => state.activityPanelOpen,
  selectedActivityType: (state: AgentsState) => state.selectedActivityType,
  taskFormOpen: (state: AgentsState) => state.taskFormOpen,
  taskFormData: (state: AgentsState) => state.taskFormData,
  scheduleDialogOpen: (state: AgentsState) => state.scheduleDialogOpen,
  selectedSchedule: (state: AgentsState) => state.selectedSchedule,
  capabilityManagerOpen: (state: AgentsState) => state.capabilityManagerOpen,

  // Worker status selectors
  workerStatus: (agentId: string) => (state: AgentsState) => 
    state.workerStatus[agentId],
  isWorkerOnline: (agentId: string) => (state: AgentsState) => 
    state.workerStatus[agentId]?.online || false
}

