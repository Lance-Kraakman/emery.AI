"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, GripVertical } from "lucide-react"
import type { SelectOption } from "@/ddd/domain/tables/value-objects/table-field"

interface SelectOptionsManagerProps {
  options: SelectOption[]
  onChange: (options: SelectOption[]) => void
  defaultOption?: number
  onDefaultChange?: (optionId: number | undefined) => void
  showDefaultSelector?: boolean
}

const DEFAULT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
]

export function SelectOptionsManager({
  options,
  onChange,
  defaultOption,
  onDefaultChange,
  showDefaultSelector = false
}: SelectOptionsManagerProps) {
  const [newOptionLabel, setNewOptionLabel] = useState("")

  const handleAddOption = () => {
    if (!newOptionLabel.trim()) return

    const newId = options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1
    const colorIndex = options.length % DEFAULT_COLORS.length

    const newOption: SelectOption = {
      id: newId,
      value: newOptionLabel.trim(),
      color: DEFAULT_COLORS[colorIndex]
    }

    onChange([...options, newOption])
    setNewOptionLabel("")
  }

  const handleRemoveOption = (optionId: number) => {
    const updatedOptions = options.filter(o => o.id !== optionId)
    onChange(updatedOptions)

    // Clear default if it was the removed option
    if (defaultOption === optionId && onDefaultChange) {
      onDefaultChange(undefined)
    }
  }

  const handleUpdateOption = (optionId: number, updates: Partial<SelectOption>) => {
    const updatedOptions = options.map(option =>
      option.id === optionId ? { ...option, ...updates } : option
    )
    onChange(updatedOptions)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddOption()
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Options</Label>

        {/* Existing options list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
              No options yet. Add your first option below.
            </div>
          ) : (
            options.map((option, index) => (
              <div key={option.id} className="flex items-center gap-2 group">
                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />

                {/* Color picker */}
                <input
                  type="color"
                  value={option.color}
                  onChange={(e) => handleUpdateOption(option.id, { color: e.target.value })}
                  className="w-8 h-8 rounded border cursor-pointer"
                  title="Pick color"
                />

                {/* Option label */}
                <Input
                  value={option.value}
                  onChange={(e) => handleUpdateOption(option.id, { value: e.target.value })}
                  className="flex-1"
                  placeholder="Option label"
                />

                {/* Preview badge */}
                <Badge
                  style={{ backgroundColor: option.color, color: '#fff' }}
                  className="min-w-[80px] justify-center"
                >
                  {option.value || `Option ${index + 1}`}
                </Badge>

                {/* Default selector (for single-select) */}
                {showDefaultSelector && onDefaultChange && (
                  <Button
                    type="button"
                    variant={defaultOption === option.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => onDefaultChange(defaultOption === option.id ? undefined : option.id)}
                    title={defaultOption === option.id ? "Remove as default" : "Set as default"}
                  >
                    {defaultOption === option.id ? "Default" : "Set Default"}
                  </Button>
                )}

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOption(option.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add new option */}
      <div className="flex gap-2">
        <Input
          placeholder="New option label..."
          value={newOptionLabel}
          onChange={(e) => setNewOptionLabel(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleAddOption}
          disabled={!newOptionLabel.trim()}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {options.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {options.length} option{options.length !== 1 ? 's' : ''} configured
        </p>
      )}
    </div>
  )
}
