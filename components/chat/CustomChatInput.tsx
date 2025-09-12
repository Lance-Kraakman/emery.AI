'use client'

import { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent, ChangeEvent } from 'react'
import { Send, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStore } from '@tanstack/react-store'
import { referenceSearchStore, referenceSearchActions, referenceSearchUtils } from '@/stores/reference-search.store'
import { searchReferences } from '@/app/actions/reference-search'
import { ChatPlusButton } from './ChatPlusButton'
import type { DropdownPosition, AnyMentionItem } from './types/chat-mentions'
import { 
  extractReferences, 
  hasReferences,
  resolveDocumentReference,
  resolveTableReference,
  resolveAgentReference,
  enrichReferenceForAI,
  type ResolvedReference
} from './utils/simple-reference-resolver'
import { usePathGenerators } from './utils/path-generators'
import { createDocumentArtifact } from './types/chat-artifacts'
import { useEmery } from '@/contexts/EmeryStoreProvider'
import { getCategoryIcon, getCategoryDisplayName } from './utils/search-display-utils'

/**
 * CustomChatInput - Direct store integration for @ mentions
 * 
 * Features:
 * - Controlled textarea with value state management
 * - @ character detection → immediate unified search
 * - Text insertion at cursor position
 * - Enter to send, Shift+Enter for new line
 * - + button for contextual references
 * - Direct TanStack Store integration
 * - Preserved canvas artifact creation
 * 
 * AIDEV-NOTE: Removed useChatMentions compatibility layer, direct store integration
 */

interface CustomChatInputProps {
  onSendMessage: (message: string) => void
  placeholder?: string
  className?: string
  onArtifactCreated?: (artifact: any) => void  // Callback for when artifacts are created
}

export function CustomChatInput({
  onSendMessage,
  placeholder = "Ask Emery anything...",
  className = "",
  onArtifactCreated
}: CustomChatInputProps) {
  // Store integration - using selectors for proper reactivity
  const isOpen = useStore(referenceSearchStore, (state) => state.isOpen)
  const query = useStore(referenceSearchStore, (state) => state.query)
  const results = useStore(referenceSearchStore, (state) => state.results)
  const loading = useStore(referenceSearchStore, (state) => state.loading)
  const error = useStore(referenceSearchStore, (state) => state.error)
  const selectedIndex = useStore(referenceSearchStore, (state) => state.selectedIndex)
  const searchDebounceMs = useStore(referenceSearchStore, (state) => state.searchDebounceMs)
  const { data: emeryData } = useEmery()
  
  // Local UI state
  const [inputValue, setInputValue] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showAtMentionDropdown, setShowAtMentionDropdown] = useState(false)
  const [atMentionPosition, setAtMentionPosition] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    left: 0,
    bottom: 0,
    maxHeight: 300,
    direction: 'up'
  })
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Get data contexts for reference resolution (preserve artifact functionality)
  const { databases, tables, fields, agents } = usePathGenerators()
  
  // Debounced search function
  const debouncedSearch = useMemo(
    () => referenceSearchUtils.debounce(async (query: string) => {
      if (referenceSearchUtils.isValidQuery(query)) {
        referenceSearchActions.setLoading(true)
        try {
          const result = await searchReferences(query, emeryData)
          if (result.success && result.data) {
            referenceSearchActions.setResults(result.data)
          } else {
            referenceSearchActions.setError(result.error || 'Search failed')
          }
        } catch (error) {
          referenceSearchActions.setError('Search request failed')
        }
      } else {
        // Clear results for invalid queries
        referenceSearchActions.setResults({
          results: [],
          totalCount: 0,
          searchTime: 0,
          query: ''
        })
      }
    }, searchDebounceMs),
    [emeryData, searchDebounceMs]
  )

  // Trigger search when query changes (for @ mentions)
  useEffect(() => {
    if (showAtMentionDropdown && query.trim() !== '') {
      debouncedSearch(query)
    }
  }, [query, showAtMentionDropdown, debouncedSearch])

  // Handle textarea changes
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const newCursorPos = e.target.selectionStart || 0
    
    setInputValue(newValue)
    setCursorPosition(newCursorPos)
    
    // Check for @ character (supports @doc, @agent, @tool, etc.)
    if (newCursorPos > 0 && newValue[newCursorPos - 1] === '@') {
      // Show @ mention search
      setShowAtMentionDropdown(true)
      setAtMentionPosition(newCursorPos - 1)
      referenceSearchActions.setIsOpen(true, 'at')
      referenceSearchActions.clear() // Clear previous search
      calculateDropdownPosition()
    } else if (showAtMentionDropdown) {
      // Update search term if @ mention is active
      const searchStart = atMentionPosition + 1
      if (newCursorPos >= searchStart) {
        const search = newValue.substring(searchStart, newCursorPos)
        // Close if space or certain characters are typed
        if (search.includes(' ') || search.includes('\n')) {
          setShowAtMentionDropdown(false)
          referenceSearchActions.setIsOpen(false)
        } else {
          referenceSearchActions.setQuery(search)
        }
      } else {
        // Cursor moved before @, close dropdown
        setShowAtMentionDropdown(false)
        referenceSearchActions.setIsOpen(false)
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
    
    // Focus search input when dropdown opens
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 100)
  }, [inputValue, cursorPosition])

  // Close @ mention dropdown when clicking outside
  useEffect(() => {
    if (!showAtMentionDropdown) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Check if click is inside dropdown
        const dropdownEl = document.querySelector('[data-at-mention-dropdown]')
        if (!dropdownEl || !dropdownEl.contains(target)) {
          setShowAtMentionDropdown(false)
          referenceSearchActions.setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAtMentionDropdown])

  // Handle keyboard events in the textarea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAtMentionDropdown && isOpen) {
      // Delegate keyboard navigation to search dropdown
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          referenceSearchActions.navigateSelection('up')
          return
        case 'ArrowDown':
          e.preventDefault()
          referenceSearchActions.navigateSelection('down')
          return
        case 'Enter':
          e.preventDefault()
          const selectedResult = results[selectedIndex]
          if (selectedResult && selectedResult.available) {
            handleAtMentionSelect(selectedResult)
          }
          return
        case 'Escape':
          e.preventDefault()
          setShowAtMentionDropdown(false)
          referenceSearchActions.setIsOpen(false)
          return
      }
    }
    
    // Handle regular textarea keyboard events
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Insert text at cursor position
  const insertTextAtCursor = useCallback((text: string) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const newValue = inputValue.substring(0, start) + text + inputValue.substring(end)
    
    setInputValue(newValue)
    
    // Set cursor position after insertion
    const newCursorPos = start + text.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      setCursorPosition(newCursorPos)
    }, 0)
  }, [inputValue])

  // Handle + button item insertion
  const handlePlusButtonInsert = (text: string, item?: AnyMentionItem) => {
    insertTextAtCursor(text + ' ')
  }

  // Handle @ mention selection
  const handleAtMentionSelect = (result: any) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const beforeAt = inputValue.substring(0, atMentionPosition)
    const afterCursor = inputValue.substring(cursorPosition)
    const newValue = beforeAt + result.insertText + ' ' + afterCursor
    
    setInputValue(newValue)
    setShowAtMentionDropdown(false)
    referenceSearchActions.setIsOpen(false)
    
    // Set cursor position after insertion
    const newCursorPos = atMentionPosition + result.insertText.length + 1
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      setCursorPosition(newCursorPos)
    }, 0)
  }

  // Handle send message with reference processing (preserve artifact functionality)
  const handleSend = async () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) return

    // Check if the message contains references that need processing
    if (hasReferences(trimmedValue)) {
      try {
        let processedMessage = trimmedValue
        const references = extractReferences(trimmedValue)
        
        // Process each reference
        for (const ref of references) {
          let resolvedRef: ResolvedReference | null = null
          
          switch (ref.type) {
            case 'document':
              // Use document data for document references - get all documents from databases
              const documentData = (emeryData?.databases || []).flatMap(db =>
                (db.tables || []).flatMap(table =>
                  // AIDEV-TODO: We need to implement actual document field access here
                  // For now, use empty array to prevent build errors
                  []
                )
              )
              resolvedRef = await resolveDocumentReference(ref.name, documentData)
              break
              
            case 'table':
              // Use table data for table references  
              const tableData = (emeryData?.databases || []).flatMap(db => 
                (db.tables || []).map(table => ({
                  id: table.id,
                  name: table.name,
                  slug: table.storageLocation,
                  databaseId: db.id,
                  databaseName: db.name
                }))
              )
              resolvedRef = await resolveTableReference(ref.name, tableData)
              break
              
            case 'agent':
              // Use agent data for agent references
              const agentData = (emeryData?.agents || []).map(agent => ({
                id: agent.id,
                name: agent.name,
                description: agent.description,
                status: 'active', // AIDEV-TODO: Add actual status when available
                capabilities: [] // AIDEV-TODO: Add actual capabilities when available
              }))
              resolvedRef = await resolveAgentReference(ref.name, agentData)
              break
          }
          
          // If reference was resolved, create artifact and enrich message
          if (resolvedRef) {
            // Create artifact for document references
            if (resolvedRef.type === 'document' && onArtifactCreated) {
              const artifact = createDocumentArtifact(
                resolvedRef.documentField,
                resolvedRef.tableId,
                resolvedRef.fieldId,
                'view'
              )
              onArtifactCreated(artifact)
            }
            
            // Replace reference in message with enriched context
            const enrichedContext = enrichReferenceForAI(resolvedRef)
            processedMessage = processedMessage.replace(ref.fullMatch, enrichedContext)
          }
        }
        
        // Send the processed message
        onSendMessage(processedMessage)
      } catch (error) {
        console.warn('Reference processing failed, sending original message:', error)
        // AIDEV-NOTE: Graceful degradation - send original message if reference processing fails
        onSendMessage(trimmedValue)
      }
    } else {
      // No references, send message as-is
      onSendMessage(trimmedValue)
    }

    // Reset input state
    setInputValue('')
    setCursorPosition(0)
    setShowAtMentionDropdown(false)
    referenceSearchActions.setIsOpen(false)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [inputValue])

  // Render @ mention search dropdown
  const renderAtMentionDropdown = () => {
    if (!showAtMentionDropdown || !isOpen) return null

    return (
      <div
        data-at-mention-dropdown
        className="fixed bg-background border border-border rounded-xl shadow-lg min-w-[320px] max-w-[400px] overflow-hidden z-50"
        style={{
          left: dropdownPosition.left,
          ...(dropdownPosition.direction === 'up' 
            ? { bottom: dropdownPosition.bottom }
            : { top: dropdownPosition.top }),
          maxHeight: dropdownPosition.maxHeight
        }}
      >
        <div className="p-2">
          {/* Search Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search mentions..."
                value={query}
                onChange={(e) => referenceSearchActions.setQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setShowAtMentionDropdown(false)
                referenceSearchActions.setIsOpen(false)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-6 text-muted-foreground">
              <div className="text-sm">Searching...</div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-6 text-red-600">
              <div className="text-sm font-medium">Search Error</div>
              <div className="text-xs mt-1">{error}</div>
            </div>
          )}

          {/* Search Results */}
          {!loading && !error && (
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {results.length > 0 ? (
                  results.map((result, index) => {
                    const isSelected = selectedIndex === index
                    const isUnavailable = !result.available

                    return (
                      <button
                        key={`${result.category}-${result.id}`}
                        className={`
                          group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors
                          ${isSelected 
                            ? 'bg-primary/10 text-primary' 
                            : isUnavailable 
                              ? 'hover:bg-muted/50 text-muted-foreground cursor-not-allowed' 
                              : 'hover:bg-muted text-foreground'
                          }
                        `}
                        onClick={() => !isUnavailable && handleAtMentionSelect(result)}
                        onMouseEnter={() => referenceSearchActions.setSelectedIndex(index)}
                        disabled={isUnavailable}
                      >
                        {getCategoryIcon(result.category, 'h-4 w-4')}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm truncate ${isUnavailable ? 'opacity-50' : ''}`}>
                              {result.displayName}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                              {getCategoryDisplayName(result.category)}
                            </span>
                          </div>
                          {result.description && (
                            <div className={`text-xs text-muted-foreground truncate ${isUnavailable ? 'opacity-50' : ''}`}>
                              {result.description}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })
                ) : query.trim() !== '' ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm font-medium">No matches found</div>
                    <div className="text-xs">No results for "{query}"</div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm font-medium">Start typing to search</div>
                    <div className="text-xs">Search across tools, agents, teams, data, settings, and documents</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Area */}
      <div className="flex items-end gap-2 p-3 border border-border rounded-xl bg-background/50 backdrop-blur-sm">
        {/* + Button */}
        <ChatPlusButton 
          onItemInsert={handlePlusButtonInsert}
          className="self-end"
        />
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="
            flex-1 bg-transparent border-0 outline-none resize-none text-sm 
            placeholder:text-muted-foreground min-h-[20px] max-h-[120px] 
            scrollbar-hide leading-5 py-2
          "
          style={{ scrollbarWidth: 'none' }}
          rows={1}
        />
        
        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          size="icon"
          className="h-8 w-8 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {/* @ Mention Search Dropdown */}
      {renderAtMentionDropdown()}
    </div>
  )
}

// AIDEV-NOTE: Complete rewrite with direct TanStack Store integration
// AIDEV-NOTE: Preserved canvas artifact creation functionality
// AIDEV-NOTE: @ mentions now use unified search instead of hierarchical categories