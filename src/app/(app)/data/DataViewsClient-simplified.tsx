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
import { DynamicDataSheetGrid } from "./components/DynamicDataSheetGrid"
import { FieldManagerDialog } from "./components/FieldManagerDialog"
import { useEmery } from "@/contexts/EmeryStoreProvider"
import { dataStore, dataSelectors } from '@/stores/data-management.store'
import { storeActions, dataActions } from '@/stores/actions'
import type { TableDTO } from "@/app/mappers/table-mapper"
import { getFields } from "@/app/actions/fields"
import { getRowsDataDSG, createRow, updateRowData, deleteRowData } from "@/app/actions/rows"
import type { FieldValue as DomainFieldValue } from "@/ddd/domain/tables/value-objects/field-values"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { DSGRow } from "@/app/mappers/dsg-mapper"

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
  const rowsQuery = useQuery<DSGRow[]>({
    queryKey: ['rows', selectedTableId],
    queryFn: () => selectedTableId ? getRowsDataDSG(selectedTableId, 1000) : Promise.resolve([]),
    enabled: !!selectedTableId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const fields: FieldDTO[] = fieldsQuery.data || []
  const rows: DSGRow[] = rowsQuery.data || []

  const loading = fieldsQuery.isLoading || rowsQuery.isLoading
  const error = fieldsQuery.error || rowsQuery.error

  // TanStack Mutations for optimistic updates
  const updateRowMutation = useMutation({
    // Built-in columns (textColumn, floatColumn, etc.) handle normalization automatically
    // Values from grid are already in correct format - no custom normalization needed
    mutationFn: async ({ rowId, fieldId, value }: { rowId: string, fieldId: number, value: DomainFieldValue }) => {
      if (!selectedTableId) throw new Error('No table selected')

      const field = fields.find(f => f.id === fieldId)
      if (!field) throw new Error('Field not found')

      return updateRowData({
        tableId: selectedTableId,
        rowId,
        data: { [field.name]: value },
      })
    },
    onMutate: async ({ rowId, fieldId, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['rows', selectedTableId] })

      // Snapshot the previous value
      const previousRows = queryClient.getQueryData(['rows', selectedTableId])

      // Find the field to get its info
      const field = fields.find(f => f.id === fieldId)
      if (!field) return { previousRows }

      // Optimistically update the cache with the value from built-in column
      queryClient.setQueryData(['rows', selectedTableId], (oldRows: any[] | undefined) => {
        if (!oldRows) return []
        return oldRows.map(row => {
          if (row.id === rowId) {
            return {
              ...row,
              [field.name]: value
            }
          }
          return row
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
      // Don't automatically refetch - let the optimistic update persist
      // This prevents race conditions where the server data overwrites the correct UI state
      // Users can manually refresh if needed
      // queryClient.invalidateQueries({ queryKey: ['rows', selectedTableId] })
    },
  })

  const addRowMutation = useMutation({
    mutationFn: async (initialData?: Record<string, any>) => {
      if (!selectedTableId) throw new Error('No table selected')

      const rowData: Record<string, any> = initialData || {}

      // Only add defaults for optional (non-required) fields
      // Required fields are left undefined so domain validation can enforce them
      fields.forEach(field => {
        if (rowData[field.name] === undefined && !field.required) {
          switch (field.type) {
            case 'number':
              rowData[field.name] = null
              break
            case 'boolean':
              rowData[field.name] = false
              break
            case 'date':
              rowData[field.name] = null
              break
            case 'text':
              rowData[field.name] = ""
              break
          }
        }
      })

      return createRow({ tableId: selectedTableId, data: rowData })
    },
    onSuccess: (result) => {
      if (result.success && result.data) {
        // Convert the returned RowDTO to DSG format for the cache
        const dsgRow = {
          id: result.data.id,
          ...result.data.fieldValues.reduce((acc: Record<string, any>, fv: any) => {
            acc[fv.fieldSlug] = fv.value
            return acc
          }, {} as Record<string, any>)
        }
        
        queryClient.setQueryData(['rows', selectedTableId], (oldRows: any[] | undefined) => {
          return oldRows ? [...oldRows, dsgRow] : [dsgRow]
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
      
      queryClient.setQueryData(['rows', selectedTableId], (oldRows: any[] | undefined) => {
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

  const handleUpdateRow = async (rowId: string, fieldId: number, value: DomainFieldValue) => {
    // Use mutateAsync so callers (like the grid) can await the server write and react to errors.
    return updateRowMutation.mutateAsync({ rowId, fieldId, value })
  }

  const handleAddRow = async (initialData?: Record<string, any>): Promise<void> => {
    await addRowMutation.mutateAsync(initialData)
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

  // Filter rows based on search - DSG format
  const filteredRows: DSGRow[] = rows.filter((row) => {
    if (!searchTerm) return true
    // DSG format: flat object with field values directly
    const searchableValues = Object.keys(row)
      .filter(key => key !== 'id')
      .map(key => String(row[key] || ''))
    searchableValues.push(row.id) // Include row ID in search
    return searchableValues.some(value =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content - full width, no padding, no header */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {loading ? renderLoadingState() :
         error ? renderErrorState() :
         !selectedTable ? renderEmptyState() : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <DynamicDataSheetGrid
              fields={fields}
              rows={filteredRows}
              organizationId={selectedTable.organizationId!}
              tableId={selectedTable.id}
              tableName={selectedTable.name}
              searchTerm={searchTerm}
              onSearchChange={(value) => dataActions.setSearchTerm(value)}
              onManageFields={() => dataActions.setFieldManagerOpen(true)}
              onRefresh={refreshTableData}
              onUpdateRow={handleUpdateRow}
              onAddRow={handleAddRow}
              onDeleteRow={handleDeleteRow}
              isLoading={loading}
              error={error ? String(error) : null}
            />
          </div>
        )}
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
