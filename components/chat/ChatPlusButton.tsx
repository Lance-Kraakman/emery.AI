'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@tanstack/react-store'
import { referenceSearchStore, referenceSearchActions, referenceSearchUtils } from '@/stores/reference-search.store'
import { searchReferences } from '@/app/actions/reference-search'
import { useEmery } from '@/contexts/EmeryStoreProvider'
import type { DropdownPosition, AnyMentionItem } from './types/chat-mentions'
import { ReferenceSearchDropdown } from './store/ReferenceSearchDropdown'

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
  // Local UI state for dropdown management
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  // Subscribe to search data from store
  const query = useStore(referenceSearchStore, (state) => state.query)
  const results = useStore(referenceSearchStore, (state) => state.results)
  const loading = useStore(referenceSearchStore, (state) => state.loading)
  const error = useStore(referenceSearchStore, (state) => state.error)
  
  const { data: emeryData } = useEmery()
  
  // Local UI state
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    left: 0,
    bottom: 0,
    maxHeight: 300,
    direction: 'up'
  })
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  
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
    }, 300),
    [emeryData]
  )

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
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleButtonClick = () => {
    if (isOpen) {
      setIsOpen(false)
    } else {
      setIsOpen(true)
      setSelectedIndex(0)
      referenceSearchActions.clear() // Clear previous search
    }
  }

  const handleSearchChange = (value: string) => {
    referenceSearchActions.setQuery(value)
    setSelectedIndex(0) // Reset selection when query changes
    if (value.trim() !== '') {
      debouncedSearch(value)
    }
  }

  const handleItemSelect = (item: AnyMentionItem) => {
    onItemInsert(item.insertText, item)
    setIsOpen(false)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleKeyNavigation = (direction: 'up' | 'down') => {
    const maxIndex = results.length - 1
    if (direction === 'down') {
      setSelectedIndex(prev => prev < maxIndex ? prev + 1 : 0)
    } else {
      setSelectedIndex(prev => prev > 0 ? prev - 1 : maxIndex)
    }
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
      
      <ReferenceSearchDropdown
        isOpen={isOpen}
        position={dropdownPosition}
        query={query}
        results={results}
        loading={loading}
        error={error}
        selectedIndex={selectedIndex}
        onItemSelect={handleItemSelect}
        onSearchChange={handleSearchChange}
        onKeyNavigation={handleKeyNavigation}
        onClose={handleClose}
      />
    </>
  )
}

// AIDEV-NOTE: Complete rewrite using direct TanStack Store integration
// AIDEV-NOTE: No category selection - immediate unified search experience
// AIDEV-NOTE: Flat results list with category badges for quick identification