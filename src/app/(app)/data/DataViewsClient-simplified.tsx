"use client"

import React, { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Plus, Search, TableIcon as Table, Database } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { DynamicDataTable } from "./components/DynamicDataTable"
import { FieldManagerDialog } from "./components/FieldManagerDialog"
import { useEmery } from "@/contexts/EmeryStoreProvider"
import { dataStore, dataSelectors } from '@/stores/data-management.store'
import { storeActions, dataActions } from '@/stores/actions'
import type { TableDTO } from "@/app/mappers/table-mapper"
import { getFields } from "@/app/actions/fields"
import { getRowsData, createRow, updateRowData, deleteRowData } from "@/app/actions/rows"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { RowDTO } from "@/app/mappers/row-mapper"
import type { FieldValue as DomainFieldValue } from "@/ddd/domain/tables/value-objects/field-values"

export function DataViewsClientSimplified() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { data, isLoading: dataLoading, error: dataError } = useEmery()
  
  const tableIdParam = searchParams?.get("tableId")
  const initialTableId = tableIdParam ? parseInt(tableIdParam) : undefined

  // Find the initial table across all databases
  const findTableById = (id: number): TableDTO | undefined => {
    for (const database of (data?.databases || [])) {
      const table = database.tables.find(t => t.id === id)
      if (table) return table
    }
    return undefined
  }

  // Use TanStack Store for data management state
  const selectedTableId = useStore(dataStore, dataSelectors.selectedTableId)
  const isFieldManagerOpen = useStore(dataStore, dataSelectors.isFieldManagerOpen)
  const searchTerm = useStore(dataStore, dataSelectors.searchTerm)
  
  // Initialize with URL parameter
  useEffect(() => {
    if (initialTableId && !selectedTableId) {
      dataActions.setSelectedTable(initialTableId)
    }
  }, [initialTableId, selectedTableId])

  const selectedTable = selectedTableId ? findTableById(selectedTableId) : undefined

  // Update selected table when URL changes
  useEffect(() => {
    const tableId = tableIdParam ? parseInt(tableIdParam) : undefined;
    dataActions.setSelectedTable(tableId);
  }, [tableIdParam]);

  // TanStack Query for fields
  const fieldsQuery = useQuery({
    queryKey: ['fields', selectedTableId],
    queryFn: () => selectedTableId ? getFields(selectedTableId) : Promise.resolve([]),
    enabled: !!selectedTableId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // TanStack Query for rows  
  const rowsQuery = useQuery({
    queryKey: ['rows', selectedTableId],
    queryFn: () => selectedTableId ? getRowsData(selectedTableId, 1000) : Promise.resolve([]),
    enabled: !!selectedTableId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const fields = fieldsQuery.data || []
  const rows = rowsQuery.data || []
  const loading = fieldsQuery.isLoading || rowsQuery.isLoading
  const error = fieldsQuery.error || rowsQuery.error

  // TanStack Mutations for optimistic updates
  const updateRowMutation = useMutation({
    mutationFn: async ({ rowId, fieldId, value }: { rowId: string, fieldId: number, value: DomainFieldValue }) => {
      if (!selectedTableId) throw new Error('No table selected')
      
      const field = fields.find(f => f.id === fieldId)
      if (!field) throw new Error('Field not found')

      return updateRowData({
        tableId: selectedTableId,
        rowId,
        data: { [field.name]: value },
      });
    },
    onMutate: async ({ rowId, fieldId, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['rows', selectedTableId] })
      
      // Snapshot the previous value
      const previousRows = queryClient.getQueryData(['rows', selectedTableId])
      
      // Find the field to get its info
      const field = fields.find(f => f.id === fieldId)
      if (!field) return { previousRows }

      // Optimistically update the cache
      queryClient.setQueryData(['rows', selectedTableId], (oldRows: RowDTO[] | undefined) => {
        if (!oldRows) return []
        return oldRows.map(row => {
          if (row.id === rowId) {
            const updatedFieldValues = [...row.fieldValues].map(fv =>
              fv.fieldSlug === field.name 
                ? { fieldSlug: field.name, value, fieldType: field.type }
                : fv
            );
            const hasField = row.fieldValues.some(fv => fv.fieldSlug === field.name);
            if (!hasField) {
              updatedFieldValues.push({ fieldSlug: field.name, value, fieldType: field.type });
            }
            return { ...row, fieldValues: updatedFieldValues };
          }
          return row;
        })
      })

      return { previousRows }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRows) {
        queryClient.setQueryData(['rows', selectedTableId], context.previousRows)
      }
      console.error("Failed to update row:", err)
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['rows', selectedTableId] })
    },
  })

  const addRowMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTableId) throw new Error('No table selected')
      
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

      return createRow({ tableId: selectedTableId, data: rowData })
    },
    onSuccess: (result) => {
      if (result.success && result.data) {
        queryClient.setQueryData(['rows', selectedTableId], (oldRows: RowDTO[] | undefined) => {
          return oldRows ? [...oldRows, result.data] : [result.data]
        })
      }
    },
    onError: (err) => {
      console.error("Failed to add row:", err)
    },
  })

  const deleteRowMutation = useMutation({
    mutationFn: async (rowId: string) => {
      if (!selectedTableId) throw new Error('No table selected')
      return deleteRowData(selectedTableId, rowId)
    },
    onMutate: async (rowId) => {
      await queryClient.cancelQueries({ queryKey: ['rows', selectedTableId] })
      const previousRows = queryClient.getQueryData(['rows', selectedTableId])
      
      queryClient.setQueryData(['rows', selectedTableId], (oldRows: RowDTO[] | undefined) => {
        return oldRows ? oldRows.filter(row => row.id !== rowId) : []
      })

      return { previousRows }
    },
    onError: (err, variables, context) => {
      if (context?.previousRows) {
        queryClient.setQueryData(['rows', selectedTableId], context.previousRows)
      }
      console.error("Failed to delete row:", err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rows', selectedTableId] })
    },
  })

  const handleUpdateRow = (rowId: string, fieldId: number, value: DomainFieldValue) => {
    updateRowMutation.mutate({ rowId, fieldId, value })
  }

  const handleAddRow = () => {
    addRowMutation.mutate()
  }

  const handleDeleteRow = (rowId: string) => {
    deleteRowMutation.mutate(rowId)
  }

  // Refresh data using TanStack Query invalidation
  const refreshTableData = () => {
    if (selectedTableId) {
      queryClient.invalidateQueries({ queryKey: ['fields', selectedTableId] })
      queryClient.invalidateQueries({ queryKey: ['rows', selectedTableId] })
    }
  }

  // Filter rows based on search
  const filteredRows = rows.filter((row: RowDTO) => {
    if (!searchTerm) return true
    // Convert fieldValues to searchable format
    const searchableValues = row.fieldValues.map(fv => String(fv.value));
    searchableValues.push(row.id); // Include row ID in search
    return searchableValues.some(value => 
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  })

  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Welcome to Data</CardTitle>
          <CardDescription>
            {(data?.databases || []).length === 0
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
          <CardDescription>
            {typeof dataError === 'object' && dataError && 'message' in dataError ? (dataError as Error).message : 
             typeof dataError === 'string' ? dataError :
             typeof error === 'object' && error && 'message' in error ? (error as Error).message :
             typeof error === 'string' ? error : 'An error occurred'}
          </CardDescription>
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
            ? `Viewing ${selectedTable.name} in ${(data?.databases || []).find(db => db.id === selectedTable.databaseId)?.name || 'Unknown Database'}`
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
                  onChange={(e) => dataActions.setSearchTerm(e.target.value)}
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
                  <DropdownMenuItem onClick={() => dataActions.setFieldManagerOpen(true)}>
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
          onClose={() => dataActions.setFieldManagerOpen(false)}
          tableId={selectedTable.id}
          fields={fields}
          onFieldsUpdated={refreshTableData}
        />
      )}
    </div>
  )
}
