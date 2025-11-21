"use client"

import React, { useEffect, useMemo, useCallback, useRef } from "react"
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
import { createDebugLogger } from '@/lib/utils/debug-logger'

const logger = createDebugLogger('DataViewsClient')

/**
 * Convert date strings back to Date objects after React Query deserialization
 * React Query serializes Date objects to strings when caching, so we need to
 * convert them back after retrieval from cache
 */
function convertDateStringsInRows(rows: DSGRow[], fields: FieldDTO[]): DSGRow[] {
  console.log('[convertRows] Input:', rows.length, 'rows');

  const dateFields = fields.filter(f =>
    f.type === 'date' || f.type === 'last-updated' || f.type === 'created-at'
  );

  console.log('[DATE CONVERSION] Starting', {
    rowCount: rows.length,
    fieldCount: fields.length,
    dateFieldCount: dateFields.length,
    dateFields: dateFields.map(f => ({ name: f.name, type: f.type }))
  });

  return rows.map((row, rowIndex) => {
    const convertedRow = { ...row };

    // Convert string values back to Date objects
    for (const field of dateFields) {
      const value = convertedRow[field.name];

      console.log(`[DATE CONVERSION] Row ${rowIndex}, field "${field.name}":`, {
        value,
        valueType: typeof value,
        isDate: value instanceof Date,
        isString: typeof value === 'string',
        isEmpty: value === '',
        willConvert: typeof value === 'string' && value !== ''
      });

      if (typeof value === 'string') {
        // Convert empty strings to null for date fields (dateColumn expects null, not "")
        if (value === '') {
          convertedRow[field.name] = null;
          console.log(`[DATE CONVERSION] ✅ Converted empty string to null for "${field.name}"`);
        } else {
          // Convert non-empty strings to Date objects
          try {
            convertedRow[field.name] = new Date(value);
            console.log(`[DATE CONVERSION] ✅ Converted "${field.name}" from string to Date`, new Date(value));
          } catch (e) {
            console.error(`[DATE CONVERSION] ❌ Failed to convert "${field.name}":`, e);
          }
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
        console.log('[convertRow]', key, ':', value, '→', converted[key]);
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
  const queryClient = useQueryClient()
  const { data, isLoading: dataLoading, error: dataError } = useEmery()

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

  const selectedTable = selectedTableId ? findTableById(selectedTableId) : undefined

  // TanStack Query for fields
  const fieldsQuery = useQuery({
    queryKey: selectedTableId ? fieldQueryKeys.all(selectedTableId) : ['fields', null],
    queryFn: () => selectedTableId ? getFields(selectedTableId) : Promise.resolve([]),
    enabled: !!selectedTableId,
    staleTime: GRID_CONFIG.FIELD_STALE_TIME,
  })

  // TanStack Query for views list (for table)
  const viewsQuery = useQuery({
    queryKey: ['views', 'table', selectedTableId],
    queryFn: () => selectedTableId ? getViewsForTable(selectedTableId) : Promise.resolve([]),
    enabled: !!selectedTableId,
    staleTime: 5 * 60 * 1000, // 5 minutes - views change less frequently than data
  })

  const availableViews = viewsQuery.data || []

  // TanStack Query for selected view (if any)
  const viewQuery = useQuery({
    queryKey: ['view', selectedViewId],
    queryFn: () => {
      console.log('[VIEW QUERY] Fetching view:', selectedViewId)
      return selectedViewId ? getView(selectedViewId) : Promise.resolve(null)
    },
    enabled: !!selectedViewId,
    staleTime: 5 * 60 * 1000, // 5 minutes - views change less frequently than data
  })

  const currentView = viewQuery.data

  // Debug logging for view state
  useEffect(() => {
    console.log('[VIEW STATE]', {
      selectedViewId,
      currentView: currentView?.id,
      currentViewName: currentView?.name,
      isLoading: viewQuery.isLoading,
      availableViews: availableViews.length
    })
  }, [selectedViewId, currentView, viewQuery.isLoading, availableViews.length])

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
    enabled: !!selectedTableId && !searchTerm && fieldsQuery.isSuccess, // Wait for field metadata
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
    enabled: !!selectedTableId && !!searchTerm && searchTerm.trim().length > 0 && fieldsQuery.isSuccess, // Wait for field metadata
    staleTime: GRID_CONFIG.SEARCH_STALE_TIME,
  })

  const fields: FieldDTO[] = fieldsQuery.data || []

  // Apply view configuration when view changes (must be after fields are loaded)
  useEffect(() => {
    console.log('[APPLY VIEW CONFIG] Effect triggered', {
      hasFieldsSuccess: fieldsQuery.isSuccess,
      fieldsLength: fields.length,
      hasCurrentView: !!currentView,
      currentViewId: currentView?.id,
      currentViewData: currentView
    })

    // Wait for fields to be loaded before applying view configuration
    if (!fieldsQuery.isSuccess || fields.length === 0) {
      console.log('[APPLY VIEW CONFIG] Skipping - fields not ready')
      return
    }

    if (currentView) {
      console.log('[APPLY VIEW CONFIG] Applying view configuration', {
        viewId: currentView.id,
        viewName: currentView.name,
        filters: currentView.filters?.length || 0,
        sorting: currentView.sorting?.length || 0,
        fieldMappings: currentView.fieldMappings?.length || 0
      })
      logger.debug('Applying view configuration', {
        viewId: currentView.id,
        viewName: currentView.name,
        filters: currentView.filters?.length || 0,
        sorting: currentView.sorting?.length || 0
      })

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
    console.log('[ROWS USEMEMO] Running', {
      hasFieldsData: !!fieldsQuery.data,
      fieldsLength: fieldsQuery.data?.length || 0,
      searchTerm,
      hasSearchData: !!searchQuery.data,
      hasInfiniteData: !!infiniteRowsQuery.data
    });

    // Don't process if fields aren't loaded yet
    if (!fieldsQuery.data || fieldsQuery.data.length === 0) {
      console.log('[ROWS USEMEMO] ⚠️ Early return - no fields data');
      return []
    }

    let rawRows: DSGRow[] = []

    if (searchTerm && searchQuery.data?.rows) {
      rawRows = searchQuery.data.rows
      console.log('[ROWS USEMEMO] Using search results:', rawRows.length, 'rows');
    } else if (infiniteRowsQuery.data?.pages) {
      rawRows = infiniteRowsQuery.data.pages.flatMap((page: { rows: DSGRow[], hasMore: boolean, total: number }) => page.rows)
      console.log('[ROWS USEMEMO] Using infinite query results:', rawRows.length, 'rows');
    }

    console.log('[ROWS USEMEMO] Raw rows sample (first row):', rawRows[0]);

    // Convert date strings to Date objects for dateColumn compatibility
    const converted = convertDateStringsInRows(rawRows, fieldsQuery.data);

    console.log('[ROWS USEMEMO] ✅ Conversion complete. Converted rows sample (first row):', converted[0]);

    return converted;
  }, [searchTerm, searchQuery.data, infiniteRowsQuery.data, fieldsQuery.data])

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

  // AIDEV-NOTE: Bulk row update with debounced batching
  // Extracted to custom hook for reusability and cleaner component code
  // Handles optimistic updates, batching, and server synchronization
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

      // AIDEV-NOTE: Merge server response into cache to show auto-field values immediately
      // Server generates auto-fields (last-updated, created-at) that aren't in optimistic update
      // Without this merge, users must refresh to see last-updated timestamps
      if (data?.success && data?.data && selectedTableId) {
        const queryKey = rowQueryKeys.infinite(selectedTableId, sortBy, activeFilters ?? [])

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
    selectedTableId,
    sortBy,
    activeFilters
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
    if (selectedTableId) {
      // Use refetchQueries to force immediate refetch (ignores staleTime)
      queryClient.refetchQueries({ queryKey: fieldQueryKeys.all(selectedTableId) })
      queryClient.refetchQueries({ queryKey: rowQueryKeys.all(selectedTableId) })
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
          <DynamicDataSheetGrid
            fields={fields}
            rows={rows}
            totalCount={totalCount}
            organizationId={selectedTable.organizationId!}
            tableId={selectedTable.id}
            tableName={selectedTable.name}
            currentView={currentView || undefined}
            availableViews={availableViews}
            onSelectView={(viewId) => {
              console.log('[ONSELECT VIEW] View selected:', viewId)
              dataActions.setSelectedView(viewId)
            }}
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
