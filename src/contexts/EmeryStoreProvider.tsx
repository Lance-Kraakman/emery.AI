/**
 * Emery Store Provider - TanStack Store-based replacement for EmeryContext
 * 
 * Provides the same API as the original EmeryContext but powered by TanStack Store
 * for better performance and state management. This is a drop-in replacement.
 * 
 * AIDEV-NOTE: This replaces EmeryContext with TanStack Store while maintaining
 * the same public API for backwards compatibility during migration.
 */

'use client'

import React, { createContext, useContext, ReactNode, useEffect, useRef } from 'react'
import { useStore } from '@tanstack/react-store'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  appStateStore,
  appStateSelectors,
  appStateActions,
  type DatabaseWithTables
} from '@/stores/app-state.store'
import { chatActions } from '@/stores/chat.store'
import { storeActions } from '@/stores/actions'

// Maintain backwards compatibility with existing EmeryData interface
export interface EmeryData {
  databases: DatabaseWithTables[]
  agents: any[]
  teams: any[]
  organization?: {
    id: number
    name: string
  }
}

interface EmeryContextType {
  data: EmeryData
  isLoading: boolean
  error: string | null
  refetch: () => void
  currentOrganization: any
  availableOrganizations: any[]
}

const EmeryStoreContext = createContext<EmeryContextType | undefined>(undefined)

export function EmeryStoreProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()

  // Track previous organization to prevent unnecessary re-initialization
  const prevOrgIdRef = useRef<number | undefined>(undefined)

  // Subscribe to relevant app state slices with fine-grained reactivity
  const databases = useStore(appStateStore, appStateSelectors.databases)
  const agents = useStore(appStateStore, appStateSelectors.agents)
  const teams = useStore(appStateStore, appStateSelectors.teams)
  const currentOrganization = useStore(appStateStore, appStateSelectors.currentOrganization)
  const availableOrganizations = useStore(appStateStore, appStateSelectors.availableOrganizations)
  const isLoading = useStore(appStateStore, appStateSelectors.isLoading)
  const error = useStore(appStateStore, appStateSelectors.error)

  // Initialize stores when organization changes (not on every session update)
  useEffect(() => {
    if (session?.user?.needsSetup && !session?.user?.currentOrganizationId) {
      router.push('/setup')
      return
    }

    const currentOrgId = session?.user?.currentOrganizationId

    // Only reinitialize if organization actually changed
    if (currentOrgId && currentOrgId !== prevOrgIdRef.current) {
      prevOrgIdRef.current = currentOrgId
      chatActions.reset()  // Clear chat state from previous org
      storeActions.initializeApplication(currentOrgId)
    }
  }, [session, router])

  // Update user data in app state when session changes
  useEffect(() => {
    if (session?.user) {
      const user = {
        id: session.user.id || '',
        email: session.user.email || '',
        name: session.user.name || '',
        currentOrganizationId: session.user.currentOrganizationId || undefined,
        needsSetup: session.user.needsSetup || false,
        availableOrganizations: session.user.availableOrganizations || []
      }
      
      // Update app state with user data
      appStateActions.setUser(user)
    }
  }, [session])

  // Create the context value with the same API as original EmeryContext
  const contextValue: EmeryContextType = {
    data: {
      databases,
      agents,
      teams,
      organization: currentOrganization ? {
        id: currentOrganization.id,
        name: currentOrganization.name
      } : undefined
    },
    isLoading,
    error,
    refetch: () => {
      if (session?.user?.currentOrganizationId) {
        storeActions.initializeApplication(session.user.currentOrganizationId)
      }
    },
    currentOrganization,
    availableOrganizations
  }

  return (
    <EmeryStoreContext.Provider value={contextValue}>
      {children}
    </EmeryStoreContext.Provider>
  )
}

// Backwards-compatible hook - same API as original useEmery()
export function useEmeryStore() {
  const context = useContext(EmeryStoreContext)
  if (context === undefined) {
    throw new Error('useEmeryStore must be used within an EmeryStoreProvider')
  }
  return context
}

// Direct store access hooks for components that want to opt into better performance
export function useEmeryDatabases() {
  return useStore(appStateStore, appStateSelectors.databases)
}

export function useEmeryAgents() {
  return useStore(appStateStore, appStateSelectors.agents)
}

export function useEmeryTeams() {
  return useStore(appStateStore, appStateSelectors.teams)
}

export function useEmeryOrganization() {
  return useStore(appStateStore, appStateSelectors.currentOrganization)
}

export function useEmeryLoading() {
  return useStore(appStateStore, appStateSelectors.isLoading)
}

export function useEmeryError() {
  return useStore(appStateStore, appStateSelectors.error)
}

// Utility hook for components that need specific database/table combinations
export function useEmeryTable(tableId: number) {
  return useStore(appStateStore, (state) => 
    appStateSelectors.getTableById(tableId)(state)
  )
}

export function useEmeryAgent(agentId: number) {
  return useStore(appStateStore, (state) => 
    appStateSelectors.getAgentById(agentId)(state)
  )
}

export function useEmeryTeam(teamId: number) {
  return useStore(appStateStore, (state) => 
    appStateSelectors.getTeamById(teamId)(state)
  )
}

// Export the original hook name for backwards compatibility
export const useEmery = useEmeryStore

// Migration helper - components can gradually switch from useEmery to specific hooks
export const emeryStoreHooks = {
  useEmeryStore,
  useEmeryDatabases,
  useEmeryAgents,
  useEmeryTeams,
  useEmeryOrganization,
  useEmeryLoading,
  useEmeryError,
  useEmeryTable,
  useEmeryAgent,
  useEmeryTeam
}