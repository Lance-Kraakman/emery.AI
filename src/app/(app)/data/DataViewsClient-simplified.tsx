"use client"

import React, { useEffect, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { toast } from 'sonner'
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
import { getRowsDSG, searchRowsDSG, createRow, createRows, updateRowData, deleteRowData } from "@/app/actions/rows"
import { GRID_CONFIG } from "@/lib/constants/grid"
import { rowQueryKeys, fieldQueryKeys } from "@/lib/query-keys/rows"
import type { FilterConfig } from "@/lib/types/filters"
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
  const sortBy = useStore(dataStore, dataSelectors.sortBy)
  const activeFilters = useStore(dataStore, dataSelectors.activeFilters)

  // Clear filters when table changes
  useEffect(() => {
    if (selectedTableId) {
      dataActions.clearActiveFilters()
    }
  }, [selectedTableId])

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
    queryKey: selectedTableId ? fieldQueryKeys.all(selectedTableId) : ['fields', null],
    queryFn: () => selectedTableId ? getFields(selectedTableId) : Promise.resolve([]),
    enabled: !!selectedTableId,
    staleTime: GRID_CONFIG.FIELD_STALE_TIME,
  })

  // TanStack Infinite Query for rows (supports pagination)
  const infiniteRowsQuery = useInfiniteQuery({
    queryKey: selectedTableId
      ? rowQueryKeys.infinite(selectedTableId, sortBy, activeFilters ?? [])
      : ['rows', null, 'infinite'],
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      selectedTableId
        ? getRowsDSG(
            selectedTableId,
            GRID_CONFIG.PAGE_SIZE,
            pageParam,
            sortBy.field,
            (sortBy.order || 'asc') === 'asc' ? 'ASC' : 'DESC',
            activeFilters ?? []
          )
        : Promise.resolve({ rows: [], hasMore: false, total: 0 }),
    getNextPageParam: (lastPage: { rows: DSGRow[], hasMore: boolean, total: number }, allPages: any[]) => {
      if (!lastPage.hasMore) return undefined
      return allPages.length * GRID_CONFIG.PAGE_SIZE // Offset for next page
    },
    enabled: !!selectedTableId && !searchTerm, // Disable when searching
    staleTime: GRID_CONFIG.ROW_STALE_TIME,
  })

  // TanStack Query for server-side search
  const searchQuery = useQuery({
    queryKey: selectedTableId && searchTerm
      ? rowQueryKeys.search(selectedTableId, searchTerm)
      : ['rows', null, 'search'],
    queryFn: () =>
      selectedTableId && searchTerm
        ? searchRowsDSG(selectedTableId, searchTerm, 1000) // Higher limit for search results
        : Promise.resolve({ rows: [], total: 0 }),
    enabled: !!selectedTableId && !!searchTerm && searchTerm.trim().length > 0,
    staleTime: GRID_CONFIG.SEARCH_STALE_TIME,
  })

  const fields: FieldDTO[] = fieldsQuery.data || []

  // Use search results when searching, otherwise use paginated rows
  const rows: DSGRow[] = useMemo(() => {
    if (searchTerm && searchQuery.data?.rows) {
      return searchQuery.data.rows
    }
    return infiniteRowsQuery.data?.pages.flatMap((page: { rows: DSGRow[], hasMore: boolean, total: number }) => page.rows) ?? []
  }, [searchTerm, searchQuery.data, infiniteRowsQuery.data])

  // Get total count - from search results or from first page of infinite query
  const totalCount = useMemo(() => {
    if (searchTerm && searchQuery.data) {
      return searchQuery.data.total
    }
    // Get total from first page of infinite query
    return infiniteRowsQuery.data?.pages?.[0]?.total ?? 0
  }, [searchTerm, searchQuery.data, infiniteRowsQuery.data])

  // Separate initial loading from search loading to prevent table from disappearing during search
  const isInitialLoading = fieldsQuery.isLoading || infiniteRowsQuery.isLoading
  const isSearching = searchQuery.isLoading
  const loading = isInitialLoading || isSearching
  const error = fieldsQuery.error || infiniteRowsQuery.error || searchQuery.error

  // Scroll handler for infinite scroll - throttled for performance
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const { scrollHeight, scrollTop, clientHeight } = target

    // Trigger load when within threshold of bottom
    if (
      scrollHeight - scrollTop - clientHeight < GRID_CONFIG.SCROLL_THRESHOLD &&
      !infiniteRowsQuery.isFetching &&
      infiniteRowsQuery.hasNextPage
    ) {
      infiniteRowsQuery.fetchNextPage()
    }
  }, [infiniteRowsQuery])

  // Throttle scroll handler to max 100ms (10 times per second)
  const handleScrollThrottled = useMemo(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let lastRan = 0

    return (e: React.UIEvent<HTMLDivElement>) => {
      const now = Date.now()

      if (now - lastRan >= 100) {
        handleScroll(e)
        lastRan = now
      } else {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          handleScroll(e)
          lastRan = Date.now()
        }, 100 - (now - lastRan))
      }
    }
  }, [handleScroll])

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
      // Use EXACT query key with sortBy and activeFilters to match the infinite query
      const queryKey = selectedTableId
        ? rowQueryKeys.infinite(selectedTableId, sortBy, activeFilters ?? [])
        : ['rows', null, 'infinite']

      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous data for rollback (using exact key)
      const previousData = queryClient.getQueryData(queryKey)

      // Find the field to get its name
      const field = fields.find(f => f.id === fieldId)
      if (!field) return { previousData, queryKey }

      // Optimistically update all pages in the infinite query (using exact key)
      queryClient.setQueryData(queryKey, (old: any) => {
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

      return { previousData, queryKey }
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error (using exact key from context)
      if (context?.previousData && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
      console.error("Failed to update row:", err)
      toast.error("Failed to update cell", {
        description: err instanceof Error ? err.message : "An error occurred while updating the cell"
      })
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
    onSuccess: (data, variables) => {
      const rowCount = variables.length
      toast.success(`Added ${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`)
    },
    onSettled: () => {
      // Invalidate all row queries to refetch with new rows
      if (selectedTableId) {
        queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(selectedTableId) })
      }
    },
    onError: (err) => {
      console.error("Failed to add rows:", err)
      toast.error("Failed to add row", {
        description: err instanceof Error ? err.message : "An error occurred while adding the row"
      })
    },
  })

  const deleteRowMutation = useMutation({
    mutationFn: async (rowId: string) => {
      if (!selectedTableId) throw new Error('No table selected')
      return deleteRowData(selectedTableId, rowId)
    },
    onSuccess: () => {
      toast.success("Row deleted")
    },
    onSettled: () => {
      // Invalidate all row queries to refetch without deleted row
      if (selectedTableId) {
        queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(selectedTableId) })
      }
    },
    onError: (err) => {
      console.error("Failed to delete row:", err)
      toast.error("Failed to delete row", {
        description: err instanceof Error ? err.message : "An error occurred while deleting the row"
      })
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

  // Filter handlers - use store actions
  const handleAddFilter = (filter: FilterConfig) => {
    dataActions.addFilter(filter)
  }

  const handleRemoveFilter = (index: number) => {
    dataActions.removeFilter(index)
  }

  const handleClearFilters = () => {
    dataActions.clearActiveFilters()
  }

  // Sort handlers
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    dataActions.setSorting(field, direction)
  }

  const handleClearSort = () => {
    dataActions.clearSorting()
  }

  // Refresh data using TanStack Query invalidation
  const refreshTableData = () => {
    if (selectedTableId) {
      queryClient.invalidateQueries({ queryKey: fieldQueryKeys.all(selectedTableId) })
      queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(selectedTableId) })
    }
  }

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
        {isInitialLoading ? renderLoadingState() :
         error ? renderErrorState() :
         !selectedTable ? renderEmptyState() : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <DynamicDataSheetGrid
              fields={fields}
              rows={rows}
              totalCount={totalCount}
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
              onScroll={handleScrollThrottled}
              isLoading={isSearching}
              error={error ? String(error) : null}
              activeFilters={activeFilters ?? []}
              onAddFilter={handleAddFilter}
              onRemoveFilter={handleRemoveFilter}
              onClearFilters={handleClearFilters}
              sortState={sortBy}
              onSort={handleSort}
              onClearSort={handleClearSort}
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
