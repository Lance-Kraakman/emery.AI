'use client'

import { EmerySidebar } from '@/components/EmerySidebar'
import { Suspense } from 'react'
import { DataDialogsProvider } from '@/contexts/DataDialogsContext'
import { CreateDatabaseDialog } from '@/app/data/components/CreateDatabaseDialog'
import { CreateTableDialog } from '@/app/data/components/CreateTableDialog'
import { useDataDialogs } from '@/contexts/DataDialogsContext'
import { useEmeryData } from '@/hooks/useEmeryData'

function DataDialogs() {
  const { 
    isCreateDatabaseOpen, 
    setIsCreateDatabaseOpen,
    isCreateTableOpen, 
    setIsCreateTableOpen,
    selectedDatabaseForTable,
    setSelectedDatabaseForTable 
  } = useDataDialogs()
  const { refetch } = useEmeryData()
  
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
}

export function EmeryProviders({ children }: EmeryProvidersProps) {
  return (
    <DataDialogsProvider>
      <div className="flex h-screen overflow-hidden">
        <Suspense fallback={<div className="w-64 bg-card border-r border-border" />}>
          <EmerySidebar />
        </Suspense>
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {children}
        </main>
        <DataDialogs />
      </div>
    </DataDialogsProvider>
  )
}
