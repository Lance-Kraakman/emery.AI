/**
 * Teams Management Store - Replaces TeamDashboardClient useState patterns
 * 
 * Centralizes all team-related state including selection, filtering, creation,
 * editing, and member management. This store replaces the complex useState 
 * patterns in TeamDashboardClient with performant, type-safe state management.
 * 
 * AIDEV-NOTE: This replaces 7 useState calls in TeamDashboardClient and provides
 * fine-grained reactivity for team management features.
 */

import { Store } from '@tanstack/react-store'
import type { TeamDTO } from '@/app/mappers/team-mapper'
import type { AgentDTO } from '@/app/mappers/agent-mapper'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: Date
}

export interface TeamActivity {
  id: string
  type: 'member_added' | 'member_removed' | 'agent_assigned' | 'agent_unassigned' | 'team_updated'
  description: string
  performedBy: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface TeamsState {
  // Team data
  teams: TeamDTO[]
  selectedTeam: TeamDTO | null
  
  // Filtering and search
  searchQuery: string
  sortBy: 'name' | 'created' | 'memberCount' | 'agentCount'
  sortOrder: 'asc' | 'desc'
  statusFilter: 'all' | 'active' | 'inactive'
  
  // UI state
  isPanelCollapsed: boolean
  isFormDialogOpen: boolean
  editingTeam: TeamDTO | null
  
  // Loading states
  loading: boolean
  refreshing: boolean
  error: string | null
  
  // Team-specific data
  teamMembers: Record<number, TeamMember[]>
  teamAgents: Record<number, AgentDTO[]>
  teamActivities: Record<number, TeamActivity[]>
  
  // Bulk operations
  selectedTeamIds: number[]
  bulkOperationInProgress: boolean
  
  // Details view state
  selectedTab: 'overview' | 'members' | 'agents' | 'activity'
  
  // Member management
  membersPanelOpen: boolean
  addMemberDialogOpen: boolean
  removeMemberConfirmOpen: boolean
  memberToRemove: TeamMember | null
  
  // Agent assignment
  agentAssignmentOpen: boolean
  availableAgents: AgentDTO[]
  
  // Activity panel
  activityPanelOpen: boolean
  activityFilter: 'all' | 'members' | 'agents' | 'updates'
  
  // Form state
  formData: {
    name: string
    description: string
    visibility: 'public' | 'private'
    agentIds: string[]
    memberEmails: string[]
  }
  formErrors: Record<string, string>
  isSubmitting: boolean
  
  // Permissions
  userPermissions: Record<number, {
    canEdit: boolean
    canDelete: boolean
    canManageMembers: boolean
    canAssignAgents: boolean
  }>
}

const initialState: TeamsState = {
  // Team data
  teams: [],
  selectedTeam: null,
  
  // Filtering and search
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  statusFilter: 'all',
  
  // UI state
  isPanelCollapsed: false,
  isFormDialogOpen: false,
  editingTeam: null,
  
  // Loading states
  loading: false,
  refreshing: false,
  error: null,
  
  // Team-specific data
  teamMembers: {},
  teamAgents: {},
  teamActivities: {},
  
  // Bulk operations
  selectedTeamIds: [],
  bulkOperationInProgress: false,
  
  // Details view
  selectedTab: 'overview',
  
  // Member management
  membersPanelOpen: false,
  addMemberDialogOpen: false,
  removeMemberConfirmOpen: false,
  memberToRemove: null,
  
  // Agent assignment
  agentAssignmentOpen: false,
  availableAgents: [],
  
  // Activity panel
  activityPanelOpen: false,
  activityFilter: 'all',
  
  // Form state
  formData: {
    name: '',
    description: '',
    visibility: 'public',
    agentIds: [],
    memberEmails: []
  },
  formErrors: {},
  isSubmitting: false,
  
  // Permissions
  userPermissions: {}
}

// Create the teams store
export const teamsStore = new Store(initialState)

// Store actions for team management
export const teamsActions = {
  // Team data actions
  setTeams: (teams: TeamDTO[]) => {
    teamsStore.setState((state) => ({
      ...state,
      teams,
      loading: false,
      refreshing: false,
      error: null
    }))
  },

  setSelectedTeam: (team: TeamDTO | null) => {
    teamsStore.setState((state) => ({
      ...state,
      selectedTeam: team,
      selectedTab: 'overview'
    }))
  },

  addTeam: (team: TeamDTO) => {
    teamsStore.setState((state) => ({
      ...state,
      teams: [...state.teams, team]
    }))
  },

  updateTeam: (teamId: number, updates: Partial<TeamDTO>) => {
    teamsStore.setState((state) => ({
      ...state,
      teams: state.teams.map(team => 
        team.id === teamId ? { ...team, ...updates } : team
      ),
      selectedTeam: state.selectedTeam?.id === teamId 
        ? { ...state.selectedTeam, ...updates } 
        : state.selectedTeam
    }))
  },

  removeTeam: (teamId: number) => {
    teamsStore.setState((state) => ({
      ...state,
      teams: state.teams.filter(team => team.id !== teamId),
      selectedTeam: state.selectedTeam?.id === teamId ? null : state.selectedTeam
    }))
  },

  // Filter and search actions
  setSearchQuery: (searchQuery: string) => {
    teamsStore.setState((state) => ({ ...state, searchQuery }))
  },

  setSorting: (sortBy: TeamsState['sortBy'], sortOrder: TeamsState['sortOrder']) => {
    teamsStore.setState((state) => ({ ...state, sortBy, sortOrder }))
  },

  setStatusFilter: (statusFilter: TeamsState['statusFilter']) => {
    teamsStore.setState((state) => ({ ...state, statusFilter }))
  },

  clearFilters: () => {
    teamsStore.setState((state) => ({
      ...state,
      searchQuery: '',
      statusFilter: 'all',
      sortBy: 'name',
      sortOrder: 'asc'
    }))
  },

  // UI state actions
  setPanelCollapsed: (isPanelCollapsed: boolean) => {
    teamsStore.setState((state) => ({ ...state, isPanelCollapsed }))
  },

  togglePanelCollapsed: () => {
    teamsStore.setState((state) => ({ 
      ...state, 
      isPanelCollapsed: !state.isPanelCollapsed 
    }))
  },

  setFormDialogOpen: (isOpen: boolean, editingTeam: TeamDTO | null = null) => {
    teamsStore.setState((state) => ({
      ...state,
      isFormDialogOpen: isOpen,
      editingTeam: isOpen ? editingTeam : null,
      // Reset form data when closing
      formData: isOpen ? (editingTeam ? {
        name: editingTeam.name,
        description: editingTeam.description || '',
        visibility: 'public', // Default, would need to be from team data
        agentIds: editingTeam.agentIds || [],
        memberEmails: []
      } : state.formData) : {
        name: '',
        description: '',
        visibility: 'public',
        agentIds: [],
        memberEmails: []
      },
      formErrors: isOpen ? state.formErrors : {}
    }))
  },

  setSelectedTab: (tab: TeamsState['selectedTab']) => {
    teamsStore.setState((state) => ({ ...state, selectedTab: tab }))
  },

  // Loading state actions
  setLoading: (loading: boolean) => {
    teamsStore.setState((state) => ({
      ...state,
      loading,
      error: loading ? null : state.error
    }))
  },

  setRefreshing: (refreshing: boolean) => {
    teamsStore.setState((state) => ({ ...state, refreshing }))
  },

  setError: (error: string | null) => {
    teamsStore.setState((state) => ({
      ...state,
      error,
      loading: false,
      refreshing: false
    }))
  },

  // Team data management
  setTeamMembers: (teamId: number, members: TeamMember[]) => {
    teamsStore.setState((state) => ({
      ...state,
      teamMembers: {
        ...state.teamMembers,
        [teamId]: members
      }
    }))
  },

  setTeamAgents: (teamId: number, agents: AgentDTO[]) => {
    teamsStore.setState((state) => ({
      ...state,
      teamAgents: {
        ...state.teamAgents,
        [teamId]: agents
      }
    }))
  },

  setTeamActivities: (teamId: number, activities: TeamActivity[]) => {
    teamsStore.setState((state) => ({
      ...state,
      teamActivities: {
        ...state.teamActivities,
        [teamId]: activities
      }
    }))
  },

  addTeamActivity: (teamId: number, activity: TeamActivity) => {
    teamsStore.setState((state) => ({
      ...state,
      teamActivities: {
        ...state.teamActivities,
        [teamId]: [activity, ...(state.teamActivities[teamId] || [])]
      }
    }))
  },

  // Member management actions
  setMembersPanelOpen: (open: boolean) => {
    teamsStore.setState((state) => ({ ...state, membersPanelOpen: open }))
  },

  setAddMemberDialogOpen: (open: boolean) => {
    teamsStore.setState((state) => ({ ...state, addMemberDialogOpen: open }))
  },

  setRemoveMemberConfirmOpen: (open: boolean, member: TeamMember | null = null) => {
    teamsStore.setState((state) => ({
      ...state,
      removeMemberConfirmOpen: open,
      memberToRemove: open ? member : null
    }))
  },

  addTeamMember: (teamId: number, member: TeamMember) => {
    teamsStore.setState((state) => ({
      ...state,
      teamMembers: {
        ...state.teamMembers,
        [teamId]: [...(state.teamMembers[teamId] || []), member]
      }
    }))
  },

  removeTeamMember: (teamId: number, memberId: string) => {
    teamsStore.setState((state) => ({
      ...state,
      teamMembers: {
        ...state.teamMembers,
        [teamId]: (state.teamMembers[teamId] || []).filter(m => m.id !== memberId)
      }
    }))
  },

  // Agent assignment actions
  setAgentAssignmentOpen: (open: boolean) => {
    teamsStore.setState((state) => ({ ...state, agentAssignmentOpen: open }))
  },

  setAvailableAgents: (agents: AgentDTO[]) => {
    teamsStore.setState((state) => ({ ...state, availableAgents: agents }))
  },

  assignAgentToTeam: (teamId: number, agent: AgentDTO) => {
    teamsStore.setState((state) => ({
      ...state,
      teamAgents: {
        ...state.teamAgents,
        [teamId]: [...(state.teamAgents[teamId] || []), agent]
      }
    }))
  },

  unassignAgentFromTeam: (teamId: number, agentId: string) => {
    teamsStore.setState((state) => ({
      ...state,
      teamAgents: {
        ...state.teamAgents,
        [teamId]: (state.teamAgents[teamId] || []).filter(a => a.id !== agentId)
      }
    }))
  },

  // Activity actions
  setActivityPanelOpen: (open: boolean) => {
    teamsStore.setState((state) => ({ ...state, activityPanelOpen: open }))
  },

  setActivityFilter: (filter: TeamsState['activityFilter']) => {
    teamsStore.setState((state) => ({ ...state, activityFilter: filter }))
  },

  // Form actions
  setFormData: (data: Partial<TeamsState['formData']>) => {
    teamsStore.setState((state) => ({
      ...state,
      formData: { ...state.formData, ...data }
    }))
  },

  setFormErrors: (errors: Record<string, string>) => {
    teamsStore.setState((state) => ({ ...state, formErrors: errors }))
  },

  setIsSubmitting: (isSubmitting: boolean) => {
    teamsStore.setState((state) => ({ ...state, isSubmitting }))
  },

  clearFormData: () => {
    teamsStore.setState((state) => ({
      ...state,
      formData: {
        name: '',
        description: '',
        visibility: 'public',
        agentIds: [],
        memberEmails: []
      },
      formErrors: {},
      isSubmitting: false
    }))
  },

  // Bulk operations
  setSelectedTeamIds: (teamIds: number[]) => {
    teamsStore.setState((state) => ({ ...state, selectedTeamIds: teamIds }))
  },

  toggleTeamSelection: (teamId: number) => {
    teamsStore.setState((state) => ({
      ...state,
      selectedTeamIds: state.selectedTeamIds.includes(teamId)
        ? state.selectedTeamIds.filter(id => id !== teamId)
        : [...state.selectedTeamIds, teamId]
    }))
  },

  setBulkOperationInProgress: (inProgress: boolean) => {
    teamsStore.setState((state) => ({ ...state, bulkOperationInProgress: inProgress }))
  },

  // Permissions
  setUserPermissions: (teamId: number, permissions: TeamsState['userPermissions'][number]) => {
    teamsStore.setState((state) => ({
      ...state,
      userPermissions: {
        ...state.userPermissions,
        [teamId]: permissions
      }
    }))
  },

  // Reset actions
  reset: () => {
    teamsStore.setState(initialState)
  }
}

// Common selectors for teams state
export const teamsSelectors = {
  // Data selectors
  teams: (state: TeamsState) => state.teams,
  selectedTeam: (state: TeamsState) => state.selectedTeam,
  getTeamById: (teamId: number) => (state: TeamsState) => 
    state.teams.find(team => team.id === teamId),
  
  // Filtered data selectors
  filteredTeams: (state: TeamsState) => {
    let filtered = state.teams

    // Apply search filter
    if (state.searchQuery) {
      filtered = filtered.filter(team => 
        team.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        team.description?.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    }

    // Apply status filter
    if (state.statusFilter !== 'all') {
      // Note: Would need status field in TeamDTO
      // filtered = filtered.filter(team => team.status === state.statusFilter)
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
        case 'memberCount':
          // Would need member count in TeamDTO or calculate from teamMembers
          compareResult = 0
          break
        case 'agentCount':
          const aAgentCount = a.agentIds?.length || 0
          const bAgentCount = b.agentIds?.length || 0
          compareResult = aAgentCount - bAgentCount
          break
      }

      return state.sortOrder === 'asc' ? compareResult : -compareResult
    })

    return filtered
  },

  // Filter selectors
  searchQuery: (state: TeamsState) => state.searchQuery,
  sortBy: (state: TeamsState) => state.sortBy,
  sortOrder: (state: TeamsState) => state.sortOrder,
  statusFilter: (state: TeamsState) => state.statusFilter,

  // UI state selectors
  isPanelCollapsed: (state: TeamsState) => state.isPanelCollapsed,
  isFormDialogOpen: (state: TeamsState) => state.isFormDialogOpen,
  editingTeam: (state: TeamsState) => state.editingTeam,
  selectedTab: (state: TeamsState) => state.selectedTab,

  // Loading selectors
  loading: (state: TeamsState) => state.loading,
  refreshing: (state: TeamsState) => state.refreshing,
  error: (state: TeamsState) => state.error,
  hasError: (state: TeamsState) => !!state.error,

  // Team data selectors
  teamMembers: (teamId: number) => (state: TeamsState) => 
    state.teamMembers[teamId] || [],
  teamAgents: (teamId: number) => (state: TeamsState) => 
    state.teamAgents[teamId] || [],
  teamActivities: (teamId: number) => (state: TeamsState) => 
    state.teamActivities[teamId] || [],
  filteredActivities: (teamId: number) => (state: TeamsState) => {
    const activities = state.teamActivities[teamId] || []
    if (state.activityFilter === 'all') return activities
    
    return activities.filter(activity => {
      switch (state.activityFilter) {
        case 'members':
          return activity.type.includes('member')
        case 'agents':
          return activity.type.includes('agent')
        case 'updates':
          return activity.type === 'team_updated'
        default:
          return true
      }
    })
  },

  // Member management selectors
  membersPanelOpen: (state: TeamsState) => state.membersPanelOpen,
  addMemberDialogOpen: (state: TeamsState) => state.addMemberDialogOpen,
  removeMemberConfirmOpen: (state: TeamsState) => state.removeMemberConfirmOpen,
  memberToRemove: (state: TeamsState) => state.memberToRemove,

  // Agent assignment selectors
  agentAssignmentOpen: (state: TeamsState) => state.agentAssignmentOpen,
  availableAgents: (state: TeamsState) => state.availableAgents,

  // Activity selectors
  activityPanelOpen: (state: TeamsState) => state.activityPanelOpen,
  activityFilter: (state: TeamsState) => state.activityFilter,

  // Form selectors
  formData: (state: TeamsState) => state.formData,
  formErrors: (state: TeamsState) => state.formErrors,
  isSubmitting: (state: TeamsState) => state.isSubmitting,
  hasFormErrors: (state: TeamsState) => Object.keys(state.formErrors).length > 0,

  // Bulk operation selectors
  selectedTeamIds: (state: TeamsState) => state.selectedTeamIds,
  selectedTeams: (state: TeamsState) => 
    state.teams.filter(team => state.selectedTeamIds.includes(team.id)),
  bulkOperationInProgress: (state: TeamsState) => state.bulkOperationInProgress,

  // Permission selectors
  userPermissions: (teamId: number) => (state: TeamsState) => 
    state.userPermissions[teamId] || {
      canEdit: false,
      canDelete: false,
      canManageMembers: false,
      canAssignAgents: false
    },
  canEditTeam: (teamId: number) => (state: TeamsState) => 
    state.userPermissions[teamId]?.canEdit || false,
  canDeleteTeam: (teamId: number) => (state: TeamsState) => 
    state.userPermissions[teamId]?.canDelete || false
}

