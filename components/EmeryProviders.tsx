'use client'

import { Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DataDialogsProvider } from '@/contexts/DataDialogsContext'
import { EmeryProvider } from '@/contexts/EmeryContext'
import { CreateDatabaseDialog } from '@/app/(app)/data/components/CreateDatabaseDialog'
import { CreateTableDialog } from '@/app/(app)/data/components/CreateTableDialog'
import { useDataDialogs } from '@/contexts/DataDialogsContext'
import { useEmery } from '@/contexts/EmeryContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LayoutProvider } from '@/components/layout/LayoutProvider'
import { EmeryLayout } from '@/components/layout/EmeryLayout'

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
  const { 
    isCreateDatabaseOpen, 
    setIsCreateDatabaseOpen,
    isCreateTableOpen, 
    setIsCreateTableOpen,
    selectedDatabaseForTable,
    setSelectedDatabaseForTable 
  } = useDataDialogs()
  const { refetch } = useEmery()
  
  const handleDataStructureCreated = () => {
    refetch()
  }

  return (
    <>
      <CreateDatabaseDialog
        isOpen={isCreateDatabaseOpen}
        onClose={() => setIsCreateDatabaseOpen(false)}
        onDatabaseCreated={handleDataStructureCreated}
      />
      
      <CreateTableDialog
        isOpen={isCreateTableOpen}
        onClose={() => {
          setIsCreateTableOpen(false)
          setSelectedDatabaseForTable(undefined)
        }}
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
        <EmeryProvider>
          <DataDialogsProvider>
            <LayoutProvider>
              <EmeryLayout enableChat={enableChat} chatContext={effectiveChatContext}>
                {children}
              </EmeryLayout>
              <DataDialogs />
            </LayoutProvider>
          </DataDialogsProvider>
        </EmeryProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
