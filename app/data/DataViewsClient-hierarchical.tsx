"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Plus, Search, TableIcon as Table, Database, ChevronDown, ChevronRight } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { DynamicDataTable } from "./components/DynamicDataTable"
import { FieldManagerDialog } from "./components/FieldManagerDialog"
import { CreateTableDialog } from "./components/CreateTableDialog"
import { CreateDatabaseDialog } from "./components/CreateDatabaseDialog"
import { useEmeryData, EmeryTable } from "@/hooks/useEmeryData"
import { getFields } from "@/app/actions/fields"
import { getRowsData, createRow, updateRowData, deleteRowData } from "@/app/actions/rows"

interface FieldData {
  id: number
  tableId: number
  name: string
  slug: string
  type: string
  required: boolean
  orderIndex: number
  relatedTableId?: number
}

interface RowData {
  id: string
  [key: string]: any
}

export function DataViewsClientHierarchical() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data, isLoading: dataLoading, error: dataError, refetch } = useEmeryData()
  
  const tableIdParam = searchParams.get("tableId")
  const initialTableId = tableIdParam ? parseInt(tableIdParam) : undefined

  // Find the initial table across all databases
  const findTableById = (id: number): EmeryTable | undefined => {
    for (const database of data.databases) {
      const table = database.tables.find(t => t.id === id)
      if (table) return table
    }
    return undefined
  }

  // UI state
  const [selectedTableId, setSelectedTableId] = useState<number | undefined>(initialTableId)
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false)
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false)
  const [isCreateDatabaseOpen, setIsCreateDatabaseOpen] = useState(false)
  const [selectedDatabaseForTable, setSelectedDatabaseForTable] = useState<number | undefined>()
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedDatabases, setExpandedDatabases] = useState<Set<number>>(new Set())
  
  // Table data state
  const [fields, setFields] = useState<FieldData[]>([])
  const [rows, setRows] = useState<RowData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTable = selectedTableId ? findTableById(selectedTableId) : undefined

  // Auto-expand database containing selected table
  useEffect(() => {
    if (selectedTable) {
      setExpandedDatabases(prev => new Set([...prev, selectedTable.databaseId]))
    }
  }, [selectedTable])

  // Load table data when table is selected
  useEffect(() => {
    if (selectedTableId) {
      loadTableData(selectedTableId)
      // Update URL
      const newUrl = `/data?tableId=${selectedTableId}`
      router.replace(newUrl, { scroll: false })
    }
  }, [selectedTableId, router])

  const loadTableData = async (tableId: number) => {
    try {
      setLoading(true)
      setError(null)
      
      const [fieldList, rowList] = await Promise.all([
        getFields(tableId),
        getRowsData(tableId, 1000)
      ])
      
      setFields(fieldList)
      setRows(rowList)
    } catch (err) {
      console.error('Error loading table data:', err)
      setError(err instanceof Error ? err.message : "Failed to load table data")
    } finally {
      setLoading(false)
    }
  }

  const handleTableSelect = (tableId: number) => {
    setSelectedTableId(tableId)
  }

  const handleUpdateRow = async (rowId: string, field: FieldData, value: any) => {
    if (!selectedTableId) return

    try {
      await updateRowData(selectedTableId, rowId, { [field.slug]: value })
      setRows(prevRows => 
        prevRows.map(row => 
          row.id === rowId ? { ...row, [field.slug]: value } : row
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
        if (field.required || field.type === 'text') {
          switch (field.type) {
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

  const handleDataStructureCreated = () => {
    refetch()
  }

  const refreshTableData = async () => {
    if (selectedTableId) {
      await loadTableData(selectedTableId)
    }
  }

  const toggleDatabaseExpanded = (databaseId: number) => {
    setExpandedDatabases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(databaseId)) {
        newSet.delete(databaseId)
      } else {
        newSet.add(databaseId)
      }
      return newSet
    })
  }

  const handleCreateTableClick = (databaseId?: number) => {
    setSelectedDatabaseForTable(databaseId)
    setIsCreateTableOpen(true)
  }

  // Filter rows based on search
  const filteredRows = rows.filter((row: RowData) => {
    if (!searchTerm) return true
    return Object.values(row).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Welcome to Data</CardTitle>
          <CardDescription>
            {data.databases.length === 0 
              ? "Create your first database and table to get started." 
              : "Select a table from the hierarchy to view its data."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table className="w-16 h-16 mx-auto text-muted-foreground" />
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setIsCreateDatabaseOpen(true)} variant="outline">
              <Database className="h-4 w-4 mr-2" />
              Create Database
            </Button>
            {data.databases.length > 0 && (
              <Button onClick={() => handleCreateTableClick()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Table
              </Button>
            )}
          </div>
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
          <CardDescription>{dataError || error}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )

  if (dataLoading) return renderLoadingState()
  if (dataError) return renderErrorState()

  return (
    <div className="h-full flex">
      {/* Sidebar with Database → Table Hierarchy */}
      <div className="w-80 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Database Structure</h2>
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setIsCreateDatabaseOpen(true)}
                title="Create Database"
              >
                <Database className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleCreateTableClick()}
                disabled={data.databases.length === 0}
                title="Create Table"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {data.databases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No databases yet</p>
              <p className="text-xs">Create one to get started</p>
            </div>
          ) : (
            data.databases.map(database => {
              const isExpanded = expandedDatabases.has(database.id)
              return (
                <Collapsible 
                  key={database.id} 
                  open={isExpanded}
                  onOpenChange={() => toggleDatabaseExpanded(database.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer group">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Database className="h-4 w-4" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {database.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {database.tables.length}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCreateTableClick(database.id)
                        }}
                        title="Add table to this database"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 space-y-1">
                      {database.tables.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2 px-2">
                          No tables yet
                        </div>
                      ) : (
                        database.tables.map(table => (
                          <div
                            key={table.id}
                            onClick={() => handleTableSelect(table.id)}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm hover:bg-muted/50 ${
                              selectedTableId === table.id ? 'bg-primary/10 text-primary border border-primary/20' : ''
                            }`}
                          >
                            <Table className="h-4 w-4" />
                            <span className="flex-1 truncate">{table.name}</span>
                            {table.metadata?.description && (
                              <div 
                                className="w-2 h-2 bg-blue-500 rounded-full" 
                                title="Has description"
                              />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="py-4 px-6 border-b bg-background">
          <h1 className="text-2xl font-bold">Data</h1>
          <p className="text-muted-foreground">
            {selectedTable 
              ? `Viewing ${selectedTable.name} in ${selectedTable.database?.name || 'Unknown Database'}`
              : 'Select a table from the hierarchy to view its data'
            }
          </p>
        </div>
        
        <div className="flex-1 flex flex-col px-6">
          {selectedTable && (
            <div className="flex items-center justify-between py-4 border-b">
              <div className="flex items-center gap-2">
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

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
      
      <CreateTableDialog
        isOpen={isCreateTableOpen}
        onClose={() => {
          setIsCreateTableOpen(false)
          setSelectedDatabaseForTable(undefined)
        }}
        onTableCreated={handleDataStructureCreated}
        selectedDatabaseId={selectedDatabaseForTable}
      />
      
      <CreateDatabaseDialog
        isOpen={isCreateDatabaseOpen}
        onClose={() => setIsCreateDatabaseOpen(false)}
        onDatabaseCreated={handleDataStructureCreated}
      />
    </div>
  )
}