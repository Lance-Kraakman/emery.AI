"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Plus, Search, TableIcon as Table } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { DynamicDataTable } from "./components/DynamicDataTable"
import { FieldManagerDialog } from "./components/FieldManagerDialog"
import { CreateTableDialog } from "./components/CreateTableDialog"
import { CreateDatabaseDialog } from "./components/CreateDatabaseDialog"
import { getTables } from "@/app/actions/tables"
import { getFields } from "@/app/actions/fields"
import { getRowsData, createRow, updateRowData, deleteRowData } from "@/app/actions/rows"

interface TableData {
  id: number
  name: string
  dbName: string
  organizationId: number
  createdBy: string
  createdAt: Date | null
  updatedAt: Date | null
}

interface FieldData {
  id: number
  tableId: number
  name: string
  slug: string
  type: string
  required: boolean | null
  orderIndex: number | null
  relatedTableId?: number | null
}

interface RowData {
  id: string
  [key: string]: any
}

export function DataViewsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tableIdParam = searchParams.get("tableId")
  const initialTableId = tableIdParam ? parseInt(tableIdParam) : undefined

  // UI state
  const [selectedTableId, setSelectedTableId] = useState<number | undefined>(initialTableId)
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false)
  const [isCreateDatabaseOpen, setIsCreateDatabaseOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Data state
  const [tables, setTables] = useState<TableData[]>([])
  const [fields, setFields] = useState<FieldData[]>([])
  const [rows, setRows] = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedTable = tables.find(t => t.id === selectedTableId)

  // Load tables on mount
  useEffect(() => {
    let isMounted = true
    
    const loadTables = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const tableList = await getTables()
        
        if (isMounted) {
          setTables(tableList)
          
          // Auto-select table from URL if provided
          if (initialTableId && tableList.find(t => t.id === initialTableId)) {
            setSelectedTableId(initialTableId)
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading tables:', err)
          setError(err instanceof Error ? err.message : "Failed to load tables")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadTables()
    
    return () => {
      isMounted = false
    }
  }, [initialTableId])

  // Load table data when selected table changes
  useEffect(() => {
    let isMounted = true
    
    if (selectedTableId) {
      const loadTableData = async () => {
        try {
          setLoading(true)
          setError(null)
          
          const [fieldList, rowList] = await Promise.all([
            getFields(selectedTableId),
            getRowsData(selectedTableId, 1000)
          ])
          
          if (isMounted) {
            setFields(fieldList)
            setRows(rowList)
          }
        } catch (err) {
          if (isMounted) {
            console.error('Error loading table data:', err)
            setError(err instanceof Error ? err.message : "Failed to load table data")
          }
        } finally {
          if (isMounted) {
            setLoading(false)
          }
        }
      }

      loadTableData()
    } else {
      if (isMounted) {
        setFields([])
        setRows([])
        setLoading(false)
      }
    }
    
    return () => {
      isMounted = false
    }
  }, [selectedTableId])

  // Handlers
  const handleTableSelect = (tableId: number) => {
    setSelectedTableId(tableId)
    router.push(`/data?tableId=${tableId}`)
  }

  const handleUpdateRow = async (rowId: string, fieldId: number, value: any) => {
    if (!selectedTableId) return
    
    try {
      const field = fields.find(f => f.id === fieldId)
      if (!field) return

      await updateRowData({
        tableId: selectedTableId,
        rowId,
        data: { [field.slug]: value }
      })

      // Optimistic update
      setRows(prevRows => 
        prevRows.map(row => 
          row.id === rowId 
            ? { ...row, [`field_${fieldId}`]: value }
            : row
        )
      )
    } catch (err) {
      console.error("Failed to update row:", err)
    }
  }

  const handleAddRow = async () => {
    if (!selectedTableId) return

    try {
      const rowData: Record<string, any> = {}
      fields.forEach(field => {
        if (field.required) {
          switch (field.type) {
            case 'text':
            case 'email':
            case 'url':
              rowData[field.slug] = ""
              break
            case 'number':
              rowData[field.slug] = 0
              break
            case 'boolean':
              rowData[field.slug] = false
              break
            case 'date':
              rowData[field.slug] = new Date().toISOString().split('T')[0]
              break
            default:
              rowData[field.slug] = ""
          }
        }
      })

      const result = await createRow({ tableId: selectedTableId, data: rowData })
      
      if (result.success && result.data) {
        setRows(prevRows => [...prevRows, result.data])
      }
    } catch (err) {
      console.error("Failed to add row:", err)
    }
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!selectedTableId) return

    try {
      await deleteRowData(selectedTableId, rowId)
      setRows(prevRows => prevRows.filter(row => row.id !== rowId))
    } catch (err) {
      console.error("Failed to delete row:", err)
    }
  }

  const handleTableCreated = async () => {
    try {
      const tableList = await getTables()
      setTables(tableList)
    } catch (err) {
      console.error("Failed to refresh tables:", err)
    }
  }

  const refreshTableData = async () => {
    if (selectedTableId) {
      try {
        setLoading(true)
        const [fieldList, rowList] = await Promise.all([
          getFields(selectedTableId),
          getRowsData(selectedTableId, 1000)
        ])
        setFields(fieldList)
        setRows(rowList)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to refresh table data")
      } finally {
        setLoading(false)
      }
    }
  }

  // Render helpers
  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Welcome to Data</CardTitle>
          <CardDescription>
            {tables.length === 0 
              ? "Create your first table to get started." 
              : "Select a table from the dropdown to view its data."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table className="w-16 h-16 mx-auto text-muted-foreground" />
          {tables.length === 0 && (
            <>
              <Button onClick={() => setIsCreateTableOpen(true)} className="mr-2">
                <Plus className="h-4 w-4 mr-2" />
                Create Table
              </Button>
              <Button onClick={() => setIsCreateDatabaseOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Database
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderLoadingState = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    </div>
  )

  const renderErrorState = () => (
    <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  // Filter rows based on search
  const filteredRows = rows.filter((row: RowData) => {
    if (!searchTerm) return true
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="py-4 px-6 border-b bg-background">
          <h1 className="text-2xl font-bold">Data</h1>
          <p className="text-muted-foreground">View and manage your table data</p>
        </div>
        
        <div className="flex-1 flex flex-col px-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between py-4 border-b">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsCommandPaletteOpen(true)}>
                <Table className="h-4 w-4 mr-2" />
                {selectedTable ? selectedTable.name : "Select Table"}
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search in table..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {selectedTable && (
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setIsFieldManagerOpen(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Fields
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleAddRow}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Row
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={refreshTableData}>
                      Refresh Data
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsCreateTableOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Table
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsCreateDatabaseOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Database
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col pt-4 min-h-0">
            {loading ? renderLoadingState() : 
             error ? renderErrorState() :
             !selectedTable ? renderEmptyState() : (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-bold">{selectedTable.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""}
                    {searchTerm && ` (filtered from ${rows.length})`}
                  </p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <DynamicDataTable
                    fields={fields}
                    rows={filteredRows}
                    onUpdateRow={handleUpdateRow}
                    onAddRow={handleAddRow}
                    onDeleteRow={handleDeleteRow}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {selectedTable && (
        <FieldManagerDialog
          isOpen={isFieldManagerOpen}
          onClose={() => setIsFieldManagerOpen(false)}
          tableId={selectedTable.id}
          fields={fields}
          onFieldsUpdated={refreshTableData}
        />
      )}
      
      <CommandDialog open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen}>
        <CommandInput placeholder="Search for a table..." />
        <CommandList>
          <CommandEmpty>No tables found.</CommandEmpty>
          <CommandGroup heading="Tables">
            {tables.map(table => (
              <CommandItem key={table.id} onSelect={() => {
                handleTableSelect(table.id)
                setIsCommandPaletteOpen(false)
              }}>
                <Table className="h-4 w-4 mr-2" />
                {table.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <CreateTableDialog
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        onTableCreated={handleTableCreated}
      />
      
      <CreateDatabaseDialog
        isOpen={isCreateDatabaseOpen}
        onClose={() => setIsCreateDatabaseOpen(false)}
        onDatabaseCreated={handleTableCreated}
      />
    </div>
  )
}