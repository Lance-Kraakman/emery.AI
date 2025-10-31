"use client"

import React, { useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { toast } from 'sonner'
import debounce from 'lodash/debounce'
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
import { getRowsDSG, searchRowsDSG, createRow, createRows, updateRowData, updateRowsData, deleteRowData } from "@/app/actions/rows"
import { GRID_CONFIG } from "@/lib/constants/grid"
import { rowQueryKeys, fieldQueryKeys } from "@/lib/query-keys/rows"
import type { FilterConfig } from "@/lib/types/filters"
import type { FieldValue as DomainFieldValue } from "@/ddd/domain/tables/value-objects/field-values"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { DSGRow } from "@/app/mappers/dsg-mapper"
import { createDebugLogger } from '@/lib/utils/debug-logger'

const logger = createDebugLogger('DataViewsClient')

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

  // AIDEV-NOTE: Debug logging for sortBy changes
  React.useEffect(() => {
    logger.debug('sortBy changed in component', { field: sortBy.field, order: sortBy.order })
  }, [sortBy])

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

  // AIDEV-NOTE: Debounced mutation tracker for batching rapid cell updates
  // Stores pending mutations per cell (rowId + fieldId) to prevent database thrashing
  // Each cell's updates are debounced independently to batch rapid changes
  const pendingMutationsRef = useRef<Map<string, { rowId: string; fieldId: number; value: any }>>(new Map())

  // Helper: Convert field ID to field name for row data updates
  // Grid component works with numeric field IDs (1, 2, 3...), but row data is keyed by field names ("email", "age", etc.)
  // This conversion is needed because rows are stored as { email: "test@example.com", age: 25 }, not { 1: "test@example.com", 2: 25 }
  const getFieldNameById = (fieldId: number): string | null => {
    const field = fields.find(f => f.id === fieldId)
    return field ? field.name : null
  }

  // TanStack Mutations for optimistic updates - BULK UPDATE VERSION
  // Processes multiple row updates in a single API call to eliminate race conditions
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ rowId: string; data: Record<string, any> }>) => {
      if (!selectedTableId) throw new Error('No table selected')
      return updateRowsData(selectedTableId, updates)
    },
    onError: (err) => {
      logger.error("Failed to bulk update rows:", err)
      toast.error("Failed to save changes", {
        description: err instanceof Error ? err.message : "An error occurred while saving changes"
      })

      // Invalidate to refetch correct data on error
      if (selectedTableId) {
        queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(selectedTableId) })
      }
    },
    onSuccess: (data, variables) => {
      logger.summary('Bulk update completed', { rows: variables.length })
    },
    onSettled: () => {
      // Don't invalidate - let optimistic updates persist
    },
  })

  // AIDEV-NOTE: Table-level debounced batch processor (500ms delay)
  // Collects ALL pending cell changes across entire table and sends in SINGLE API call
  // This eliminates race conditions and reduces database load significantly
  const debouncedBatchUpdate = useRef(
    debounce(() => {
      const pendingUpdates = Array.from(pendingMutationsRef.current.values())

      if (pendingUpdates.length === 0) return

      // Group updates by rowId to create batch payload
      const updatesByRow = new Map<string, Record<string, any>>()

      pendingUpdates.forEach(({ rowId, fieldId, value }) => {
        const fieldName = getFieldNameById(fieldId)
        if (!fieldName) return

        if (!updatesByRow.has(rowId)) {
          updatesByRow.set(rowId, {})
        }
        updatesByRow.get(rowId)![fieldName] = value
      })

      // Convert to array format expected by bulk API
      const bulkUpdates = Array.from(updatesByRow.entries()).map(([rowId, data]) => ({
        rowId,
        data
      }))

      // Clear pending mutations and trigger bulk update
      pendingMutationsRef.current.clear()
      bulkUpdateMutation.mutate(bulkUpdates)
    }, 500)
  )

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedBatchUpdate.current.cancel()
    }
  }, [])

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
      logger.error("Failed to add rows:", err)
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
      logger.error("Failed to delete row:", err)
      toast.error("Failed to delete row", {
        description: err instanceof Error ? err.message : "An error occurred while deleting the row"
      })
    },
  })

  const handleUpdateRow = async (rowId: string, fieldId: number, value: DomainFieldValue) => {
    // AIDEV-NOTE: Two-phase update with table-level batching:
    // 1. Immediate optimistic UI update (instant feedback to user)
    // 2. Collect in batch, debounced bulk server write (eliminates race conditions)

    // Step 1: Immediate optimistic UI update for instant feedback
    const queryKey = selectedTableId
      ? rowQueryKeys.infinite(selectedTableId, sortBy, activeFilters ?? [])
      : ['rows', null, 'infinite']

    // Convert field ID to field name for cache update
    const fieldName = getFieldNameById(fieldId)
    if (fieldName) {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            rows: page.rows.map((row: DSGRow) =>
              row.id === rowId ? { ...row, [fieldName]: value } : row
            )
          }))
        }
      })
    }

    // Step 2: Add to batch and trigger table-level debounced update
    // Key is per-cell to handle same cell being edited multiple times
    const key = `${rowId}-${fieldId}`
    pendingMutationsRef.current.set(key, { rowId, fieldId, value })

    // Trigger table-level debounced batch processor
    // This will collect ALL pending updates and send in single API call
    debouncedBatchUpdate.current()
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

  // Sort handlers - simplified, just set what's requested
  const handleSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    logger.debug('handleSort setting sort', { field, direction })
    dataActions.setSorting(field, direction)
  }, [])

  const handleClearSort = useCallback(() => {
    dataActions.clearSorting()
  }, [])

  // Refresh data using TanStack Query invalidation
  const refreshTableData = useCallback(() => {
    if (selectedTableId) {
      queryClient.invalidateQueries({ queryKey: fieldQueryKeys.all(selectedTableId) })
      queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(selectedTableId) })
    }
  }, [selectedTableId, queryClient])

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
