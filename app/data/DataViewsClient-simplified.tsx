"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Plus, Search, TableIcon as Table, Database } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { DynamicDataTable } from "./components/DynamicDataTable"
import { FieldManagerDialog } from "./components/FieldManagerDialog"
import { useEmeryData, EmeryTable } from "@/hooks/useEmeryData"
import { getFields } from "@/app/actions/fields"
import { getRowsData, createRow, updateRowData, deleteRowData } from "@/app/actions/rows"
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field"
import type { Row } from "@/ddd/domain/tables/value-objects/row"

export function DataViewsClientSimplified() {
  const searchParams = useSearchParams()
  const { data, isLoading: dataLoading, error: dataError } = useEmeryData()
  
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
  // Dialog states now handled globally
  const [searchTerm, setSearchTerm] = useState("")
  
  // Table data state
  const [fields, setFields] = useState<TableField[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTable = selectedTableId ? findTableById(selectedTableId) : undefined

  // Update selected table when URL changes
  useEffect(() => {
    const tableId = tableIdParam ? parseInt(tableIdParam) : undefined;
    setSelectedTableId(tableId);
  }, [tableIdParam]);

  // Load table data when table is selected
  useEffect(() => {
    if (selectedTableId) {
      loadTableData(selectedTableId)
    }
  }, [selectedTableId])

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

  const handleUpdateRow = async (rowId: string, fieldId: number, value: any) => {
    if (!selectedTableId) return

    try {
      // Find the field to get its slug
      const field = fields.find(f => f.id.value === fieldId)
      if (!field) {
        console.error('Field not found for fieldId:', fieldId)
        return
      }

      await updateRowData({
        tableId: selectedTableId,
        rowId,
        data: { [field.name]: value },
      });
      setRows(prevRows =>
        prevRows.map(row =>
          row.id.value === rowId ? { ...row, [`field_${field.id.value}`]: value } : row
        )
      );
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
              rowData[field.name] = 0
              break
            case 'boolean':
              rowData[field.name] = false
              break
            case 'date':
              rowData[field.name] = new Date().toISOString().split('T')[0]
              break
            default:
              rowData[field.name] = ""
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

  // Data structure creation handled globally

  const refreshTableData = async () => {
    if (selectedTableId) {
      await loadTableData(selectedTableId)
    }
  }

  // Filter rows based on search
  const filteredRows = rows.filter((row: Row) => {
    if (!searchTerm) return true
    const rowData = row.toPlainObject();
    return Object.values(rowData).some(value => 
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
              ? "Create your first database and table to get started using the sidebar." 
              : "Select a table from the sidebar to view its data."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table className="w-16 h-16 mx-auto text-muted-foreground" />
          <div className="flex gap-2 justify-center">
            <p className="text-xs text-muted-foreground">
              Use the + Database and + Table buttons in the sidebar to get started.
            </p>
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
    <div className="h-full flex flex-col">
      <div className="py-4 px-6 border-b">
        <h1 className="text-2xl font-bold">Data</h1>
        <p className="text-muted-foreground">
          {selectedTable 
            ? `Viewing ${selectedTable.name} in ${selectedTable.database?.name || 'Unknown Database'}`
            : 'Select a table from the sidebar to view its data'
          }
        </p>
      </div>
      
      <div className="flex-1 flex flex-col px-6">
        {selectedTable && (
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search in table..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-transparent">
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
                  organizationId={selectedTable.organizationId!}
                  tableId={selectedTable.id}
                  onUpdateRow={handleUpdateRow}
                  onAddRow={handleAddRow}
                  onDeleteRow={handleDeleteRow}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Field Manager Dialog - local to table */}
      {selectedTable && (
        <FieldManagerDialog
          isOpen={isFieldManagerOpen}
          onClose={() => setIsFieldManagerOpen(false)}
          tableId={selectedTable.id}
          fields={fields}
          onFieldsUpdated={refreshTableData}
        />
      )}
    </div>
  )
}
