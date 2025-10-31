"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"

export interface InlineRenameProps {
  value: string
  onSave: (newValue: string) => void | Promise<void>
  onCancel: () => void
  className?: string
  autoFocus?: boolean
}

/**
 * Inline contenteditable input for renaming items
 * - Auto-focuses on mount
 * - Saves on Enter or blur
 * - Cancels on Escape
 * - Validates for empty names
 */
export function InlineRename({
  value,
  onSave,
  onCancel,
  className = "",
  autoFocus = true
}: InlineRenameProps) {
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  const handleSave = async () => {
    const trimmedValue = editValue.trim()

    // Don't save if empty or unchanged
    if (!trimmedValue || trimmedValue === value) {
      onCancel()
      return
    }

    setIsSaving(true)
    try {
      await onSave(trimmedValue)
    } catch (error) {
      console.error("Error saving rename:", error)
      // On error, stay in edit mode
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  const handleBlur = () => {
    // Small delay to allow click events to complete
    setTimeout(() => {
      if (!isSaving) {
        handleSave()
      }
    }, 100)
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      disabled={isSaving}
      className={`h-7 text-sm ${className}`}
      aria-label="Rename input"
    />
  )
}
