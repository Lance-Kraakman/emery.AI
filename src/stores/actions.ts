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
import { appsActions, appsStore } from './apps.store'

// Import server actions
import { getCurrentOrganization } from '@/app/actions/user-organizations'
import { getDatabases } from '@/app/actions/databases'
import { getTables } from '@/app/actions/tables'
import { getAgents } from '@/app/actions/agents'
import { getTeams } from '@/app/actions/teams'
import { getFields } from '@/app/actions/fields'
import { getRowsDSG } from '@/app/actions/rows'

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
  formsActions,
  appsActions
}