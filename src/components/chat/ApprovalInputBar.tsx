'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { AwaitingInputState } from './types/extended-chat-handler'

interface ApprovalInputBarProps {
  awaitingInput: AwaitingInputState
  onRespond: (response: string) => void
  disabled?: boolean
}

/**
 * ApprovalInputBar - Compact HITL UI that appears above chat input
 *
 * AIDEV-NOTE: Claude Code-style keyboard navigation:
 * - Arrow Up/Down to navigate between options
 * - Enter to select highlighted option
 * - Start typing to auto-focus input for custom feedback
 * - Input Enter to send feedback
 */
export function ApprovalInputBar({
  awaitingInput,
  onRespond,
  disabled = false
}: ApprovalInputBarProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const options = awaitingInput.options || []

  // Auto-focus input on mount
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Global keyboard handler
  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if input is focused and has content
      if (document.activeElement === inputRef.current && customInput) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onRespond(customInput.trim())
          setCustomInput('')
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, options.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (options[selectedIndex]) {
          onRespond(options[selectedIndex].id)
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Any printable character - focus input and type
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, options, selectedIndex, customInput, onRespond])

  // Handle input keydown
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customInput.trim()) {
      e.preventDefault()
      onRespond(customInput.trim())
      setCustomInput('')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setCustomInput('')
      inputRef.current?.blur()
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "border-t bg-muted/30 px-3 py-2 mb-2",
        disabled && "opacity-60"
      )}
    >
      {/* Title */}
      <div className="text-xs text-muted-foreground mb-2">
        {awaitingInput.title || 'Waiting for your response'}
      </div>

      {/* Options list + custom input (all styled the same) */}
      <div className="space-y-0.5">
        {options.map((option, index) => {
          const isSelected = index === selectedIndex
          return (
            <div
              key={option.id}
              className={cn(
                "flex items-center gap-2 py-0.5 px-1 rounded cursor-pointer transition-colors text-sm",
                isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
              onClick={() => {
                if (!disabled) {
                  onRespond(option.id)
                }
              }}
            >
              <span className={cn(
                "font-mono w-4 flex-shrink-0",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {isSelected ? '>' : ' '}
              </span>
              <span className="font-mono w-4 flex-shrink-0 text-muted-foreground">
                {index + 1}.
              </span>
              <span className={isSelected ? "font-medium" : ""}>
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-muted-foreground ml-1">
                  - {option.description}
                </span>
              )}
            </div>
          )
        })}

        {/* Custom input row - styled exactly like options */}
        <div
          className={cn(
            "flex items-center gap-2 py-0.5 px-1 rounded cursor-text transition-colors text-sm",
            customInput ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
          )}
          onClick={() => inputRef.current?.focus()}
        >
          <span className={cn(
            "font-mono w-4 flex-shrink-0",
            customInput ? "text-primary" : "text-muted-foreground"
          )}>
            {customInput ? '>' : ' '}
          </span>
          <span className="font-mono w-4 flex-shrink-0 text-muted-foreground">
            {options.length + 1}.
          </span>
          <input
            ref={inputRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Or type feedback..."
            disabled={disabled}
            className={cn(
              "flex-1 bg-transparent border-none outline-none text-sm",
              "placeholder:text-muted-foreground",
              customInput && "font-medium"
            )}
          />
        </div>
      </div>
    </div>
  )
}
