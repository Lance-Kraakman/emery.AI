'use client'

import { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmeryStoreProvider } from '@/contexts/EmeryStoreProvider'
import { CreateDatabaseDialog } from '@/app/(app)/data/components/CreateDatabaseDialog'
import { CreateTableDialog } from '@/app/(app)/data/components/CreateTableDialog'
import { useEmeryStore } from '@/contexts/EmeryStoreProvider'
import { useStore } from '@tanstack/react-store'
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store'
import { storeActions } from '@/stores/actions'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LayoutProvider } from '@/components/layout/LayoutProvider'
import { EmeryLayout } from '@/components/layout/EmeryLayout'
import { ArtifactProvider } from '@/contexts/ArtifactContext'

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
        onClose={() => storeActions.closeTableForm()}
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
  chatContext?: import('@/components/layout/types').ChatContextConfig
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
  const { createChatContextForPage } = require('@/components/layout/types')
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
            <ArtifactProvider>
              <EmeryLayout enableChat={enableChat} chatContext={effectiveChatContext}>
                {children}
              </EmeryLayout>
              <DataDialogs />
            </ArtifactProvider>
          </LayoutProvider>
        </EmeryStoreProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
