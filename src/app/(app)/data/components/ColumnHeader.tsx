"use client"

import React from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ChevronDown, Edit, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import { createDebugLogger } from "@/lib/utils/debug-logger"
import { useGrid } from './grid/GridContext'

const logger = createDebugLogger('ColumnHeader')

interface ColumnHeaderProps {
  field: FieldDTO
  onEdit: (field: FieldDTO) => void
  onDelete: (fieldName: string) => void
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  onClearSort?: () => void
}

export function ColumnHeader({ field, onEdit, onDelete, onSort, onClearSort }: ColumnHeaderProps) {
  // AIDEV-NOTE: Read sortState directly from grid context to avoid stale props
  const { sortState: globalSortState } = useGrid()

  // Calculate this field's sort state
  const sortState = globalSortState?.field === field.name && globalSortState?.field != null
    ? globalSortState.order
    : null

  // AIDEV-NOTE: Debug logging for sortState changes
  React.useEffect(() => {
    logger.debug(`${field.name} sortState changed`, sortState)
  }, [sortState, field.name])

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Delete field "${field.name}"? This will permanently delete all data in this column.`)) {
      onDelete(field.name)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(field)
  }

  const handleSort = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onSort) return

    logger.debug(`${field.name} sort button clicked, current sortState:`, sortState)

    // Simple cycle based on CURRENT sortState prop
    if (!sortState) {
      onSort(field.name, 'asc')
    } else if (sortState === 'asc') {
      onSort(field.name, 'desc')
    } else {
      // desc -> clear (call onClearSort instead)
      if (onClearSort) {
        logger.debug(`${field.name} clearing sort`)
        onClearSort()
      }
    }
  }

  const getSortIcon = () => {
    if (!sortState) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
    if (sortState === 'asc') return <ArrowUp className="h-3.5 w-3.5" />
    return <ArrowDown className="h-3.5 w-3.5" />
  }

  const getSortTooltip = () => {
    if (!sortState) return `Sort ${field.name} ascending`
    if (sortState === 'asc') return `Sort ${field.name} descending`
    return `Clear sort on ${field.name}`
  }

  return (
    <div className="flex items-center justify-between w-full gap-1">
      <span className="truncate flex-1">{field.name}</span>

      {/* Sort Button - Enhanced with better visual feedback */}
      {onSort && (
        <button
          className={`
            flex-shrink-0 p-1 rounded transition-all duration-150
            ${sortState
              ? 'text-primary bg-primary/10 hover:bg-primary/20 ring-1 ring-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }
          `}
          onClick={handleSort}
          title={getSortTooltip()}
        >
          {getSortIcon()}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex-shrink-0 p-0.5 hover:bg-accent rounded transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Field
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Field
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
