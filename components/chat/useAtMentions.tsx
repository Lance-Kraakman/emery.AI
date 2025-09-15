'use client'

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import type { MentionCategory } from './types/chat-mentions'

/**
 * useAtMentions - Hook for handling @ mention detection and text insertion
 * 
 * Features:
 * - Detects @ character typing in input fields
 * - Tracks cursor position for precise text insertion
 * - Manages mention dropdown state triggered by @
 * - Provides text insertion at cursor position
 * 
 * AIDEV-NOTE: Custom implementation since LlamaIndex chat-ui doesn't have built-in mentions
 */

interface AtMentionState {
  isTriggered: boolean
  triggerPosition: number
  searchTerm: string
  cursorPosition: number
}

interface AtMentionHook {
  // State
  mentionState: AtMentionState

  // Refs for input tracking
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>

  // Handlers
  handleInputChange: (value: string) => void
  handleKeyDown: (event: React.KeyboardEvent) => void
  insertTextAtCursor: (text: string) => void
  clearMention: () => void
  triggerExternally: () => void // New function to trigger @ dropdown externally

  // Computed values
  shouldShowDropdown: boolean
  filteredCategories: MentionCategory[]
}

// Create a shared trigger function that can be accessed by other components
let globalTriggerFunction: (() => void) | null = null

export function useAtMentions(onMentionTrigger?: (searchTerm: string, position: number) => void): AtMentionHook {
  const [mentionState, setMentionState] = useState<AtMentionState>({
    isTriggered: false,
    triggerPosition: -1,
    searchTerm: '',
    cursorPosition: 0
  })
  
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const previousValueRef = useRef<string>('')

  // Handle input changes and detect @ mentions
  const handleInputChange = useCallback((value: string) => {
    const input = inputRef.current
    if (!input) return

    const cursorPos = input.selectionStart || 0
    const previousValue = previousValueRef.current

    // Update previous value for next comparison
    previousValueRef.current = value

    // Find the last @ symbol before cursor position
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex >= 0) {
      // Check if @ is at start of word (preceded by space or start of string)
      const charBeforeAt = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' '
      const isStartOfWord = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0

      if (isStartOfWord) {
        const searchTerm = textBeforeCursor.slice(lastAtIndex + 1)
        
        // Only trigger if search term doesn't contain spaces (single word)
        const hasSpaces = searchTerm.includes(' ') || searchTerm.includes('\n')
        
        if (!hasSpaces) {
          setMentionState({
            isTriggered: true,
            triggerPosition: lastAtIndex,
            searchTerm: searchTerm,
            cursorPosition: cursorPos
          })
          
          // Notify parent component
          onMentionTrigger?.(searchTerm, lastAtIndex)
          return
        }
      }
    }

    // Clear mention state if no valid @ trigger found
    if (mentionState.isTriggered) {
      setMentionState({
        isTriggered: false,
        triggerPosition: -1,
        searchTerm: '',
        cursorPosition: cursorPos
      })
    }
  }, [mentionState.isTriggered, onMentionTrigger])

  // Handle keyboard events for mention navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!mentionState.isTriggered) return

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        clearMention()
        break
      case ' ':
      case 'Enter':
        // Clear mention on space or enter (if not selecting from dropdown)
        if (!event.shiftKey && event.key === 'Enter') {
          clearMention()
        }
        break
    }
  }, [mentionState.isTriggered])

  // Insert text at current cursor position
  const insertTextAtCursor = useCallback((text: string) => {
    const input = inputRef.current
    if (!input || !mentionState.isTriggered) return

    const currentValue = input.value
    const triggerPos = mentionState.triggerPosition
    const cursorPos = mentionState.cursorPosition

    // Replace the @ and search term with the selected text
    const beforeAt = currentValue.slice(0, triggerPos)
    const afterCursor = currentValue.slice(cursorPos)
    const newValue = beforeAt + text + ' ' + afterCursor

    // Update input value
    input.value = newValue

    // Calculate new cursor position (after inserted text + space)
    const newCursorPos = triggerPos + text.length + 1
    
    // Set cursor position
    setTimeout(() => {
      input.setSelectionRange(newCursorPos, newCursorPos)
      input.focus()
    }, 0)

    // Clear mention state
    clearMention()

    // Trigger change event for React to pick up
    const changeEvent = new Event('input', { bubbles: true })
    input.dispatchEvent(changeEvent)
  }, [mentionState])

  // Clear mention state
  const clearMention = useCallback(() => {
    setMentionState({
      isTriggered: false,
      triggerPosition: -1,
      searchTerm: '',
      cursorPosition: 0
    })
  }, [])

  // Trigger @ dropdown externally
  const triggerExternally = useCallback(() => {
    const input = inputRef.current
    if (!input) return

    const cursorPos = input.selectionStart || input.value.length

    // Add @ at cursor position
    const currentValue = input.value
    const beforeCursor = currentValue.slice(0, cursorPos)
    const afterCursor = currentValue.slice(cursorPos)
    const newValue = beforeCursor + '@' + afterCursor

    // Update input value
    input.value = newValue

    // Set cursor after @
    const newCursorPos = cursorPos + 1
    input.setSelectionRange(newCursorPos, newCursorPos)

    // Update previous value ref
    previousValueRef.current = newValue

    // Trigger mention state
    setMentionState({
      isTriggered: true,
      triggerPosition: cursorPos,
      searchTerm: '',
      cursorPosition: newCursorPos
    })

    // Notify parent component
    onMentionTrigger?.('', cursorPos)

    // Trigger change event for React
    const changeEvent = new Event('input', { bubbles: true })
    input.dispatchEvent(changeEvent)
  }, [onMentionTrigger])

  // Set global trigger function so other components can access it
  useEffect(() => {
    globalTriggerFunction = triggerExternally
    return () => {
      globalTriggerFunction = null
    }
  }, [triggerExternally])

  // Filter categories based on search term
  const filteredCategories: MentionCategory[] = useMemo(() => {
    if (!mentionState.isTriggered || !mentionState.searchTerm) {
      return ['tools', 'agents', 'teams', 'data', 'settings']
    }

    const term = mentionState.searchTerm.toLowerCase()
    const categoryMap = {
      'tool': 'tools' as MentionCategory,
      'tools': 'tools' as MentionCategory,
      'agent': 'agents' as MentionCategory,
      'agents': 'agents' as MentionCategory,
      'bot': 'agents' as MentionCategory,
      'team': 'teams' as MentionCategory,
      'teams': 'teams' as MentionCategory,
      'data': 'data' as MentionCategory,
      'database': 'data' as MentionCategory,
      'table': 'data' as MentionCategory,
      'setting': 'settings' as MentionCategory,
      'settings': 'settings' as MentionCategory,
      'config': 'settings' as MentionCategory
    }

    // Check for exact matches first
    if (categoryMap[term as keyof typeof categoryMap]) {
      return [categoryMap[term as keyof typeof categoryMap]]
    }

    // Check for partial matches
    const matches: MentionCategory[] = []
    Object.entries(categoryMap).forEach(([key, category]) => {
      if (key.includes(term) && !matches.includes(category)) {
        matches.push(category)
      }
    })

    return matches.length > 0 ? matches : ['tools', 'agents', 'teams', 'data', 'settings']
  }, [mentionState.isTriggered, mentionState.searchTerm])

  // Computed properties
  const shouldShowDropdown = mentionState.isTriggered && mentionState.searchTerm.length >= 0

  return {
    // State
    mentionState,

    // Refs
    inputRef,

    // Handlers
    handleInputChange,
    handleKeyDown,
    insertTextAtCursor,
    clearMention,
    triggerExternally,

    // Computed values
    shouldShowDropdown,
    filteredCategories
  }
}

// Helper function to get cursor coordinates relative to viewport
export function getCursorCoordinates(input: HTMLTextAreaElement | HTMLInputElement, position: number) {
  const div = document.createElement('div')
  const style = getComputedStyle(input)
  
  // Copy relevant styles
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.font = style.font
  div.style.padding = style.padding
  div.style.border = style.border
  div.style.width = style.width
  div.style.height = style.height
  
  document.body.appendChild(div)
  
  const textBeforeCursor = input.value.substring(0, position)
  const textAfterCursor = input.value.substring(position)
  
  div.innerHTML = textBeforeCursor + '<span></span>' + textAfterCursor
  
  const span = div.querySelector('span')
  const rect = input.getBoundingClientRect()
  const spanRect = span?.getBoundingClientRect()
  
  document.body.removeChild(div)
  
  if (!spanRect) {
    return { x: rect.left, y: rect.top }
  }
  
  return {
    x: spanRect.left,
    y: spanRect.top
  }
}

// Export function for external components to trigger @ dropdown
export function triggerAtMentions() {
  if (globalTriggerFunction) {
    globalTriggerFunction()
  }
}

// AIDEV-NOTE: This hook provides comprehensive @ mention detection and text insertion
// AIDEV-NOTE: Works with standard input elements and provides cursor position tracking
// AIDEV-NOTE: Integrates seamlessly with the existing mention system architecture