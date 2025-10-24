"use client"

import React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { type FilterConfig, type FilterOperator, getOperatorLabel, operatorNeedsValue } from "@/lib/types/filters"

interface FilterChipProps {
  filter: FilterConfig
  onRemove: () => void
}

export function FilterChip({ filter, onRemove }: FilterChipProps) {
  const operatorLabel = getOperatorLabel(filter.operator as FilterOperator)

  // Format the value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ""
    // Don't show value for operators that don't need it
    if (!operatorNeedsValue(filter.operator as FilterOperator)) return ""
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === 'boolean') return value ? "true" : "false"

    // Truncate long values
    const str = String(value)
    return str.length > 20 ? str.substring(0, 20) + "..." : str
  }

  const displayValue = formatValue(filter.value)
  const fullDisplay = `${filter.field} ${operatorLabel}${displayValue ? ` ${displayValue}` : ""}`

  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1.5 pl-2 pr-1 py-0.5 text-xs font-normal bg-primary/10 hover:bg-primary/15 transition-colors"
    >
      <span className="max-w-[200px] truncate" title={fullDisplay}>
        <span className="font-medium">{filter.field}</span>
        <span className="text-muted-foreground mx-1">{operatorLabel}</span>
        {displayValue && <span>{displayValue}</span>}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="ml-0.5 rounded-sm hover:bg-primary/20 p-0.5 transition-colors"
        title="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}
