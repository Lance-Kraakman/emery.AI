"use client"

import React from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ChevronDown, Edit, Trash2 } from "lucide-react"
import type { FieldDTO } from "@/app/mappers/field-mapper"

interface ColumnHeaderProps {
  field: FieldDTO
  onEdit: (field: FieldDTO) => void
  onDelete: (fieldName: string) => void
}

export function ColumnHeader({ field, onEdit, onDelete }: ColumnHeaderProps) {
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

  return (
    <div className="flex items-center justify-between w-full gap-1">
      <span className="truncate flex-1">{field.name}</span>
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
