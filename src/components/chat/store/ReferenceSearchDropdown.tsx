'use client'

import React from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { ScrollArea } from '@/src/components/ui/scroll-area'
import { getCategoryIcon, getCategoryDisplayName } from '../utils/search-display-utils'
import type { DropdownPosition, AnyMentionItem } from '../types/chat-mentions'

interface ReferenceSearchDropdownProps {
  isOpen: boolean
  position: DropdownPosition
  query: string
  results: any[]
  loading: boolean
  error: string | null
  selectedIndex: number
  onItemSelect: (item: any) => void
  onSearchChange: (value: string) => void
  onKeyNavigation: (direction: 'up' | 'down') => void
  onClose: () => void
}

/**
 * Pure controlled component for reference search dropdown
 * No internal state - all state managed by parent
 */
export function ReferenceSearchDropdown({ 
  isOpen,
  position, 
  query,
  results,
  loading,
  error,
  selectedIndex,
  onItemSelect, 
  onSearchChange,
  onKeyNavigation,
  onClose 
}: ReferenceSearchDropdownProps) {
  if (!isOpen) return null

  const handleItemSelect = (result: any) => {
    // Convert store result to compatible format
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
    
    onItemSelect(compatItem)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        onKeyNavigation('up')
        break
      case 'ArrowDown':
        event.preventDefault()
        onKeyNavigation('down')
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
        onClose()
        break
    }
  }

  return (
    <div
      data-chat-search-dropdown
      className="fixed bg-background border border-border rounded-xl shadow-lg min-w-[320px] max-w-[400px] overflow-hidden z-50"
      style={{
        left: position.left,
        ...(position.direction === 'up' 
          ? { bottom: position.bottom }
          : { top: position.top }),
        maxHeight: position.maxHeight
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
              placeholder="Search mentions..."
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
              autoFocus
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onClose}
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
                      onMouseEnter={() => {}} // No hover selection for now - could add prop if needed
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