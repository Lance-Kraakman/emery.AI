'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent, ChangeEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatPlusButton } from './ChatPlusButton'
import { ChatMentionDropdown } from './ChatMentionDropdown'
import { useChatMentions } from './useChatMentions'
import type { DropdownPosition, MentionCategory, DocumentMentionItem, AnyMentionItem } from './types/chat-mentions'

/**
 * CustomChatInput - Controlled chat input with @ mention support
 * 
 * Features:
 * - Controlled textarea with value state management
 * - @ character detection for mention triggering
 * - Text insertion at cursor position
 * - Enter to send, Shift+Enter for new line
 * - + button for contextual references
 * - Full keyboard navigation support
 * 
 * AIDEV-NOTE: Custom implementation to replace LlamaIndex ChatInput for mention support
 */

interface CustomChatInputProps {
  onSendMessage: (message: string) => void
  placeholder?: string
  className?: string
}

export function CustomChatInput({
  onSendMessage,
  placeholder = "Ask Emery anything...",
  className = ""
}: CustomChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showAtMentionDropdown, setShowAtMentionDropdown] = useState(false)
  const [atMentionPosition, setAtMentionPosition] = useState(0)
  const [atMentionSearch, setAtMentionSearch] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    left: 0,
    bottom: 0,
    maxHeight: 300,
    direction: 'up'
  })
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Use the chat mentions hook
  const {
    dropdownState,
    availableItems,
    categories,
    openDropdown,
    closeDropdown,
    selectCategory,
    selectItem,
    setSearchTerm,
    navigateItems,
    goBackToMain,
    handlers
  } = useChatMentions()
  
  // AIDEV-NOTE: Canvas integration will be replaced with LlamaIndex chat-ui artifacts

  // Handle textarea changes
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const newCursorPos = e.target.selectionStart || 0
    
    setInputValue(newValue)
    setCursorPosition(newCursorPos)
    
    // Check for @ character (supports @doc, @agent, @tool, etc.)
    if (newCursorPos > 0 && newValue[newCursorPos - 1] === '@') {
      // Show @ mention dropdown
      setShowAtMentionDropdown(true)
      setAtMentionPosition(newCursorPos - 1)
      setAtMentionSearch('')
      openDropdown('at', newCursorPos)
      calculateDropdownPosition()
    } else if (showAtMentionDropdown) {
      // Update search term if @ mention is active
      const searchStart = atMentionPosition + 1
      if (newCursorPos >= searchStart) {
        const search = newValue.substring(searchStart, newCursorPos)
        // Close if space or certain characters are typed
        if (search.includes(' ') || search.includes('\n')) {
          setShowAtMentionDropdown(false)
          closeDropdown()
        } else {
          setAtMentionSearch(search)
          setSearchTerm(search)
        }
      } else {
        // Cursor moved before @, close dropdown
        setShowAtMentionDropdown(false)
        closeDropdown()
      }
    }
  }

  // Calculate dropdown position based on cursor
  const calculateDropdownPosition = useCallback(() => {
    if (!textareaRef.current || !containerRef.current) return
    
    const textarea = textareaRef.current
    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    
    // Estimate cursor position (simplified - could be enhanced with proper caret positioning)
    const lineHeight = 20
    const charWidth = 8
    const lines = inputValue.substring(0, cursorPosition).split('\n')
    const currentLine = lines[lines.length - 1]
    
    const x = containerRect.left + 16 + (currentLine.length * charWidth) // padding + char position
    const y = containerRect.top + (lines.length * lineHeight)
    
    const viewportHeight = window.innerHeight
    const spaceAbove = y
    const spaceBelow = viewportHeight - y - lineHeight
    
    const showAbove = spaceAbove > 250 || spaceAbove > spaceBelow
    
    setDropdownPosition({
      left: Math.min(x, window.innerWidth - 420), // Ensure dropdown fits in viewport
      [showAbove ? 'bottom' : 'top']: showAbove 
        ? viewportHeight - y + lineHeight 
        : y + lineHeight,
      maxHeight: Math.max(200, showAbove ? spaceAbove - 20 : spaceBelow - 20),
      direction: showAbove ? 'up' : 'down'
    })
  }, [inputValue, cursorPosition])

  // Insert text at cursor position
  const insertTextAtCursor = useCallback((text: string) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    
    // If @ mention is active, replace from @ position to cursor
    let newValue: string
    let newCursorPos: number
    
    if (showAtMentionDropdown) {
      // Replace from @ position to current cursor
      const beforeAt = inputValue.substring(0, atMentionPosition)
      const afterCursor = inputValue.substring(cursorPosition)
      newValue = beforeAt + text + afterCursor
      newCursorPos = atMentionPosition + text.length
      
      setShowAtMentionDropdown(false)
      closeDropdown()
    } else {
      // Normal insertion at cursor
      const before = inputValue.substring(0, start)
      const after = inputValue.substring(end)
      newValue = before + text + after
      newCursorPos = start + text.length
    }
    
    setInputValue(newValue)
    setCursorPosition(newCursorPos)
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }, [inputValue, showAtMentionDropdown, atMentionPosition, cursorPosition, closeDropdown])

  // Handle + button mention insertion 
  const handlePlusButtonInsert = (text: string, item?: AnyMentionItem) => {
    insertTextAtCursor(text + ' ')
    
    // AIDEV-TODO: Create document/file artifacts using LlamaIndex chat-ui system
    if (item && item.category === 'documents') {
      console.log('TODO: Create document artifact for:', item)
    }
  }

  // Handle @ mention selection
  const handleAtMentionSelect = (text: string, item?: AnyMentionItem) => {
    insertTextAtCursor(text + ' ')
    
    // AIDEV-TODO: Create document/file artifacts using LlamaIndex chat-ui system
    if (item && item.category === 'documents') {
      console.log('TODO: Create document artifact for:', item)
    }
  }

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // If dropdown is open, let it handle navigation
    if ((dropdownState.isOpen || showAtMentionDropdown) && 
        ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
      handlers.onKeyDown(e as any)
      
      if (e.key === 'Enter' && !e.defaultPrevented) {
        // Enter was pressed but not handled by dropdown, send message
        if (!e.shiftKey && inputValue.trim()) {
          e.preventDefault()
          handleSend()
        }
      }
      return
    }
    
    // Handle Enter to send (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Send message
  const handleSend = () => {
    const trimmedValue = inputValue.trim()
    if (trimmedValue) {
      onSendMessage(trimmedValue)
      setInputValue('')
      setCursorPosition(0)
      setShowAtMentionDropdown(false)
      closeDropdown()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`
    }
  }, [inputValue])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-end gap-3">
        {/* + Button for contextual references */}
        <ChatPlusButton 
          onItemInsert={handlePlusButtonInsert}
          className="mb-1"
        />
        
        {/* Input container */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-14 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground min-h-[44px] max-h-32 overflow-y-auto"
            rows={1}
          />
          
          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* @ Mention Dropdown */}
      {showAtMentionDropdown && (
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
            state={{
              ...dropdownState,
              isOpen: true,
              triggerType: 'at',
              searchTerm: atMentionSearch
            }}
            items={availableItems}
            categories={categories}
            onItemSelect={handleAtMentionSelect}
            onCategorySelect={selectCategory}
            onClose={() => {
              setShowAtMentionDropdown(false)
              closeDropdown()
            }}
            position={dropdownPosition}
          />
        </div>
      )}
    </div>
  )
}

// AIDEV-NOTE: This custom input replaces LlamaIndex ChatInput to support @ mentions
// AIDEV-NOTE: Provides controlled input with cursor tracking and text insertion
// AIDEV-NOTE: Handles both + button and @ character mention triggers