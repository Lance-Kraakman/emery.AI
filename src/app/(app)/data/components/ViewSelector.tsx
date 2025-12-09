"use client"

import React from "react"
import { Check, ChevronDown, Plus, Filter, ArrowUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShareButton } from "@/components/permissions/ShareButton"
import type { ViewDTO } from "@/app/mappers/view-mapper"

interface ViewSelectorProps {
  views: ViewDTO[]
  selectedViewId?: number
  onSelectView: (viewId: number | undefined) => void
  onCreateView?: () => void
  className?: string
  tableId?: number // For ShareButton - views inherit from table
}

export function ViewSelector({
  views,
  selectedViewId,
  onSelectView,
  onCreateView,
  className,
  tableId
}: ViewSelectorProps) {
  const selectedView = views.find(v => v.id === selectedViewId)
  const displayName = selectedView?.name || "All Data"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${className} h-8`}
          title={displayName} // Show full name on hover
        >
          <span className="text-xs font-normal truncate">{displayName}</span>
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {/* All Data option */}
        <DropdownMenuItem
          onClick={() => onSelectView(undefined)}
          className="flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <span>All Data</span>
          </span>
          {!selectedViewId && <Check className="h-4 w-4" />}
        </DropdownMenuItem>

        {views.length > 0 && <DropdownMenuSeparator />}

        {/* View list */}
        {views.map((view) => {
          const filterCount = view.filters?.length || 0
          const sortCount = view.sorting?.length || 0
          const isSelected = view.id === selectedViewId

          return (
            <DropdownMenuItem
              key={view.id}
              onClick={() => onSelectView(view.id)}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate">{view.name}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </div>
                {(filterCount > 0 || sortCount > 0) && (
                  <div className="flex items-center gap-1.5">
                    {filterCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        <Filter className="h-3 w-3 mr-1" />
                        {filterCount}
                      </Badge>
                    )}
                    {sortCount > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        <ArrowUpDown className="h-3 w-3 mr-1" />
                        {sortCount}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {/* ShareButton for view - uses table inheritance */}
              {tableId && (
                <div className="ml-2">
                  <ShareButton
                    resourceType="view"
                    resourceId={view.id}
                    variant="ghost"
                    size="icon"
                    onShare={() => {
                      // TODO: Open share dialog for view
                      console.log('Share view:', view.id)
                    }}
                  />
                </div>
              )}
            </DropdownMenuItem>
          )
        })}

        {/* Create view option */}
        {onCreateView && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onCreateView}
              className="text-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>Create View</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
