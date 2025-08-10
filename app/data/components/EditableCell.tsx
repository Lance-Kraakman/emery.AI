"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface FieldData {
  id: number
  tableId: number
  name: string
  slug: string
  type: string
  required: boolean
  orderIndex: number
  relatedTableId?: number
}

interface EditableCellProps {
  field: FieldData
  value: any
  onSave?: (value: any) => void
  onCancel?: () => void
}

export function EditableCell({ field, value, onSave, onCancel }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = () => {
    onSave?.(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
    onCancel?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const formatDisplayValue = () => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground italic text-xs">—</span>
    }

    switch (field.type) {
      case "boolean":
        return <Checkbox checked={Boolean(value)} disabled />
      case "date":
        try {
          const date = new Date(value)
          return format(date, "MMM d, yyyy")
        } catch {
          return <span className="text-muted-foreground italic text-xs">Invalid date</span>
        }
      case "number":
        return typeof value === "number" ? value.toLocaleString() : value
      case "email":
        return (
          <a 
            href={`mailto:${value}`} 
            className="text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {String(value)}
          </a>
        )
      case "url":
        return (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {String(value)}
          </a>
        )
      case "relation":
        // Handle JSONB relation data
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            return (
              <div className="flex flex-wrap gap-1">
                {value.slice(0, 3).map((item: any, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {item.title || item.name || item.id || "Related"}
                  </Badge>
                ))}
                {value.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{value.length - 3} more
                  </Badge>
                )}
              </div>
            )
          } else {
            return (
              <Badge variant="secondary" className="text-xs">
                {value.title || value.name || value.id || "Related"}
              </Badge>
            )
          }
        }
        return <span className="text-muted-foreground italic text-xs">No relation</span>
      case "file":
        // Handle JSONB file data
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            return (
              <div className="flex flex-wrap gap-1">
                {value.slice(0, 2).map((file: any, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {file.name || file.filename || "File"}
                  </Badge>
                ))}
                {value.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{value.length - 2} more
                  </Badge>
                )}
              </div>
            )
          } else {
            return (
              <Badge variant="outline" className="text-xs">
                {value.name || value.filename || "File"}
              </Badge>
            )
          }
        }
        return <span className="text-muted-foreground italic text-xs">No files</span>
      default:
        const strValue = String(value)
        return (
          <span className="truncate block max-w-[200px]" title={strValue}>
            {strValue}
          </span>
        )
    }
  }

  if (!isEditing) {
    return (
      <div
        className="min-h-[28px] flex items-center p-1 cursor-pointer hover:bg-muted/30 transition-colors rounded-sm"
        onClick={() => setIsEditing(true)}
      >
        {formatDisplayValue()}
      </div>
    )
  }

  switch (field.type) {
    case "boolean":
      return (
        <div className="p-1">
          <Checkbox
            checked={Boolean(editValue)}
            onCheckedChange={(checked) => {
              setEditValue(checked)
              onSave?.(checked)
              setIsEditing(false)
            }}
          />
        </div>
      )

    case "date":
      return (
        <div className="p-1">
          <Input
            type="date"
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
      )

    case "number":
      return (
        <div className="p-1">
          <Input
            type="number"
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value ? Number(e.target.value) : "")}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
      )

    case "email":
      return (
        <div className="p-1">
          <Input
            type="email"
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
            placeholder="email@example.com"
          />
        </div>
      )

    case "url":
      return (
        <div className="p-1">
          <Input
            type="url"
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
            placeholder="https://example.com"
          />
        </div>
      )

    case "relation":
      return (
        <div className="p-1">
          <Input
            type="text"
            value={typeof editValue === 'object' ? JSON.stringify(editValue) : editValue || ""}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                setEditValue(parsed)
              } catch {
                setEditValue(e.target.value)
              }
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs font-mono"
            autoFocus
            placeholder="JSON relation data"
          />
        </div>
      )

    case "file":
      return (
        <div className="p-1">
          <Input
            type="text"
            value={typeof editValue === 'object' ? JSON.stringify(editValue) : editValue || ""}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                setEditValue(parsed)
              } catch {
                setEditValue(e.target.value)
              }
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs font-mono"
            autoFocus
            placeholder="JSON file data"
          />
        </div>
      )

    default:
      return (
        <div className="p-1">
          <Input
            type="text"
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
      )
  }
}