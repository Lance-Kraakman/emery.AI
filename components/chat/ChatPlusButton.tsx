'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStore } from '@tanstack/react-store'
import { referenceSearchStore, referenceSearchActions, referenceSearchUtils } from '@/stores/reference-search.store'
import { searchReferences } from '@/app/actions/reference-search'
import { useEmery } from '@/contexts/EmeryStoreProvider'
import type { DropdownPosition, AnyMentionItem } from './types/chat-mentions'
import { getCategoryIcon, getCategoryDisplayName } from './utils/search-display-utils'

/**
 * ChatPlusButton - Direct search interface with TanStack Store
 * 
 * Features:
 * - Click + button → immediate search input (no categories)
 * - Real-time unified search across all domains
 * - Flat results list with category badges
 * - Direct TanStack Store integration
 * 
 * AIDEV-NOTE: Completely replaced hierarchical system with unified search
 */

interface ChatPlusButtonProps {
  onItemInsert: (text: string, item?: AnyMentionItem) => void
  disabled?: boolean
  className?: string
}

export function ChatPlusButton({ 
  onItemInsert, 
  disabled = false, 
  className = '' 
}: ChatPlusButtonProps) {
  // Store integration - using selectors for proper reactivity
  const isOpen = useStore(referenceSearchStore, (state) => state.isOpen)
  const query = useStore(referenceSearchStore, (state) => state.query)
  const results = useStore(referenceSearchStore, (state) => state.results)
  const loading = useStore(referenceSearchStore, (state) => state.loading)
  const error = useStore(referenceSearchStore, (state) => state.error)
  const selectedIndex = useStore(referenceSearchStore, (state) => state.selectedIndex)
  const searchDebounceMs = useStore(referenceSearchStore, (state) => state.searchDebounceMs)
  const { data: emeryData } = useEmery()
  
  // Debug store state changes
  console.log('[ChatPlusButton] Store state:', { isOpen, query, resultsCount: results.length })
  
  // Local UI state
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    left: 0,
    bottom: 0,
    maxHeight: 300,
    direction: 'up'
  })
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
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

  // Trigger search when query changes
  useEffect(() => {
    if (isOpen && query.trim() !== '') {
      debouncedSearch(query)
    }
  }, [query, isOpen, debouncedSearch])

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceAbove = rect.top
      const spaceBelow = viewportHeight - rect.bottom
      
      // Prefer showing above the input
      const showAbove = spaceAbove > 320 || spaceAbove > spaceBelow
      
      setDropdownPosition({
        left: rect.left,
        [showAbove ? 'bottom' : 'top']: showAbove 
          ? viewportHeight - rect.top + 8 
          : rect.bottom + 8,
        maxHeight: Math.max(200, showAbove ? spaceAbove - 20 : spaceBelow - 20),
        direction: showAbove ? 'up' : 'down'
      })
      
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is inside dropdown
        const dropdownEl = document.querySelector('[data-chat-search-dropdown]')
        if (!dropdownEl || !dropdownEl.contains(target)) {
          referenceSearchActions.setIsOpen(false)
        }
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        referenceSearchActions.setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleButtonClick = () => {
    console.log('[ChatPlusButton] Button clicked, current state:', { isOpen })
    if (isOpen) {
      console.log('[ChatPlusButton] Closing dropdown')
      referenceSearchActions.setIsOpen(false)
    } else {
      console.log('[ChatPlusButton] Opening dropdown')
      referenceSearchActions.setIsOpen(true, 'plus')
      referenceSearchActions.clear() // Clear previous search
    }
  }

  const handleSearchChange = (value: string) => {
    referenceSearchActions.setQuery(value)
  }

  const handleItemSelect = (result: any) => {
    // Convert store result to compatible format for onItemInsert
    const compatItem = {
      id: result.id,
      name: result.name,
      displayName: result.displayName,
      description: result.description,
      category: result.category,
      insertText: result.insertText,
      available: result.available,
      icon: getCategoryIcon(result.category)
    } as AnyMentionItem
    
    onItemInsert(result.insertText, compatItem)
    referenceSearchActions.setIsOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        referenceSearchActions.navigateSelection('up')
        break
      case 'ArrowDown':
        event.preventDefault()
        referenceSearchActions.navigateSelection('down')
        break
      case 'Enter':
        event.preventDefault()
        const selectedResult = results[selectedIndex]
        if (selectedResult && selectedResult.available) {
          handleItemSelect(selectedResult)
        }
        break
      case 'Escape':
        event.preventDefault()
        referenceSearchActions.setIsOpen(false)
        break
    }
  }

  const renderSearchDropdown = () => {
    console.log('[ChatPlusButton] Render dropdown check:', { isOpen })
    if (!isOpen) return null

    return (
      <div
        data-chat-search-dropdown
        className="fixed bg-background border border-border rounded-xl shadow-lg min-w-[320px] max-w-[400px] overflow-hidden z-50"
        style={{
          left: dropdownPosition.left,
          ...(dropdownPosition.direction === 'up' 
            ? { bottom: dropdownPosition.bottom }
            : { top: dropdownPosition.top }),
          maxHeight: dropdownPosition.maxHeight
        }}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => referenceSearchActions.setIsOpen(false)}
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
                        onClick={() => !isUnavailable && handleItemSelect(result)}
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
    <>
      <Button
        ref={buttonRef}
        size="icon"
        variant="ghost"
        disabled={disabled}
        onClick={handleButtonClick}
        className={`h-9 w-9 ${className}`}
        aria-label="Insert reference"
      >
        <Plus className="h-4 w-4" />
      </Button>
      
      {renderSearchDropdown()}
    </>
  )
}

// AIDEV-NOTE: Complete rewrite using direct TanStack Store integration
// AIDEV-NOTE: No category selection - immediate unified search experience
// AIDEV-NOTE: Flat results list with category badges for quick identification