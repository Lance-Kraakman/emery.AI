/**
 * GridHeaderBar - Table header with search, filters, and actions
 *
 * Extracted from DynamicDataSheetGrid for better component organization.
 * Uses GridContext via useGrid() hook to access all state - no props needed!
 *
 * Provides UI for:
 * - Table name and row count display
 * - Full-text search with Enter to submit
 * - Filter management (add/remove/clear)
 * - Sort state display and clearing
 * - Refresh and settings actions
 */

"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Search, Settings, RefreshCw, Filter, X } from 'lucide-react'
import { FilterPopover } from '../FilterPopover'
import { FilterChip } from '../FilterChip'
import { ViewSelector } from '../ViewSelector'
import { useGrid } from './GridContext'

export const GridHeaderBar = () => {
  // Access all grid state via context - no props!
  const {
    tableName,
    rows,
    totalCount,
    currentView,
    availableViews,
    onSelectView,
    searchTerm,
    onSearchChange,
    onManageFields,
    onRefresh,
    isLoading,
    fields,
    activeFilters,
    onAddFilter,
    onRemoveFilter,
    onClearFilters,
    sortState,
    onClearSort
  } = useGrid()

  // Local state for input value to prevent cursor jumping
  const [inputValue, setInputValue] = React.useState(searchTerm)

  // Sync input value when searchTerm changes from outside (e.g., clearing search)
  React.useEffect(() => {
    setInputValue(searchTerm)
  }, [searchTerm])

  // Trigger search on Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchChange(inputValue)
    } else if (e.key === 'Escape') {
      // Clear search on Escape
      setInputValue('')
      onSearchChange('')
    }
  }

  const rowCount = rows.length
  const totalRows = totalCount

  return (
    <>
    <div className="flex items-center justify-between h-[50px] px-4 border border-border border-b-0 bg-background rounded-t-md">
      {/* Left: Table name and row count */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-base font-semibold truncate">{tableName}</h2>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-2">
          {isLoading && (
            <RefreshCw className="h-3 w-3 animate-spin" />
          )}
          {rowCount} row{rowCount !== 1 ? 's' : ''}
          {searchTerm && ` (filtered from ${totalRows})`}
        </span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search in table... (press Enter)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 h-9 bg-background"
            disabled={isLoading}
          />
          {inputValue && inputValue !== searchTerm && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs bg-muted rounded border border-border">
              Enter
            </kbd>
          )}
        </div>
      </div>

    {/* Right: View selector and Actions */}
    <div className="flex items-center gap-2 flex-wrap">
      {/* View Selector - compact, fixed width */}
      <ViewSelector
        views={availableViews.filter(v => v.viewType === 'grid')}
        selectedViewId={currentView?.id}
        onSelectView={onSelectView}
        className="shrink-0 w-[120px]"
      />
      {/* Filter Popover + Active Filter Chips */}
      {onAddFilter && (
        <FilterPopover
          trigger={
            <Button
              variant={activeFilters.length > 0 ? "default" : "ghost"}
              size="sm"
              className="h-9 gap-1"
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs">
                Filter{activeFilters.length > 0 && ` (${activeFilters.length})`}
              </span>
            </Button>
          }
          fields={fields}
          activeFilters={activeFilters}
          onAddFilter={onAddFilter}
          onRemoveFilter={onRemoveFilter!}
        />
      )}

      {/* Active Filter Chips */}
      {activeFilters.map((filter, index) => (
        <FilterChip
          key={index}
          filter={filter}
          onRemove={() => onRemoveFilter?.(index)}
        />
      ))}

      {/* Clear All Button - shown when filters or sort are active */}
      {(activeFilters.length > 0 || (sortState?.field != null && sortState?.order != null)) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Clear both filters and sort independently
            onClearFilters()
            onClearSort()
          }}
          className="h-9 gap-1 text-muted-foreground hover:text-foreground"
          title="Clear all filters and sorting"
        >
          <X className="h-4 w-4" />
          <span className="text-xs">Clear All</span>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        className="h-9 w-9 p-0"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onManageFields}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Fields
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
  </>
  )
}
