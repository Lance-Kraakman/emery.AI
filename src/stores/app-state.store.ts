/**
 * App State Store - Replaces EmeryContext and useEmeryData hook
 * 
 * Centralizes global application state including organization, user, and core data.
 * This store replaces the existing EmeryContext/useEmeryData pattern with 
 * TanStack Store for better performance and type safety.
 * 
 * AIDEV-NOTE: This replaces the EmeryContext provider and useEmeryData hook
 * with fine-grained reactivity and better performance characteristics.
 */

import { Store } from '@tanstack/react-store'
import type { AgentDTO } from '@/app/mappers/agent-mapper'
import type { TeamDTO } from '@/app/mappers/team-mapper'
import type { TableDTO } from '@/app/mappers/table-mapper'
import type { DatabaseDTO } from '@/app/mappers/database-mapper'

// Extended database interface to include tables for frontend convenience
export interface DatabaseWithTables extends DatabaseDTO {
  tables: TableDTO[]
}

export interface Organization {
  id: number
  name: string
}

export interface User {
  id: string
  email: string
  name: string
  currentOrganizationId?: number
  needsSetup: boolean
  availableOrganizations: Organization[]
}

export interface AppState {
  // Core data
  databases: DatabaseWithTables[]
  agents: AgentDTO[]
  teams: TeamDTO[]
  
  // User and organization context
  user: User | null
  currentOrganization: Organization | null
  availableOrganizations: Organization[]
  
  // Loading and error states
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  
  // Data loading timestamps for cache management
  lastFetched: {
    databases: Date | null
    agents: Date | null
    teams: Date | null
  }
}

const initialState: AppState = {
  databases: [],
  agents: [],
  teams: [],
  user: null,
  currentOrganization: null,
  availableOrganizations: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastFetched: {
    databases: null,
    agents: null,
    teams: null
  }
}

// Create the app state store
export const appStateStore = new Store(initialState)

// Store actions for app state management
export const appStateActions = {
  // User and organization actions
  setUser: (user: User | null) => {
    appStateStore.setState((state) => ({
      ...state,
      user,
      availableOrganizations: user?.availableOrganizations || []
    }))
  },

  setCurrentOrganization: (organization: Organization | null) => {
    appStateStore.setState((state) => ({
      ...state,
      currentOrganization: organization
    }))
  },

  // Data loading actions
  setLoading: (isLoading: boolean) => {
    appStateStore.setState((state) => ({
      ...state,
      isLoading,
      error: isLoading ? null : state.error
    }))
  },

  setRefreshing: (isRefreshing: boolean) => {
    appStateStore.setState((state) => ({
      ...state,
      isRefreshing
    }))
  },

  setError: (error: string | null) => {
    appStateStore.setState((state) => ({
      ...state,
      error,
      isLoading: false,
      isRefreshing: false
    }))
  },

  // Data update actions
  setDatabases: (databases: DatabaseDTO[], tables: TableDTO[]) => {
    const databasesWithTables: DatabaseWithTables[] = databases.map(db => ({
      ...db,
      tables: tables.filter(table => table.databaseId === db.id)
    }))

    appStateStore.setState((state) => ({
      ...state,
      databases: databasesWithTables,
      lastFetched: {
        ...state.lastFetched,
        databases: new Date()
      }
    }))
  },

  setAgents: (agents: AgentDTO[]) => {
    appStateStore.setState((state) => ({
      ...state,
      agents,
      lastFetched: {
        ...state.lastFetched,
        agents: new Date()
      }
    }))
  },

  setTeams: (teams: TeamDTO[]) => {
    appStateStore.setState((state) => ({
      ...state,
      teams,
      lastFetched: {
        ...state.lastFetched,
        teams: new Date()
      }
    }))
  },

  // Complete data refresh
  setAllData: (data: {
    databases: DatabaseDTO[]
    tables: TableDTO[]
    agents: AgentDTO[]
    teams: TeamDTO[]
    organization?: Organization | null
  }) => {
    const databasesWithTables: DatabaseWithTables[] = data.databases.map(db => ({
      ...db,
      tables: data.tables.filter(table => table.databaseId === db.id)
    }))

    const now = new Date()

    appStateStore.setState((state) => ({
      ...state,
      databases: databasesWithTables,
      agents: data.agents,
      teams: data.teams,
      currentOrganization: data.organization || state.currentOrganization,
      lastFetched: {
        databases: now,
        agents: now,
        teams: now
      },
      isLoading: false,
      isRefreshing: false,
      error: null
    }))
  },

  // Add new items
  addDatabase: (database: DatabaseWithTables) => {
    appStateStore.setState((state) => ({
      ...state,
      databases: [...state.databases, database]
    }))
  },

  addTable: (table: TableDTO) => {
    appStateStore.setState((state) => ({
      ...state,
      databases: state.databases.map(db => 
        db.id === table.databaseId 
          ? { ...db, tables: [...db.tables, table] }
          : db
      )
    }))
  },

  addAgent: (agent: AgentDTO) => {
    appStateStore.setState((state) => ({
      ...state,
      agents: [...state.agents, agent]
    }))
  },

  addTeam: (team: TeamDTO) => {
    appStateStore.setState((state) => ({
      ...state,
      teams: [...state.teams, team]
    }))
  },

  // Update existing items
  updateAgent: (agentId: number, updates: Partial<AgentDTO>) => {
    appStateStore.setState((state) => ({
      ...state,
      agents: state.agents.map(agent => 
        agent.id === agentId ? { ...agent, ...updates } : agent
      )
    }))
  },

  updateTeam: (teamId: number, updates: Partial<TeamDTO>) => {
    appStateStore.setState((state) => ({
      ...state,
      teams: state.teams.map(team => 
        team.id === teamId ? { ...team, ...updates } : team
      )
    }))
  },

  updateDatabase: (databaseId: number, updates: Partial<DatabaseDTO>) => {
    appStateStore.setState((state) => ({
      ...state,
      databases: state.databases.map(db => 
        db.id === databaseId ? { ...db, ...updates } : db
      )
    }))
  },

  updateTable: (tableId: number, updates: Partial<TableDTO>) => {
    appStateStore.setState((state) => ({
      ...state,
      databases: state.databases.map(db => ({
        ...db,
        tables: db.tables.map(table => 
          table.id === tableId ? { ...table, ...updates } : table
        )
      }))
    }))
  },

  // Remove items
  removeAgent: (agentId: number) => {
    appStateStore.setState((state) => ({
      ...state,
      agents: state.agents.filter(agent => agent.id !== agentId)
    }))
  },

  removeTeam: (teamId: number) => {
    appStateStore.setState((state) => ({
      ...state,
      teams: state.teams.filter(team => team.id !== teamId)
    }))
  },

  removeDatabase: (databaseId: number) => {
    appStateStore.setState((state) => ({
      ...state,
      databases: state.databases.filter(db => db.id !== databaseId)
    }))
  },

  removeTable: (tableId: number) => {
    appStateStore.setState((state) => ({
      ...state,
      databases: state.databases.map(db => ({
        ...db,
        tables: db.tables.filter(table => table.id !== tableId)
      }))
    }))
  },

  // Reset store
  reset: () => {
    appStateStore.setState(initialState)
  }
}

// Common selectors for app state
export const appStateSelectors = {
  // User and organization selectors
  user: (state: AppState) => state.user,
  currentOrganization: (state: AppState) => state.currentOrganization,
  availableOrganizations: (state: AppState) => state.availableOrganizations,
  
  // Data selectors
  databases: (state: AppState) => state.databases,
  agents: (state: AppState) => state.agents,
  teams: (state: AppState) => state.teams,
  
  // Derived data selectors
  allTables: (state: AppState) => (state.databases || []).flatMap(db => db.tables),
  getAgentById: (agentId: number) => (state: AppState) =>
    state.agents.find(agent => agent.id === agentId),
  getTeamById: (teamId: number) => (state: AppState) =>
    state.teams.find(team => team.id === teamId),
  getDatabaseById: (databaseId: number) => (state: AppState) =>
    state.databases.find(db => db.id === databaseId),
  getTableById: (tableId: number) => (state: AppState) =>
    (state.databases || []).flatMap(db => db.tables).find(table => table.id === tableId),
  
  // Status selectors
  isLoading: (state: AppState) => state.isLoading,
  isRefreshing: (state: AppState) => state.isRefreshing,
  error: (state: AppState) => state.error,
  hasError: (state: AppState) => !!state.error,
  
  // Cache selectors
  lastFetched: (state: AppState) => state.lastFetched,
  needsRefresh: (maxAge: number = 5 * 60 * 1000) => (state: AppState) => {
    const now = Date.now()
    return Object.values(state.lastFetched).some(timestamp => 
      !timestamp || (now - timestamp.getTime()) > maxAge
    )
  }
}

