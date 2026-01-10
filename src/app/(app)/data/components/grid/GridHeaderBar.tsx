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
import { Search, Settings, RefreshCw, Filter, X, Save, Check, ArrowLeft } from 'lucide-react'
import { FilterPopover } from '../FilterPopover'
import { FilterChip } from '../FilterChip'
import { ViewSelector } from '../ViewSelector'
import { SaveViewDialog } from '../SaveViewDialog'
import { ShareButton } from '@/components/permissions/ShareButton'
import { ShareDialog } from '@/components/permissions/ShareDialog'
import { useGrid } from './GridContext'

export const GridHeaderBar = () => {
  // Access all grid state via context - no props!
  const {
    tableId,
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
    onClearSort,
    returnTo,
    onBack
  } = useGrid()

  // Show back button when navigated from org chart
  const showBackButton = returnTo?.startsWith('org-chart') && onBack

  // State for Save View dialog
  const [isSaveViewDialogOpen, setIsSaveViewDialogOpen] = React.useState(false)

  // State for Share dialog
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)

  // State for ID column visibility
  const [showIdColumn, setShowIdColumn] = React.useState(() => {
    if (typeof window !== 'undefined' && tableId) {
      return localStorage.getItem(`showIdColumn_${tableId}`) === 'true'
    }
    return false
  })

  // Local state for input value to prevent cursor jumping
  const [inputValue, setInputValue] = React.useState(searchTerm)

  // Sync input value when searchTerm changes from outside (e.g., clearing search)
  React.useEffect(() => {
    setInputValue(searchTerm)
  }, [searchTerm])

  // Toggle ID column visibility
  const handleToggleIdColumn = () => {
    const newValue = !showIdColumn
    setShowIdColumn(newValue)
    if (typeof window !== 'undefined' && tableId) {
      localStorage.setItem(`showIdColumn_${tableId}`, newValue.toString())
    }
    // Refresh to apply change
    onRefresh()
  }

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
      {/* Left: Back button + Table info - compact but always visible */}
      <div className="flex items-center gap-2 shrink-0">
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">Org Chart</span>
          </Button>
        )}
        <h2 className="text-sm font-semibold truncate max-w-[140px]">{tableName}</h2>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
          {isLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
          {rowCount} row{rowCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Center: Search - flexible but constrained */}
      <div className="flex-1 max-w-sm mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
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

      {/* Right: View selector and actions */}
      <div className="flex items-center gap-1 shrink-0">
        <ViewSelector
          views={availableViews.filter(v => v.viewType === 'grid')}
          selectedViewId={currentView?.id}
          onSelectView={onSelectView}
          className="w-[120px]"
          tableId={tableId}
        />

        {/* Filter button with count */}
        {onAddFilter && (
          <FilterPopover
            trigger={
              <Button
                variant={activeFilters.length > 0 ? "default" : "ghost"}
                size="sm"
                className="h-9 px-3 gap-1"
              >
                <Filter className="h-4 w-4" />
                {activeFilters.length > 0 && (
                  <span className="text-xs">{activeFilters.length}</span>
                )}
              </Button>
            }
            fields={fields}
            activeFilters={activeFilters}
            onAddFilter={onAddFilter}
            onRemoveFilter={onRemoveFilter!}
          />
        )}

        {/* Show active filter chips only if space allows */}
        <div className="flex items-center gap-1 max-w-[200px] overflow-hidden">
          {activeFilters.slice(0, 2).map((filter, index) => (
            <FilterChip
              key={index}
              filter={filter}
              onRemove={() => onRemoveFilter?.(index)}
            />
          ))}
          {activeFilters.length > 2 && (
            <span className="text-xs text-muted-foreground">+{activeFilters.length - 2}</span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="h-9 w-9 p-0"
          title="Refresh"
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
            {/* Save View - moved to menu when filters/sort active */}
            {(activeFilters.length > 0 || (sortState?.field && sortState?.order)) && (
              <>
                <DropdownMenuItem onClick={() => setIsSaveViewDialogOpen(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            {/* Clear All - moved to menu when active */}
            {(activeFilters.length > 0 || (sortState?.field != null && sortState?.order != null)) && (
              <>
                <DropdownMenuItem onClick={() => {
                  onClearFilters()
                  onClearSort()
                }}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            <DropdownMenuItem onClick={onManageFields}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Fields
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleToggleIdColumn}>
              <Check className={`h-4 w-4 mr-2 ${showIdColumn ? 'opacity-100' : 'opacity-0'}`} />
              Show ID Column
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Share Table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

  {/* Save View Dialog */}
  <SaveViewDialog
    isOpen={isSaveViewDialogOpen}
    onClose={() => setIsSaveViewDialogOpen(false)}
    tableId={tableId}
    fields={fields}
    activeFilters={activeFilters}
    sortState={sortState}
    onSuccess={(view) => {
      // Select the newly created view
      onSelectView(view.id)
      setIsSaveViewDialogOpen(false)
    }}
  />

  {/* Share Dialog */}
  <ShareDialog
    open={shareDialogOpen}
    onOpenChange={setShareDialogOpen}
    resourceType="table"
    resourceId={tableId}
    resourceName={tableName}
  />
  </>
  )
}
