/**
 * TanStack Store Registry - Central export for all application stores
 * 
 * This file provides a single import point for all stores, making it easy
 * to access and manage application state throughout the codebase.
 * 
 * AIDEV-NOTE: Central store registry to replace all useState/Context patterns
 * with performant, type-safe state management using TanStack Store.
 */

export { appStateStore, type AppState } from './app-state.store'
export { uiStateStore, type UIState } from './ui-state.store'
export { agentsStore, type AgentsState } from './agents.store'
export { teamsStore, type TeamsState } from './teams.store'
export { dataStore, type DataState } from './data-management.store'
export { chatStore, type ChatState } from './chat.store'
export { orgChartStore, type OrgChartState } from './organization-chart.store'
export { formsStore, type FormsState } from './forms.store'

// Store actions - centralized action creators for consistency
export * from './actions'

// Store utilities and helpers
export * from './utils'
export * from './types'