'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Database, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { getTables } from '@/app/actions/tables'
import type { TableDTO } from '@/app/mappers/table-mapper'

interface ContextTablePickerProps {
  selectedTableIds: number[]
  onChange: (tableIds: number[]) => void
  excludeTableIds?: number[]
  disabled?: boolean
  placeholder?: string
}

export function ContextTablePicker({
  selectedTableIds,
  onChange,
  excludeTableIds = [],
  disabled = false,
  placeholder = 'Select tables...'
}: ContextTablePickerProps) {
  const [open, setOpen] = useState(false)
  const [tables, setTables] = useState<TableDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadTables = async () => {
      try {
        setIsLoading(true)
        const data = await getTables()
        setTables(data)
      } catch (error) {
        console.error('Failed to load tables:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadTables()
  }, [])

  const availableTables = tables.filter(t => !excludeTableIds.includes(t.id))
  const selectedTables = tables.filter(t => selectedTableIds.includes(t.id))

  const toggleTable = (tableId: number) => {
    if (selectedTableIds.includes(tableId)) {
      onChange(selectedTableIds.filter(id => id !== tableId))
    } else {
      onChange([...selectedTableIds, tableId])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="w-full justify-between text-sm font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Database className="h-4 w-4 text-gray-400" />
            {isLoading ? (
              <span className="flex items-center gap-1 text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </span>
            ) : selectedTables.length > 0 ? (
              selectedTables.length === 1 ? (
                selectedTables[0].name
              ) : (
                `${selectedTables.length} tables selected`
              )
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto">
          {availableTables.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              No tables available
            </div>
          ) : (
            availableTables.map((table) => (
              <button
                key={table.id}
                onClick={() => toggleTable(table.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50',
                  selectedTableIds.includes(table.id) && 'bg-blue-50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center h-4 w-4 rounded border',
                  selectedTableIds.includes(table.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300'
                )}>
                  {selectedTableIds.includes(table.id) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">
                    {table.name}
                  </div>
                  {table.description && (
                    <div className="text-xs text-gray-500 truncate">
                      {table.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
