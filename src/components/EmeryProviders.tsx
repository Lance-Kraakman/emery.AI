'use client'

import React, { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmeryStoreProvider } from '@/contexts/EmeryStoreProvider'
import { CreateDatabaseDialog } from '@/app/(app)/data/components/CreateDatabaseDialog'
import { CreateTableDialog } from '@/app/(app)/data/components/CreateTableDialog'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store'
import { storeActions, setQueryClientRef } from '@/stores/actions'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LayoutProvider } from '@/components/layout/LayoutProvider'
import { EmeryLayout } from '@/components/layout/EmeryLayout'
import { createChatContextForPage } from '@/components/layout/types'

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
})

// Set query client reference for store actions to use for cache invalidation
setQueryClientRef(queryClient)

function DataDialogs() {
  // Use TanStack Store selectors for UI state
  const isCreateDatabaseOpen = useStore(uiStateStore, uiStateSelectors.isCreateDatabaseOpen)
  const isCreateTableOpen = useStore(uiStateStore, uiStateSelectors.isCreateTableOpen)
  const selectedDatabaseForTable = useStore(uiStateStore, uiStateSelectors.selectedDatabaseForTable)

  // Use the new onDataStructureCreated which refreshes store AND invalidates query caches
  const handleDataStructureCreated = async () => {
    await storeActions.onDataStructureCreated()
  }

  return (
    <>
      <CreateDatabaseDialog
        isOpen={isCreateDatabaseOpen}
        onClose={() => storeActions.closeDatabaseForm()}
        onDatabaseCreated={handleDataStructureCreated}
      />
      
      <CreateTableDialog
        isOpen={isCreateTableOpen}
        onClose={() => storeActions.closeTableForm()}
        onTableCreated={handleDataStructureCreated}
        selectedDatabaseId={selectedDatabaseForTable}
      />
    </>
  )
}

interface SidebarData {
  apps: any[]
  agents: any[]
  teams: any[]
  skills: any[]
  databases: any[]
}

interface EmeryProvidersProps {
  children: React.ReactNode
  // Layout configuration props
  enableChat?: boolean
  chatContext?: import('@/components/layout/types').ChatContextConfig
  // Page context for automatic chat configuration
  pageName?: string
  // Server-fetched sidebar data
  sidebarData?: SidebarData
}

export function EmeryProviders({
  children,
  enableChat = true,
  chatContext,
  pageName,
  sidebarData
}: EmeryProvidersProps) {
  // Auto-generate chat context based on page if not provided
  const effectiveChatContext = chatContext || (pageName ? createChatContextForPage(pageName) : undefined)
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        themes={["light", "dark", "enhancd-light", "enhancd-dark", "system"]}
      >
        <EmeryStoreProvider>
          <LayoutProvider>
              <EmeryLayout
                enableChat={enableChat}
                chatContext={effectiveChatContext}
                sidebarData={sidebarData}
              >
                {children}
              </EmeryLayout>
              <DataDialogs />
          </LayoutProvider>
        </EmeryStoreProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
