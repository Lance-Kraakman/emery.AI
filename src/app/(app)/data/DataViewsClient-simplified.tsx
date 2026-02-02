"use client"

import React, { useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'
import { toast } from 'sonner'
import debounce from 'lodash/debounce'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Settings, Plus, Search, TableIcon as Table, Database } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { DynamicDataSheetGrid } from "./components/DynamicDataSheetGrid"
import { FieldManagerDialog } from "./components/FieldManagerDialog"
import { useEmery, useEmeryTable } from "@/contexts/EmeryStoreProvider"
import { dataStore, dataSelectors } from '@/stores/data-management.store'
import { storeActions, dataActions } from '@/stores/actions'
import type { TableDTO } from "@/app/mappers/table-mapper"
import type { ViewDTO } from "@/app/mappers/view-mapper"
import { getFields } from "@/app/actions/fields"
import { getRowsDSG, searchRowsDSG, createRow, createRows, updateRowData, updateRowsData, deleteRowData } from "@/app/actions/rows"
import { getView, getViewsForTable } from "@/app/actions/views"
import { useBulkRowUpdate } from "@/hooks/use-bulk-row-update"
import { GRID_CONFIG } from "@/lib/constants/grid"
import { rowQueryKeys, fieldQueryKeys } from "@/lib/query-keys/rows"
import type { FilterConfig } from "@/lib/types/filters"
import type { FieldValue as DomainFieldValue } from "@/ddd/domain/tables/value-objects/field-values"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { DSGRow } from "@/app/mappers/dsg-mapper"
import type { RowDTO } from "@/app/mappers/row-mapper"
import { createDebugLogger } from '@/lib/utils/debug-logger'

const logger = createDebugLogger('DataViewsClient')

/**
 * Convert date strings back to Date objects after React Query deserialization
 * React Query serializes Date objects to strings when caching, so we need to
 * convert them back after retrieval from cache
 */
function convertDateStringsInRows(rows: DSGRow[], fields: FieldDTO[]): DSGRow[] {
  const dateFields = fields.filter(f =>
    f.type === 'date' || f.type === 'last-updated' || f.type === 'created-at'
  );

  if (dateFields.length === 0) return rows;

  return rows.map((row) => {
    const convertedRow = { ...row };

    for (const field of dateFields) {
      const value = convertedRow[field.name];

      if (typeof value === 'string') {
        // Convert empty strings to null for date fields (dateColumn expects null, not "")
        if (value === '') {
          convertedRow[field.name] = null;
        } else {
          // Convert non-empty strings to Date objects
          try {
            convertedRow[field.name] = new Date(value);
          } catch {
            // Keep original if parse fails
          }
        }
      } else if (typeof value === 'number') {
        // Handle number timestamps (milliseconds since epoch from gRPC)
        try {
          convertedRow[field.name] = new Date(value);
        } catch {
          // Keep original if parse fails
        }
      }
    }
    return convertedRow;
  });
}

/**
 * Convert date strings to Date objects in a single row (optimized with Set)
 * Used after UPDATE mutations to convert server-serialized ISO strings back to Date objects
 */
function convertDateStringsInRow(row: DSGRow, fields: FieldDTO[]): DSGRow {
  // Create Set of date field names for O(1) lookup
  const dateFieldNames = new Set(
    fields
      .filter(f => f.type === 'date' || f.type === 'last-updated' || f.type === 'created-at')
      .map(f => f.name)
  );

  if (dateFieldNames.size === 0) return row;

  const converted = { ...row };
  for (const [key, value] of Object.entries(converted)) {
    if (dateFieldNames.has(key) && typeof value === 'string' && value) {
      try {
        converted[key] = new Date(value);
      } catch {
        // Keep original if parse fails
      }
    }
  }
  return converted;
}

interface DataViewsClientSimplifiedProps {
  tableId?: number
}

export function DataViewsClientSimplified({ tableId }: DataViewsClientSimplifiedProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const queryClient = useQueryClient()
  const { data, isLoading: dataLoading, error: dataError } = useEmery()

  // Handle back navigation based on returnTo param
  const handleBack = () => {
    if (returnTo?.startsWith('org-chart')) {
      // Parse selected node from returnTo (format: org-chart&selected=database-5)
      const selectedMatch = returnTo.match(/selected=([^&]+)/)
      const selected = selectedMatch ? selectedMatch[1] : null
      router.push(selected ? `/organization?selected=${selected}` : '/organization')
    } else {
      router.back()
    }
  }

  // Use TanStack Store for data management state
  const selectedTableId = useStore(dataStore, dataSelectors.selectedTableId)
  const selectedViewId = useStore(dataStore, dataSelectors.selectedViewId)
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

  // Sync tableId prop to selectedTableId state
  useEffect(() => {
    if (tableId) {
      dataActions.setSelectedTable(tableId)
    }
  }, [tableId])

  // AIDEV-NOTE: Use tableId prop directly (from URL) OR selectedTableId from store
  // This fixes the race condition where navigation happens before store is updated
  // useEmeryTable subscribes directly to the specific table in appStateStore
  const effectiveTableId = tableId ?? selectedTableId
  const selectedTable = useEmeryTable(effectiveTableId ?? 0) ?? undefined

  // TanStack Query for fields
  const fieldsQuery = useQuery({
    queryKey: effectiveTableId ? fieldQueryKeys.all(effectiveTableId) : ['fields', null],
    queryFn: () => effectiveTableId ? getFields(effectiveTableId) : Promise.resolve([]),
    enabled: !!effectiveTableId,
    staleTime: GRID_CONFIG.FIELD_STALE_TIME,
  })

  // TanStack Query for views list (for table)
  const viewsQuery = useQuery({
    queryKey: ['views', 'table', effectiveTableId],
    queryFn: () => effectiveTableId ? getViewsForTable(effectiveTableId) : Promise.resolve([]),
    enabled: !!effectiveTableId,
    staleTime: 5 * 60 * 1000, // 5 minutes - views change less frequently than data
  })

  const availableViews = viewsQuery.data || []

  // TanStack Query for selected view (if any)
  const viewQuery = useQuery({
    queryKey: ['view', selectedViewId],
    queryFn: () => selectedViewId ? getView(selectedViewId) : Promise.resolve(null),
    enabled: !!selectedViewId,
    staleTime: 5 * 60 * 1000, // 5 minutes - views change less frequently than data
  })

  const currentView = viewQuery.data

  // TanStack Infinite Query for rows (supports pagination)
  const infiniteRowsQuery = useInfiniteQuery({
    queryKey: effectiveTableId
      ? rowQueryKeys.infinite(effectiveTableId, sortBy, activeFilters ?? [])
      : ['rows', null, 'infinite'],
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      effectiveTableId
        ? getRowsDSG(
            effectiveTableId,
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
    enabled: !!effectiveTableId && !searchTerm && fieldsQuery.isSuccess, // Wait for field metadata
    staleTime: GRID_CONFIG.ROW_STALE_TIME,
  })

  // TanStack Query for server-side search
  const searchQuery = useQuery({
    queryKey: effectiveTableId && searchTerm
      ? rowQueryKeys.search(effectiveTableId, searchTerm)
      : ['rows', null, 'search'],
    queryFn: () =>
      effectiveTableId && searchTerm
        ? searchRowsDSG(effectiveTableId, searchTerm, 1000) // Higher limit for search results
        : Promise.resolve({ rows: [], total: 0 }),
    enabled: !!effectiveTableId && !!searchTerm && searchTerm.trim().length > 0 && fieldsQuery.isSuccess, // Wait for field metadata
    staleTime: GRID_CONFIG.SEARCH_STALE_TIME,
  })

  const fields: FieldDTO[] = fieldsQuery.data || []

  // Apply view configuration when view changes (must be after fields are loaded)
  useEffect(() => {
    // Wait for fields to be loaded before applying view configuration
    if (!fieldsQuery.isSuccess || fields.length === 0) {
      return
    }

    if (currentView) {
      // Apply view's filters
      if (currentView.filters && currentView.filters.length > 0) {
        // Convert view filters to FilterConfig format (map fieldId to field name)
        const viewFilters: FilterConfig[] = currentView.filters
          .map(f => {
            const field = fields.find(field => field.id === f.fieldId)
            if (!field) return null // Skip if field not found (deleted)
            return {
              field: field.name, // FilterConfig uses field name, not ID
              operator: f.operator as any,
              value: f.value
            } as FilterConfig
          })
          .filter((f): f is FilterConfig => f !== null)
        dataActions.setActiveFilters(viewFilters)
      } else {
        dataActions.clearActiveFilters()
      }

      // Apply view's sorting (use first sort if multiple)
      if (currentView.sorting && currentView.sorting.length > 0) {
        const primarySort = currentView.sorting.sort((a, b) => a.priority - b.priority)[0]
        // Find field name from fieldId
        const sortField = fields.find(f => f.id === primarySort.fieldId)
        if (sortField) {
          dataActions.setSorting(sortField.name, primarySort.direction)
        }
      } else {
        dataActions.clearSorting()
      }
    } else {
      // No view selected - clear view-specific configuration
      // Note: We don't clear here to preserve user's manual filters/sorting
    }
  }, [currentView, fields, fieldsQuery.isSuccess])

  // Use search results when searching, otherwise use paginated rows
  // Convert date strings to Date objects after queries resolve
  const rows: DSGRow[] = useMemo(() => {
    // Get raw rows first
    let rawRows: DSGRow[] = []

    if (searchTerm && searchQuery.data?.rows) {
      rawRows = searchQuery.data.rows
    } else if (infiniteRowsQuery.data?.pages) {
      rawRows = infiniteRowsQuery.data.pages.flatMap((page: { rows: DSGRow[], hasMore: boolean, total: number }) => page.rows)
    }

    // Only convert dates if we have field metadata
    if (!fieldsQuery.data || fieldsQuery.data.length === 0) {
      return rawRows;
    }

    // Convert date strings to Date objects for dateColumn compatibility
    return convertDateStringsInRows(rawRows, fieldsQuery.data);
  }, [searchTerm, searchQuery.data, infiniteRowsQuery.data, fieldsQuery.data, fieldsQuery.isSuccess])

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

  // Use ref for stable access to infiniteRowsQuery state (prevents scroll handler recreation)
  const infiniteQueryRef = useRef(infiniteRowsQuery)
  useEffect(() => {
    infiniteQueryRef.current = infiniteRowsQuery
  }, [infiniteRowsQuery])

  // Scroll handler for infinite scroll - stable callback using ref
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const { scrollHeight, scrollTop, clientHeight } = target
    const query = infiniteQueryRef.current

    // Trigger load when within threshold of bottom
    if (
      scrollHeight - scrollTop - clientHeight < GRID_CONFIG.SCROLL_THRESHOLD &&
      !query.isFetching &&
      query.hasNextPage
    ) {
      query.fetchNextPage()
    }
  }, []) // Empty deps - uses ref for stable access

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

  // AIDEV-NOTE: Bulk row update with debounced batching
  // Extracted to custom hook for reusability and cleaner component code
  // Handles optimistic updates, batching, and server synchronization
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ rowId: string; data: Record<string, any> }>) => {
      if (!effectiveTableId) throw new Error('No table selected')
      return updateRowsData(effectiveTableId, updates)
    },
    onError: (err) => {
      logger.error("Failed to bulk update rows:", err)
      toast.error("Failed to save changes", {
        description: err instanceof Error ? err.message : "An error occurred while saving changes"
      })

      // Invalidate to refetch correct data on error
      if (effectiveTableId) {
        queryClient.invalidateQueries({ queryKey: rowQueryKeys.all(effectiveTableId) })
      }
    },
    onSuccess: (data, variables) => {
      logger.summary('Bulk update completed', { rows: variables.length })

      // AIDEV-NOTE: Merge server response into cache to show auto-field values immediately
      // Server generates auto-fields (last-updated, created-at) that aren't in optimistic update
      // Without this merge, users must refresh to see last-updated timestamps
      if (data?.success && data?.data && effectiveTableId) {
        const queryKey = rowQueryKeys.infinite(effectiveTableId, sortBy, activeFilters ?? [])

        // Create map of updated rows by ID for quick lookup
        const updatedRowsMap = new Map(
          data.data.map((row: DSGRow) => [row.id, row])
        )

        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old?.pages) return old

          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              rows: page.rows.map((row: DSGRow) => {
                const updatedRow = updatedRowsMap.get(row.id)
                // If this row was updated, merge server data and convert date strings to Date objects
                if (updatedRow) {
                  const mergedRow = { ...row, ...updatedRow };
                  return convertDateStringsInRow(mergedRow, fieldsQuery.data || []);
                }
                return row;
              })
            }))
          }
        })
      }
    },
    onSettled: () => {
      // Don't invalidate - optimistic + server merge provides best UX
    },
  })

  const { handleUpdateRow } = useBulkRowUpdate({
    fields,
    bulkUpdateMutation,
    selectedTableId: effectiveTableId,
    sortBy,
    activeFilters
  })

  const addRowsMutation = useMutation({
    mutationFn: async (rowsData: Record<string, any>[]) => {
      if (!effectiveTableId) throw new Error('No table selected')

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

      return createRows({ tableId: effectiveTableId, rows: processedRows })
    },
    onMutate: async (rowsData) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: rowQueryKeys.all(effectiveTableId!) })

      // Snapshot current data for rollback
      const queryKey = rowQueryKeys.infinite(effectiveTableId!, sortBy, activeFilters ?? [])
      const previousData = queryClient.getQueryData(queryKey)

      // Create temporary rows with temp IDs (will be replaced by server response)
      const tempRows = rowsData.map((data, i) => ({
        id: `temp-${Date.now()}-${i}`,
        ...data
      }))

      // Optimistically add rows to the last page
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old
        const lastPageIndex = old.pages.length - 1
        return {
          ...old,
          pages: old.pages.map((page: any, idx: number) =>
            idx === lastPageIndex
              ? { ...page, rows: [...page.rows, ...tempRows] }
              : page
          )
        }
      })

      return { previousData, tempRows }
    },
    onSuccess: (data, variables, context) => {
      // Replace temp rows with server-returned rows (with real IDs)
      if (data?.success && data?.data && effectiveTableId) {
        const queryKey = rowQueryKeys.infinite(effectiveTableId, sortBy, activeFilters ?? [])
        const serverRowDTOs = data.data as RowDTO[]
        const tempIds = context?.tempRows?.map((r: DSGRow) => r.id) || []

        // Convert RowDTO (fieldValues array) → DSGRow (flat field-name keys)
        const serverRows: DSGRow[] = serverRowDTOs.map(dto => {
          const dsgRow: Record<string, any> = { id: dto.id }
          for (const fv of dto.fieldValues) {
            const field = fields.find(f => f.id.toString() === fv.fieldId)
            if (field) {
              dsgRow[field.name] = fv.value
            }
          }
          return dsgRow as DSGRow
        })

        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old?.pages) return old

          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              rows: page.rows.map((row: DSGRow) => {
                const tempIndex = tempIds.indexOf(row.id)
                if (tempIndex !== -1 && serverRows[tempIndex]) {
                  return convertDateStringsInRow(serverRows[tempIndex], fields)
                }
                return row
              })
            }))
          }
        })
      }

      const rowCount = variables.length
      toast.success(`Added ${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`)
    },
    onError: (err, variables, context) => {
      // Rollback to previous data on error
      if (context?.previousData && effectiveTableId) {
        const queryKey = rowQueryKeys.infinite(effectiveTableId, sortBy, activeFilters ?? [])
        queryClient.setQueryData(queryKey, context.previousData)
      }
      logger.error("Failed to add rows:", err)
      toast.error("Failed to add row", {
        description: err instanceof Error ? err.message : "An error occurred while adding the row"
      })
    },
    // No onSettled invalidation - optimistic updates handle everything
  })

  const deleteRowMutation = useMutation({
    mutationFn: async (rowId: string) => {
      if (!effectiveTableId) throw new Error('No table selected')
      return deleteRowData(effectiveTableId, rowId)
    },
    onMutate: async (rowId) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: rowQueryKeys.all(effectiveTableId!) })

      // Snapshot current data for rollback
      const queryKey = rowQueryKeys.infinite(effectiveTableId!, sortBy, activeFilters ?? [])
      const previousData = queryClient.getQueryData(queryKey)

      // Optimistically remove the row from cache
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            rows: page.rows.filter((row: DSGRow) => row.id !== rowId)
          }))
        }
      })

      return { previousData }
    },
    onSuccess: () => {
      toast.success("Row deleted")
    },
    onError: (err, rowId, context) => {
      // Rollback to previous data on error
      if (context?.previousData && effectiveTableId) {
        const queryKey = rowQueryKeys.infinite(effectiveTableId, sortBy, activeFilters ?? [])
        queryClient.setQueryData(queryKey, context.previousData)
      }
      logger.error("Failed to delete row:", err)
      toast.error("Failed to delete row", {
        description: err instanceof Error ? err.message : "An error occurred while deleting the row"
      })
    },
    // No onSettled invalidation - optimistic updates handle everything
  })

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

  // Refresh data using TanStack Query refetch (forces immediate refetch, bypassing staleTime)
  const refreshTableData = useCallback(() => {
    if (effectiveTableId) {
      // Use refetchQueries to force immediate refetch (ignores staleTime)
      queryClient.refetchQueries({ queryKey: fieldQueryKeys.all(effectiveTableId) })
      queryClient.refetchQueries({ queryKey: rowQueryKeys.all(effectiveTableId) })
    }
  }, [effectiveTableId, queryClient])

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
          <DynamicDataSheetGrid
            fields={fields}
            rows={rows}
            totalCount={totalCount}
            organizationId={selectedTable.organizationId!}
            tableId={selectedTable.id}
            tableName={selectedTable.name}
            currentView={currentView || undefined}
            availableViews={availableViews}
            onSelectView={(viewId) => dataActions.setSelectedView(viewId)}
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
            returnTo={returnTo}
            onBack={handleBack}
          />
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
