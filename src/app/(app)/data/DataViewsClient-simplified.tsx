"use client"

import React, { useEffect, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
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
import { getRowsDataDSG, getRowsDataDSGPaginated, createRow, createRows, updateRowData, deleteRowData } from "@/app/actions/rows"
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

  // TanStack Infinite Query for rows (supports pagination)
  const infiniteRowsQuery = useInfiniteQuery({
    queryKey: ['rows-infinite', selectedTableId],
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      selectedTableId
        ? getRowsDataDSGPaginated(selectedTableId, 100, pageParam)
        : Promise.resolve({ rows: [], hasMore: false, total: 0 }),
    getNextPageParam: (lastPage: { rows: DSGRow[], hasMore: boolean, total: number }, allPages: any[]) => {
      if (!lastPage.hasMore) return undefined
      return allPages.length * 100 // Offset for next page
    },
    enabled: !!selectedTableId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  const fields: FieldDTO[] = fieldsQuery.data || []

  // Flatten all pages into single array
  const rows: DSGRow[] = useMemo(() => {
    return infiniteRowsQuery.data?.pages.flatMap((page: { rows: DSGRow[], hasMore: boolean, total: number }) => page.rows) ?? []
  }, [infiniteRowsQuery.data])

  const loading = fieldsQuery.isLoading || infiniteRowsQuery.isLoading
  const error = fieldsQuery.error || infiniteRowsQuery.error

  // Scroll handler for infinite scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const { scrollHeight, scrollTop, clientHeight } = target

    // Trigger load when within 300px of bottom
    if (
      scrollHeight - scrollTop - clientHeight < 300 &&
      !infiniteRowsQuery.isFetching &&
      infiniteRowsQuery.hasNextPage
    ) {
      infiniteRowsQuery.fetchNextPage()
    }
  }, [infiniteRowsQuery])

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
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['rows-infinite', selectedTableId] })

      // Snapshot the previous data for rollback
      const previousData = queryClient.getQueryData(['rows-infinite', selectedTableId])

      // Find the field to get its name
      const field = fields.find(f => f.id === fieldId)
      if (!field) return { previousData }

      // Optimistically update all pages in the infinite query
      queryClient.setQueryData(['rows-infinite', selectedTableId], (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            rows: page.rows.map((row: DSGRow) =>
              row.id === rowId ? { ...row, [field.name]: value } : row
            )
          }))
        }
      })

      return { previousData }
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(['rows-infinite', selectedTableId], context.previousData)
      }
      console.error("Failed to update row:", err)
    },
    onSettled: () => {
      // Don't invalidate - let optimistic update persist
      // Only refetch on errors (handled by onError rollback)
    },
  })

  const addRowsMutation = useMutation({
    mutationFn: async (rowsData: Record<string, any>[]) => {
      if (!selectedTableId) throw new Error('No table selected')

      // Apply field defaults to each row
      const processedRows = rowsData.map(initialData => {
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

        return rowData
      })

      return createRows({ tableId: selectedTableId, rows: processedRows })
    },
    onSettled: () => {
      // Invalidate infinite query to refetch with new rows
      queryClient.invalidateQueries({ queryKey: ['rows-infinite', selectedTableId] })
    },
    onError: (err) => {
      console.error("Failed to add rows:", err)
    },
  })

  const deleteRowMutation = useMutation({
    mutationFn: async (rowId: string) => {
      if (!selectedTableId) throw new Error('No table selected')
      return deleteRowData(selectedTableId, rowId)
    },
    onSettled: () => {
      // Invalidate infinite query to refetch without deleted row
      queryClient.invalidateQueries({ queryKey: ['rows-infinite', selectedTableId] })
    },
    onError: (err) => {
      console.error("Failed to delete row:", err)
    },
  })

  const handleUpdateRow = async (rowId: string, fieldId: number, value: DomainFieldValue) => {
    // Use mutateAsync so callers (like the grid) can await the server write and react to errors.
    return updateRowMutation.mutateAsync({ rowId, fieldId, value })
  }

  const handleAddRows = async (rowsData: Record<string, any>[]): Promise<void> => {
    await addRowsMutation.mutateAsync(rowsData)
  }

  const handleDeleteRow = (rowId: string) => {
    deleteRowMutation.mutate(rowId)
  }

  // Refresh data using TanStack Query invalidation
  const refreshTableData = () => {
    if (selectedTableId) {
      queryClient.invalidateQueries({ queryKey: ['fields', selectedTableId] })
      queryClient.invalidateQueries({ queryKey: ['rows-infinite', selectedTableId] })
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
              onAddRows={handleAddRows}
              onDeleteRow={handleDeleteRow}
              onScroll={handleScroll}
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
