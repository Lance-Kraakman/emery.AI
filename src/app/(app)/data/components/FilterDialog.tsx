"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { FilterConfig } from "./FilterBadge"

interface FilterDialogProps {
  isOpen: boolean
  onClose: () => void
  fields: FieldDTO[]
  onApplyFilter: (filter: FilterConfig) => void
}

const operatorsByType: Record<string, Array<{ value: string, label: string }>> = {
  text: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'ilike', label: 'Contains' },
    { value: 'is_null', label: 'Is empty' },
    { value: 'is_not_null', label: 'Is not empty' },
  ],
  number: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater than or equal' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less than or equal' },
    { value: 'is_null', label: 'Is empty' },
    { value: 'is_not_null', label: 'Is not empty' },
  ],
  boolean: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
  ],
  date: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'gt', label: 'After' },
    { value: 'gte', label: 'On or after' },
    { value: 'lt', label: 'Before' },
    { value: 'lte', label: 'On or before' },
    { value: 'is_null', label: 'Is empty' },
    { value: 'is_not_null', label: 'Is not empty' },
  ],
}

export function FilterDialog({ isOpen, onClose, fields, onApplyFilter }: FilterDialogProps) {
  const [selectedField, setSelectedField] = useState<string>("")
  const [selectedOperator, setSelectedOperator] = useState<string>("eq")
  const [filterValue, setFilterValue] = useState<string>("")

  const selectedFieldObj = fields.find(f => f.name === selectedField)
  const fieldType = selectedFieldObj?.type || 'text'
  const availableOperators = operatorsByType[fieldType] || operatorsByType.text

  // Reset operator when field changes to ensure valid combination
  React.useEffect(() => {
    if (selectedField && !availableOperators.find(op => op.value === selectedOperator)) {
      setSelectedOperator(availableOperators[0]?.value || 'eq')
    }
  }, [selectedField, availableOperators, selectedOperator])

  const needsValue = selectedOperator !== 'is_null' && selectedOperator !== 'is_not_null'

  const handleApply = () => {
    if (!selectedField) return
    if (needsValue && !filterValue) return

    let processedValue: any = filterValue

    // Type conversion based on field type
    if (needsValue) {
      if (fieldType === 'number') {
        processedValue = parseFloat(filterValue)
        if (isNaN(processedValue)) return
      } else if (fieldType === 'boolean') {
        processedValue = filterValue === 'true'
      } else if (fieldType === 'date') {
        processedValue = filterValue // Keep as ISO string
      }
    } else {
      processedValue = null
    }

    onApplyFilter({
      field: selectedField,
      operator: selectedOperator,
      value: processedValue
    })

    // Reset form
    setSelectedField("")
    setSelectedOperator("eq")
    setFilterValue("")
    onClose()
  }

  const handleCancel = () => {
    setSelectedField("")
    setSelectedOperator("eq")
    setFilterValue("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Filter</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Selector */}
          <div className="space-y-2">
            <Label>Field</Label>
            <Select value={selectedField} onValueChange={setSelectedField}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {fields.map(field => (
                  <SelectItem key={field.id} value={field.name}>
                    {field.name} ({field.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Operator Selector */}
          {selectedField && (
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger>
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
            </div>
          )}

          {/* Value Input */}
          {selectedField && needsValue && (
            <div className="space-y-2">
              <Label>Value</Label>
              {fieldType === 'boolean' ? (
                <Select value={filterValue} onValueChange={setFilterValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder={`Enter ${fieldType} value`}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedField || (needsValue && !filterValue)}
          >
            Apply Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
