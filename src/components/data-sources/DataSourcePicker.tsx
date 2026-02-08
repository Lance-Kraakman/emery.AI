'use client'

import { useState, useEffect } from 'react'
import { Plus, Table2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { getTables } from '@/app/actions/tables'
import type { TableDTO } from '@/app/mappers/table-mapper'

interface DataSourcePickerProps {
  /** Called when a table is selected */
  onTableSelect: (table: { id: number; name: string; description?: string }) => void
  /** Table IDs to exclude from the picker */
  excludeTableIds?: number[]
  /** Whether the picker is disabled */
  disabled?: boolean
}

export function DataSourcePicker({
  onTableSelect,
  excludeTableIds = [],
  disabled = false,
}: DataSourcePickerProps) {
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

  const handleSelect = (tableId: string) => {
    const table = tables.find(t => t.id === parseInt(tableId, 10))
    if (table) {
      onTableSelect({
        id: table.id,
        name: table.name,
        description: table.description ?? undefined
      })
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || isLoading}
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Plus className="h-3 w-3 mr-1" />
          )}
          Add table
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search tables..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-3 text-xs text-center text-muted-foreground">
              No tables found
            </CommandEmpty>
            <CommandGroup>
              {availableTables.map((table) => (
                <CommandItem
                  key={table.id}
                  value={String(table.id)}
                  onSelect={handleSelect}
                  className="flex items-center gap-2 py-2"
                >
                  <Table2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {table.name}
                    </div>
                    {table.description && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {table.description}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
