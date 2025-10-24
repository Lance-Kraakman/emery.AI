"use client"

import React, { useState, useEffect } from "react"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import {
  type FilterConfig,
  type FilterOperator,
  type FieldType,
  OPERATORS_BY_FIELD_TYPE,
  operatorNeedsValue,
  getOperatorLabel
} from "@/lib/types/filters"

// Re-export FilterConfig for backward compatibility
export type { FilterConfig }

interface FilterPopoverProps {
  trigger: React.ReactNode
  fields: FieldDTO[]
  activeFilters: FilterConfig[]
  onAddFilter: (filter: FilterConfig) => void
  onRemoveFilter: (index: number) => void
}

export function FilterPopover({ trigger, fields, activeFilters, onAddFilter, onRemoveFilter }: FilterPopoverProps) {
  // Hydration-safe mounting check
  const [isMounted, setIsMounted] = useState(false)
  const [newField, setNewField] = useState<string>("")
  const [newOperator, setNewOperator] = useState<FilterOperator>("eq")
  const [newValue, setNewValue] = useState<string>("")

  // Set mounted state after client hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const selectedFieldObj = fields.find(f => f.name === newField)
  const fieldType = (selectedFieldObj?.type as FieldType) || 'text'
  const availableOperators = OPERATORS_BY_FIELD_TYPE[fieldType]

  // Reset operator when field changes
  useEffect(() => {
    if (newField && !availableOperators.find(op => op.value === newOperator)) {
      setNewOperator(availableOperators[0]?.value || 'eq')
    }
  }, [newField, availableOperators, newOperator])

  // Prevent hydration mismatch by not rendering during SSR
  if (!isMounted) return null

  const needsValue = operatorNeedsValue(newOperator)

  const handleAddFilter = () => {
    if (!newField) return
    if (needsValue && !newValue) return

    let processedValue: any = newValue

    // Type conversion
    if (needsValue) {
      if (fieldType === 'number') {
        processedValue = parseFloat(newValue)
        if (isNaN(processedValue)) return
      } else if (fieldType === 'boolean') {
        processedValue = newValue === 'true'
      } else if (fieldType === 'date') {
        processedValue = newValue
      }
    } else {
      processedValue = null
    }

    onAddFilter({
      field: newField,
      operator: newOperator,
      value: processedValue
    })

    // Reset form
    setNewField("")
    setNewOperator("eq")
    setNewValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddFilter()
    }
  }

  const formatFilterValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return ""
    if (typeof value === 'boolean') return value ? "true" : "false"
    return String(value)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-4" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filters</h4>
            {activeFilters.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {activeFilters.length} active
              </span>
            )}
          </div>

          {/* Add Filter Form */}
          <div className="space-y-3 pb-3 border-b">
            <Label className="text-xs text-muted-foreground">Add Filter</Label>

            {/* Field Selector */}
            <Select value={newField} onValueChange={setNewField}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                {fields.map(field => (
                  <SelectItem key={field.id} value={field.name}>
                    <span className="font-medium">{field.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({field.type})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operator & Value Row */}
            {newField && (
              <div className="flex gap-2">
                <Select value={newOperator} onValueChange={(value) => setNewOperator(value as FilterOperator)}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOperators.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {needsValue && (
                  <>
                    {fieldType === 'boolean' ? (
                      <Select value={newValue} onValueChange={setNewValue}>
                        <SelectTrigger className="h-9 flex-1">
                          <SelectValue placeholder="Value..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">True</SelectItem>
                          <SelectItem value="false">False</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Value..."
                        className="h-9 flex-1"
                      />
                    )}
                  </>
                )}

                <Button
                  size="sm"
                  onClick={handleAddFilter}
                  disabled={!newField || (needsValue && !newValue)}
                  className="h-9"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Active Filters List */}
          {activeFilters.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <Label className="text-xs text-muted-foreground">Active Filters</Label>
              {activeFilters.map((filter, index) => {
                const field = fields.find(f => f.name === filter.field)
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm px-2 py-1.5 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                  >
                    <span className="flex-1 truncate">
                      <span className="font-medium">{filter.field}</span>
                      <span className="text-muted-foreground mx-1.5">
                        {getOperatorLabel(filter.operator)}
                      </span>
                      {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                        <span>{formatFilterValue(filter.value, field?.type || 'text')}</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onRemoveFilter(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No active filters. Select a field above to add one.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
