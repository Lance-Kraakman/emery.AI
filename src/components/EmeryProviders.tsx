'use client'

import React, { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmeryStoreProvider } from '@/src/contexts/EmeryStoreProvider'
import { CreateDatabaseDialog } from '@/src/app/(app)/data/components/CreateDatabaseDialog'
import { CreateTableDialog } from '@/src/app/(app)/data/components/CreateTableDialog'
import { useEmeryStore } from '@/src/contexts/EmeryStoreProvider'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors } from '@/src/stores/ui-state.store'
import { storeActions } from '@/src/stores/actions'
import { ThemeProvider } from '@/src/components/ThemeProvider'
import { LayoutProvider } from '@/src/components/layout/LayoutProvider'
import { EmeryLayout } from '@/src/components/layout/EmeryLayout'
import { createChatContextForPage } from '@/src/components/layout/types'

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
})

function DataDialogs() {
  // Use TanStack Store selectors for UI state
  const isCreateDatabaseOpen = useStore(uiStateStore, uiStateSelectors.isCreateDatabaseOpen)
  const isCreateTableOpen = useStore(uiStateStore, uiStateSelectors.isCreateTableOpen) 
  const selectedDatabaseForTable = useStore(uiStateStore, uiStateSelectors.selectedDatabaseForTable)
  const { refetch } = useEmeryStore()
  
  const handleDataStructureCreated = () => {
    refetch()
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

interface EmeryProvidersProps {
  children: React.ReactNode
  // Layout configuration props
  enableChat?: boolean
  chatContext?: import('@/src/components/layout/types').ChatContextConfig
  // Page context for automatic chat configuration
  pageName?: string
}

export function EmeryProviders({ 
  children, 
  enableChat = true,
  chatContext,
  pageName
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
      >
        <EmeryStoreProvider>
          <LayoutProvider>
              <EmeryLayout enableChat={enableChat} chatContext={effectiveChatContext}>
                {children}
              </EmeryLayout>
              <DataDialogs />
          </LayoutProvider>
        </EmeryStoreProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
