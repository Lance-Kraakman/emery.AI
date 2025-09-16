/**
 * Store Actions - Centralized action creators and utilities for all stores
 * 
 * This file provides action creators that work across multiple stores and
 * utilities for common patterns like data fetching with loading states.
 * 
 * AIDEV-NOTE: Centralized actions for cross-store operations and consistency
 */

import { appStateActions, appStateStore } from './app-state.store'
import { uiStateActions, uiStateStore } from './ui-state.store'
import { agentsActions, agentsStore } from './agents.store'
import { teamsActions, teamsStore } from './teams.store'
import { dataActions, dataStore } from './data-management.store'
import { chatActions, chatStore } from './chat.store'
import { orgChartActions, orgChartStore } from './organization-chart.store'
import { formsActions, formsStore } from './forms.store'

// Import server actions
import { getCurrentOrganization } from '@/app/actions/user-organizations'
import { getDatabases } from '@/app/actions/databases'
import { getTables } from '@/app/actions/tables'
import { getAgents } from '@/app/actions/agents'
import { getTeams } from '@/app/actions/teams'
import { getFields } from '@/app/actions/fields'
import { getRowsData } from '@/app/actions/rows'

/**
 * Cross-store action creators for complex operations
 */
export const storeActions = {
  /**
   * Initialize all stores with data - replaces useEmeryData functionality
   */
  async initializeApplication(organizationId?: number) {
    try {
      // Set loading state
      appStateActions.setLoading(true)
      
      // Fetch all required data in parallel
      const [
        currentOrgResult,
        databasesResult,
        tablesResult,
        agentsResult,
        teamsResult
      ] = await Promise.all([
        getCurrentOrganization(),
        getDatabases(),
        getTables(),
        getAgents(),
        organizationId ? getTeams(organizationId) : Promise.resolve([])
      ])

      // Update app state store with all data
      appStateActions.setAllData({
        databases: databasesResult,
        tables: tablesResult,
        agents: agentsResult,
        teams: teamsResult,
        organization: currentOrgResult
      })

      // Initialize other stores with relevant data
      agentsActions.setAgents(agentsResult)
      teamsActions.setTeams(teamsResult)

      // Mark initialization complete
      appStateActions.setLoading(false)
      
      return {
        success: true,
        data: {
          organization: currentOrgResult,
          databases: databasesResult,
          tables: tablesResult,
          agents: agentsResult,
          teams: teamsResult
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize application'
      appStateActions.setError(errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  },

  /**
   * Refresh specific data sections
   */
  async refreshAgents() {
    try {
      agentsActions.setLoading(true)
      const agents = await getAgents()
      
      // Update both stores
      appStateActions.setAgents(agents)
      agentsActions.setAgents(agents)
      
      return { success: true, data: agents }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh agents'
      agentsActions.setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  },

  async refreshTeams(organizationId: number) {
    try {
      teamsActions.setLoading(true)
      const teams = await getTeams(organizationId)
      
      // Update both stores
      appStateActions.setTeams(teams)
      teamsActions.setTeams(teams)
      
      return { success: true, data: teams }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh teams'
      teamsActions.setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  },

  async refreshTableData(tableId: number) {
    try {
      dataActions.setLoading(true)
      
      const [fields, rows] = await Promise.all([
        getFields(tableId),
        getRowsData(tableId)
      ])
      
      dataActions.setFields(fields)
      dataActions.setRows(Array.from(rows) as any, rows.length)
      
      return { success: true, data: { fields, rows } }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh table data'
      dataActions.setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  },

  /**
   * Open forms with pre-filled data from other stores
   */
  openAgentCreateForm(editingAgent?: any) {
    if (editingAgent) {
      // Pre-fill form with agent data
      formsActions.updateAgentCreateForm({
        name: editingAgent.name,
        description: editingAgent.description || '',
        role: editingAgent.role || '',
        capabilities: editingAgent.capabilities || [],
        teamIds: editingAgent.teamIds || [],
        configuration: editingAgent.configuration || {}
      })
    }
    
    // Update both UI state and forms state
    uiStateActions.setAgentCreateForm(true, editingAgent?.id || null)
    formsActions.setAgentCreateForm(true, editingAgent?.id || null)
    agentsActions.setCreateMode(true)
  },

  openTeamForm(editingTeam?: any) {
    if (editingTeam) {
      formsActions.updateTeamForm({
        name: editingTeam.name,
        description: editingTeam.description || '',
        visibility: 'public', // Default
        agentIds: editingTeam.agentIds || [],
        memberEmails: []
      })
    }
    
    uiStateActions.openModal('teamCreate')
    formsActions.setTeamForm(true, editingTeam?.id || null)
    teamsActions.setFormDialogOpen(true, editingTeam)
  },

  openDatabaseForm() {
    uiStateActions.setCreateDatabaseOpen(true)
  },

  openTableForm(selectedDatabaseId?: number) {
    uiStateActions.setCreateTableOpen(true)
    uiStateActions.setSelectedDatabaseForTable(selectedDatabaseId)
    formsActions.setTableForm(true, null, selectedDatabaseId)
  },

  openFieldForm(tableId: number, editingField?: any) {
    if (editingField) {
      formsActions.updateFieldForm({
        name: editingField.name,
        type: editingField.type,
        required: editingField.required || false,
        defaultValue: editingField.defaultValue,
        relationTable: editingField.relationTable,
        description: editingField.description || ''
      })
    }
    
    dataActions.setFieldManagerOpen(true)
    formsActions.setFieldForm(true, editingField?.id || null, tableId)
  },

  /**
   * Close forms and clean up state
   */
  closeAgentCreateForm() {
    uiStateActions.setAgentCreateForm(false, null)
    formsActions.setAgentCreateForm(false, null)
    agentsActions.setCreateMode(false)
    
    // Reset form data
    formsActions.updateAgentCreateForm({
      name: '',
      description: '',
      role: '',
      capabilities: [],
      teamIds: [],
      configuration: {}
    })
  },

  closeTeamForm() {
    uiStateActions.closeModal('teamCreate')
    formsActions.setTeamForm(false, null)
    teamsActions.setFormDialogOpen(false, null)
  },

  closeDatabaseForm() {
    uiStateActions.setCreateDatabaseOpen(false)
  },

  closeTableForm() {
    uiStateActions.setCreateTableOpen(false)
    uiStateActions.setSelectedDatabaseForTable(undefined)
    formsActions.setTableForm(false, null, null)
  },

  closeFieldForm() {
    dataActions.setFieldManagerOpen(false)
    formsActions.setFieldForm(false, null, null)
  },

  /**
   * Data synchronization between stores
   * AIDEV-TODO: Complete agent-team synchronization implementation with proper type consistency
   */
  // syncAgentToTeams(agentId: number, teamIds: number[]) {
  //   // Update agent in app state
  //   const appState = appStateStore.state
  //   const agent = appState.agents.find(a => a.id === agentId)
  //   
  //   if (agent) {
  //     // AIDEV-TODO: AgentDTO doesn't have teamIds property - need to define agent-team relationship properly
  //     // appStateActions.updateAgent(agentId.toString(), { teamIds })
  //     // agentsActions.updateAgent(agentId.toString(), { teamIds })
  //   }
  //   
  //   // Update teams to include this agent
  //   const teamsState = teamsStore.state
  //   teamsState.teams.forEach(team => {
  //     if (teamIds.includes(team.id)) {
  //       // Add agent to team
  //       const currentAgentIds = team.agentIds || []
  //       if (!currentAgentIds.includes(agentId.toString())) {
  //         teamsActions.updateTeam(team.id, {
  //           agentIds: [...currentAgentIds, agentId.toString()]
  //         })
  //       }
  //     } else {
  //       // Remove agent from team
  //       const currentAgentIds = team.agentIds || []
  //       if (currentAgentIds.includes(agentId.toString())) {
  //         teamsActions.updateTeam(team.id, {
  //           agentIds: currentAgentIds.filter(id => id !== agentId.toString())
  //         })
  //       }
  //     }
  //   })
  // },

  /**
   * UI state management shortcuts
   */
  toggleSidebar() {
    uiStateActions.toggleSidebar()
  },

  toggleChat() {
    uiStateActions.toggleChat()
    chatActions.toggleChat()
  },

  openChatWithContext(context: any) {
    // Create new chat session with context
    const sessionId = chatActions.createSession(context)
    
    // Open chat UI
    uiStateActions.setChatState('expanded')
    chatActions.setChatOpen(true)
    
    return sessionId
  },

  /**
   * Notification system
   */
  showNotification(type: 'success' | 'error' | 'info' | 'warning', message: string) {
    uiStateActions.addToast({ type, message })
  },

  showSuccess(message: string) {
    this.showNotification('success', message)
  },

  showError(message: string) {
    this.showNotification('error', message)
  },

  /**
   * Search across all stores
   */
  globalSearch(query: string) {
    const results = {
      agents: [],
      teams: [],
      tables: [],
      tasks: []
    } as any

    // Search in app state
    const appState = appStateStore.state
    const lowerQuery = query.toLowerCase()

    // Search agents
    results.agents = appState.agents.filter(agent =>
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.description?.toLowerCase().includes(lowerQuery)
    )

    // Search teams
    results.teams = appState.teams.filter(team =>
      team.name.toLowerCase().includes(lowerQuery) ||
      team.description?.toLowerCase().includes(lowerQuery)
    )

    // Search tables
    results.tables = appState.databases.flatMap(db => db.tables).filter(table =>
      table.name.toLowerCase().includes(lowerQuery)
    )

    // Search tasks
    const orgChartState = orgChartStore.state
    results.tasks = orgChartState.tasks.filter(task =>
      task.name.toLowerCase().includes(lowerQuery) ||
      task.instructions?.instructions.toLowerCase().includes(lowerQuery)
    )

    return results
  },

  /**
   * Bulk operations
   */
  async bulkUpdateAgents(agentIds: string[], updates: any) {
    try {
      agentsActions.setBulkOperationInProgress(true)
      
      // Update each agent in stores
      agentIds.forEach(agentId => {
        const numericId = parseInt(agentId, 10)
        agentsActions.updateAgent(numericId, updates)
        appStateActions.updateAgent(numericId, updates)
      })
      
      // Here you would also call the server action
      // await bulkUpdateAgents(agentIds, updates)
      
      storeActions.showSuccess(`Updated ${agentIds.length} agents successfully`)
      
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk update failed'
      storeActions.showError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      agentsActions.setBulkOperationInProgress(false)
    }
  },

  /**
   * Reset all stores - useful for logout or switching organizations
   */
  resetAllStores() {
    appStateActions.reset()
    uiStateActions.reset()
    agentsActions.reset()
    teamsActions.reset()
    dataActions.reset()
    chatActions.reset()
    orgChartActions.reset()
    formsActions.reset()
  },

  /**
   * Debug utilities
   */
  getStoreStates() {
    return {
      appState: appStateStore.state,
      uiState: uiStateStore.state,
      agents: agentsStore.state,
      teams: teamsStore.state,
      data: dataStore.state,
      chat: chatStore.state,
      orgChart: orgChartStore.state,
      forms: formsStore.state
    }
  }
}

// Export individual store actions for convenience
export {
  appStateActions,
  uiStateActions,
  agentsActions,
  teamsActions,
  dataActions,
  chatActions,
  orgChartActions,
  formsActions
}