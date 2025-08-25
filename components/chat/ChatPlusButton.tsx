'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatMentionDropdown } from './ChatMentionDropdown'
import { useChatMentions } from './useChatMentions'
import type { DropdownPosition } from './types/chat-mentions'

/**
 * ChatPlusButton - + button for inserting contextual references
 * 
 * Features:
 * - Positioned left of chat input field
 * - Opens hierarchical dropdown menu on click
 * - Smart positioning (above input, aligned left)
 * - Keyboard accessible (Tab, Enter, Escape)
 * 
 * AIDEV-NOTE: Main entry point for chat contextual references system
 */

interface ChatPlusButtonProps {
  onItemInsert: (text: string) => void
  disabled?: boolean
  className?: string
}

export function ChatPlusButton({ 
  onItemInsert, 
  disabled = false, 
  className = '' 
}: ChatPlusButtonProps) {
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    left: 0,
    bottom: 0,
    maxHeight: 300,
    direction: 'up'
  })
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const {
    dropdownState,
    availableItems,
    categories,
    openDropdown,
    closeDropdown,
    selectCategory,
    selectItem,
    handlers
  } = useChatMentions()

  // Calculate dropdown position when opened
  useEffect(() => {
    if (dropdownState.isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceAbove = rect.top
      const spaceBelow = viewportHeight - rect.bottom
      
      // Prefer showing above the input (more space typically)
      const showAbove = spaceAbove > 320 || spaceAbove > spaceBelow
      
      setDropdownPosition({
        left: rect.left,
        [showAbove ? 'bottom' : 'top']: showAbove 
          ? viewportHeight - rect.top + 8 
          : rect.bottom + 8,
        maxHeight: Math.max(200, showAbove ? spaceAbove - 20 : spaceBelow - 20),
        direction: showAbove ? 'up' : 'down'
      })
    }
  }, [dropdownState.isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownState.isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // Check if click is inside dropdown (handled by dropdown component)
        const dropdownEl = document.querySelector('[data-chat-mention-dropdown]')
        if (!dropdownEl || !dropdownEl.contains(event.target as Node)) {
          closeDropdown()
        }
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [dropdownState.isOpen, closeDropdown])

  const handleButtonClick = () => {
    if (dropdownState.isOpen) {
      closeDropdown()
    } else {
      // Open dropdown at button position (cursor position doesn't matter for + button)
      openDropdown('plus', 0)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleButtonClick()
    }
  }

  const handleItemSelect = (insertText: string) => {
    onItemInsert(insertText)
    closeDropdown()
  }

  const handleCategorySelect = (category: any) => {
    selectCategory(category)
  }

  return (
    <div className="relative">
      {/* + Button */}
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          h-10 w-10 rounded-xl flex-shrink-0 transition-all duration-200
          border shadow-sm backdrop-blur-sm
          ${dropdownState.isOpen 
            ? 'bg-primary/15 text-primary border-primary/30 shadow-primary/20 shadow-md' 
            : 'bg-background/80 border-border/60 hover:bg-accent hover:border-accent-foreground/20 text-muted-foreground hover:text-foreground'
          }
          ${className}
        `}
        title="Insert reference to tools, agents, teams, or data"
        aria-label="Open contextual reference menu"
        aria-expanded={dropdownState.isOpen}
        aria-haspopup="menu"
      >
        <Plus 
          className={`h-4 w-4 transition-transform duration-150 ${
            dropdownState.isOpen ? 'rotate-45' : 'rotate-0'
          }`} 
        />
      </Button>

      {/* Dropdown Menu */}
      {dropdownState.isOpen && (
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
            state={dropdownState}
            items={availableItems}
            categories={categories}
            onItemSelect={handleItemSelect}
            onCategorySelect={handleCategorySelect}
            onClose={closeDropdown}
            position={dropdownPosition}
          />
        </div>
      )}
    </div>
  )
}

// AIDEV-NOTE: This component provides the main UI entry point for contextual references
// AIDEV-NOTE: Handles positioning, keyboard navigation, and state management
// AIDEV-NOTE: Integrates with useChatMentions hook for business logic