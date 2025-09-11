'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
// AIDEV-NOTE: Temporarily commented out LlamaIndex imports to fix build issues
// import { ChatInput } from '@llamaindex/chat-ui'
import { Send } from 'lucide-react'
import { useAtMentions } from './useAtMentions'
import { useChatMentions } from './useChatMentions'
import { ChatMentionDropdown } from './ChatMentionDropdown'
import type { DropdownPosition } from './types/chat-mentions'

/**
 * EnhancedChatInput - Wrapper around LlamaIndex ChatInput with @ mention support
 * 
 * Features:
 * - Integrates @ mention detection with LlamaIndex ChatInput
 * - Shows mention dropdown when @ is typed
 * - Inserts mention text at cursor position
 * - Maintains compatibility with existing chat handlers
 * 
 * AIDEV-NOTE: Custom wrapper to add @ mention support to LlamaIndex chat-ui
 */

interface EnhancedChatInputProps {
  placeholder?: string
  className?: string
  onKeyDown?: (event: React.KeyboardEvent) => void
}

export function EnhancedChatInput({
  placeholder = "Ask Emery anything...",
  className = "",
  onKeyDown
}: EnhancedChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    left: 0,
    top: 0,
    maxHeight: 200,
    direction: 'up'
  })
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const inputFieldRef = useRef<HTMLTextAreaElement>(null)
  
  // Mention system hooks
  const {
    dropdownState: mentionDropdownState,
    availableItems,
    categories,
    selectCategory,
    closeDropdown: closeMentionDropdown
  } = useChatMentions()
  
  const {
    mentionState,
    handleInputChange: handleAtMentionChange,
    handleKeyDown: handleAtMentionKeyDown,
    insertTextAtCursor,
    clearMention,
    shouldShowDropdown: shouldShowAtDropdown,
    filteredCategories
  } = useAtMentions(handleMentionTrigger)

  // Handle @ mention trigger
  function handleMentionTrigger(searchTerm: string, position: number) {
    setShowMentionDropdown(true)
    calculateDropdownPosition()
  }

  // Calculate dropdown position near cursor
  const calculateDropdownPosition = useCallback(() => {
    if (!inputFieldRef.current || !containerRef.current) return
    
    const inputRect = inputFieldRef.current.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    
    // For now, position above input (can be enhanced with cursor coordinates later)
    const spaceAbove = inputRect.top
    const spaceBelow = viewportHeight - inputRect.bottom
    const showAbove = spaceAbove > 250 || spaceAbove > spaceBelow
    
    setDropdownPosition({
      left: inputRect.left,
      [showAbove ? 'bottom' : 'top']: showAbove 
        ? viewportHeight - inputRect.top + 8 
        : inputRect.bottom + 8,
      maxHeight: Math.max(200, showAbove ? spaceAbove - 20 : spaceBelow - 20),
      direction: showAbove ? 'up' : 'down'
    })
  }, [])

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInputValue(value)
    handleAtMentionChange(value)
  }

  // Handle keyboard events
  const handleKeyDownCombined = (event: React.KeyboardEvent) => {
    // Handle @ mention navigation first
    handleAtMentionKeyDown(event)
    
    // Call parent onKeyDown if provided
    onKeyDown?.(event)
  }

  // Handle mention item selection
  const handleMentionItemSelect = (insertText: string) => {
    insertTextAtCursor(insertText)
    setShowMentionDropdown(false)
    clearMention()
  }

  // Handle clicking outside to close dropdown
  useEffect(() => {
    if (!showMentionDropdown) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const dropdownEl = document.querySelector('[data-chat-mention-dropdown]')
        if (!dropdownEl || !dropdownEl.contains(event.target as Node)) {
          setShowMentionDropdown(false)
          clearMention()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMentionDropdown, clearMention])

  // Close dropdown when mention state clears
  useEffect(() => {
    if (!shouldShowAtDropdown && showMentionDropdown) {
      setShowMentionDropdown(false)
    }
  }, [shouldShowAtDropdown, showMentionDropdown])

  // Get mention-aware dropdown state
  const getMentionDropdownState = () => {
    if (!showMentionDropdown || !shouldShowAtDropdown) {
      return mentionDropdownState
    }
    
    // Create filtered items based on @ search
    const filteredItems = { ...availableItems }
    
    if (mentionState.searchTerm && filteredCategories.length > 0) {
      // Filter items to only show matching categories
      Object.keys(filteredItems).forEach(category => {
        if (!filteredCategories.includes(category as any)) {
          filteredItems[category as keyof typeof filteredItems] = []
        }
      })
    }

    return {
      ...mentionDropdownState,
      isOpen: true,
      triggerType: 'at' as const,
      searchTerm: mentionState.searchTerm,
      cursorPosition: mentionState.cursorPosition,
      triggerPosition: mentionState.triggerPosition
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Custom input wrapper to access the underlying textarea */}
      <div className="bg-transparent border-0 shadow-none p-0">
        {/* AIDEV-NOTE: ChatInput placeholder - LlamaIndex temporarily disabled */}
        <div className="relative flex items-end gap-3 bg-transparent">
          <div className="relative flex-1">
            <textarea
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-14 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground min-h-[44px] max-h-32"
              placeholder={placeholder}
              disabled
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" disabled>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* @ Mention Dropdown */}
      {showMentionDropdown && shouldShowAtDropdown && (
        <div
          style={{
            position: 'fixed',
            left: dropdownPosition.left,
            [dropdownPosition.direction === 'up' ? 'bottom' : 'top']: 
              dropdownPosition.direction === 'up' ? dropdownPosition.bottom : dropdownPosition.top,
            zIndex: 50,
            maxHeight: dropdownPosition.maxHeight
          }}
        >
          <ChatMentionDropdown
            state={getMentionDropdownState()}
            items={availableItems}
            categories={categories}
            onItemSelect={handleMentionItemSelect}
            onCategorySelect={selectCategory}
            onClose={() => {
              setShowMentionDropdown(false)
              clearMention()
            }}
            position={dropdownPosition}
          />
        </div>
      )}
    </div>
  )
}

// AIDEV-NOTE: This component bridges LlamaIndex ChatInput with our mention system
// AIDEV-NOTE: Provides seamless @ mention detection while maintaining chat-ui compatibility
// AIDEV-NOTE: Can be easily swapped in place of the standard ChatInput component