"use client"

import React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface FilterConfig {
  field: string
  operator: string
  value: any
}

interface FilterBadgeProps {
  filter: FilterConfig
  onRemove: () => void
}

const operatorLabels: Record<string, string> = {
  eq: "=",
  ne: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  like: "contains",
  ilike: "contains",
  in: "in",
  not_in: "not in",
  is_null: "is empty",
  is_not_null: "is not empty",
  contains: "contains",
  contained_by: "contained by",
  has_key: "has key"
}

export function FilterBadge({ filter, onRemove }: FilterBadgeProps) {
  const operatorLabel = operatorLabels[filter.operator] || filter.operator

  // Format the value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return ""
    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') return ""
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === 'boolean') return value ? "true" : "false"
    return String(value)
  }

  const displayValue = formatValue(filter.value)

  return (
    <Badge variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1 text-xs">
      <span className="font-medium">{filter.field}</span>
      <span className="text-muted-foreground">{operatorLabel}</span>
      {displayValue && <span>{displayValue}</span>}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="ml-1 rounded-sm hover:bg-accent p-0.5 transition-colors"
        title="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}
