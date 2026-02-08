/**
 * Store Actions - Centralized action creators and utilities for all stores
 *
 * This file provides action creators that work across multiple stores and
 * utilities for common patterns like data fetching with loading states.
 *
 * AIDEV-NOTE: Centralized actions for cross-store operations and consistency
 */

import type { QueryClient } from '@tanstack/react-query'
import { appStateActions, appStateStore } from './app-state.store'
import { uiStateActions } from './ui-state.store'
import { agentsActions } from './agents.store'
import { teamsActions } from './teams.store'
import { dataActions } from './data-management.store'
import { chatActions } from './chat.store'
import { orgChartActions } from './organization-chart.store'
import { formsActions } from './forms.store'
import { appsActions } from './apps.store'

// Import server actions
import { getCurrentOrganization } from '@/app/actions/user-organizations'
import { getDatabases } from '@/app/actions/databases'
import { getTables } from '@/app/actions/tables'
import { getAgents } from '@/app/actions/agents'
import { getTeams } from '@/app/actions/teams'

// Query client reference for invalidating queries from store actions
let queryClientRef: QueryClient | null = null

/**
 * Set the query client reference for store actions to use
 * Must be called during app initialization (in EmeryProviders)
 */
export function setQueryClientRef(client: QueryClient) {
  queryClientRef = client
}

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
      // Map organization DTO to store Organization type with default plan
      const organization = currentOrgResult ? {
        id: currentOrgResult.id,
        name: currentOrgResult.name,
        plan: (currentOrgResult.plan || 'free') as 'free' | 'pro' | 'max' | 'enterprise'
      } : null

      appStateActions.setAllData({
        databases: databasesResult,
        tables: tablesResult,
        agents: agentsResult,
        teams: teamsResult,
        organization
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

  /**
   * Called after creating a new database/table to refresh both store and query caches
   * This ensures new tables show up immediately without page refresh
   */
  async onDataStructureCreated() {
    // Get user's current organization from store state
    const user = appStateStore.state.user
    const orgId = user?.currentOrganizationId

    // First refresh store data
    if (orgId) {
      await this.initializeApplication(orgId)
    }

    // Then invalidate TanStack Query caches so any open data views refresh
    if (queryClientRef) {
      // Invalidate table-related queries
      queryClientRef.invalidateQueries({ queryKey: ['rows'] })
      queryClientRef.invalidateQueries({ queryKey: ['fields'] })
      queryClientRef.invalidateQueries({ queryKey: ['views'] })
    }
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