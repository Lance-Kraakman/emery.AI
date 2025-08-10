"use client"

import { createContext, useContext, useState, ReactNode } from 'react'

interface DataDialogsContextType {
  isCreateDatabaseOpen: boolean
  setIsCreateDatabaseOpen: (open: boolean) => void
  isCreateTableOpen: boolean
  setIsCreateTableOpen: (open: boolean) => void
  selectedDatabaseForTable?: number
  setSelectedDatabaseForTable: (databaseId?: number) => void
}

const DataDialogsContext = createContext<DataDialogsContextType | undefined>(undefined)

export function DataDialogsProvider({ children }: { children: ReactNode }) {
  const [isCreateDatabaseOpen, setIsCreateDatabaseOpen] = useState(false)
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false)
  const [selectedDatabaseForTable, setSelectedDatabaseForTable] = useState<number | undefined>()

  return (
    <DataDialogsContext.Provider value={{
      isCreateDatabaseOpen,
      setIsCreateDatabaseOpen,
      isCreateTableOpen,
      setIsCreateTableOpen,
      selectedDatabaseForTable,
      setSelectedDatabaseForTable,
    }}>
      {children}
    </DataDialogsContext.Provider>
  )
}

export function useDataDialogs() {
  const context = useContext(DataDialogsContext)
  if (context === undefined) {
    throw new Error('useDataDialogs must be used within a DataDialogsProvider')
  }
  return context
}