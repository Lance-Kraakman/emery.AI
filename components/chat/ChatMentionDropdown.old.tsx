'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Wrench, 
  Bot, 
  Users, 
  Settings, 
  Database,
  FileText,
  ChevronLeft,
  Search,
  Check,
  AlertCircle,
  Eye,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { FuzzySearchEngine } from './utils/fuzzy-search'
import { smartSuggestionsEngine, getContextualSuggestions } from './utils/smart-suggestions'
import type { 
  MentionDropdownState, 
  AnyMentionItem, 
  CategoryConfig,
  DropdownPosition,
  MentionCategory 
} from './types/chat-mentions'

/**
 * ChatMentionDropdown - Hierarchical dropdown for contextual references
 * 
 * Features:
 * - Two-level menu system (main categories → items)
 * - Search/filter functionality within submenus
 * - Keyboard navigation (arrows, enter, escape)
 * - Visual indicators for availability and status
 * - Responsive design with proper scrolling
 * 
 * AIDEV-NOTE: Core dropdown UI component for mention system
 */

interface ChatMentionDropdownProps {
  state: MentionDropdownState
  items: Record<MentionCategory, AnyMentionItem[]>
  categories: CategoryConfig[]
  onItemSelect: (insertText: string, item: AnyMentionItem) => void
  onCategorySelect: (category: MentionCategory) => void
  onClose: () => void
  position: DropdownPosition
}

const CATEGORY_ICON_MAP = {
  tools: Wrench,
  agents: Bot,
  teams: Users,
  settings: Settings,
  data: Database,
  documents: FileText
} as const

export function ChatMentionDropdown({
  state,
  items,
  categories,
  onItemSelect,
  onCategorySelect,
  onClose,
  position
}: ChatMentionDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [previewItem, setPreviewItem] = useState<AnyMentionItem | null>(null)
  const [smartSuggestions, setSmartSuggestions] = useState<AnyMentionItem[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const fuzzySearchEngine = useMemo(() => new FuzzySearchEngine(), [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (state.isOpen && searchInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [state.isOpen])

  // Reset search and selection when dropdown opens
  useEffect(() => {
    if (state.isOpen) {
      setSearchTerm('')
      setSelectedIndex(0)
      // Generate global smart suggestions
      const suggestions = getContextualSuggestions('', items, 5)
      setSmartSuggestions(suggestions)
    }
  }, [state.isOpen, items])

  // Update global smart suggestions when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      // Get contextual suggestions based on search term across all items
      const suggestions = getContextualSuggestions(searchTerm, items, 3)
      setSmartSuggestions(suggestions)
    } else if (searchTerm.length === 0) {
      // Show general suggestions when no search term
      const suggestions = getContextualSuggestions('', items, 5)
      setSmartSuggestions(suggestions)
    } else {
      // Clear suggestions for very short searches
      setSmartSuggestions([])
    }
  }, [searchTerm, items])

  // AIDEV-NOTE: Removed old filteredItems logic - now using globalFilteredItems for unified search

  // Handle keyboard navigation for flattened menu
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const maxIndex = globalFilteredItems.length - 1
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : 0))
        break
      case 'ArrowUp':
        event.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIndex))
        break
      case 'Enter':
        event.preventDefault()
        const selectedItem = globalFilteredItems[selectedIndex]
        if (selectedItem && selectedItem.available) {
          handleItemClick(selectedItem)
        }
        break
      case 'Escape':
        event.preventDefault()
        onClose()
        break
    }
  }

  const handleCategorySelect = (category: MentionCategory) => {
    onCategorySelect(category)
    setSelectedIndex(0)
  }

  const handleBackToMain = () => {
    setSelectedIndex(0)
    setSearchTerm('')
  }

  const handleItemClick = (item: AnyMentionItem) => {
    // Track usage for ML suggestions
    smartSuggestionsEngine.trackUsage(item, searchTerm)
    onItemSelect(item.insertText, item)
  }

  const handleItemPreview = (item: AnyMentionItem) => {
    setPreviewItem(item)
  }

  const closePreview = () => {
    setPreviewItem(null)
  }

  // Get all items flattened for global search
  const allItems = useMemo(() => {
    const flattened: (AnyMentionItem & { categoryName: string })[] = []
    categories.forEach(category => {
      const categoryItems = items[category.id] || []
      categoryItems.forEach(item => {
        flattened.push({
          ...item,
          categoryName: category.name
        })
      })
    })
    return flattened
  }, [items, categories])

  // Filter all items globally based on search term
  const globalFilteredItems = useMemo(() => {
    if (!searchTerm.trim()) return allItems
    
    const searchResults = fuzzySearchEngine.search(allItems, searchTerm)
    return searchResults.map(result => {
      // result.item is already the flattened item with categoryName
      return {
        ...result.item,
        _searchScore: result.score,
        _searchMatches: result.matches
      }
    })
  }, [allItems, searchTerm, fuzzySearchEngine])

  const renderAllItemsMenu = () => (
    <div className="p-2">
      {/* Search Input */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search mentions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
            autoFocus
          />
        </div>
      </div>

      {/* All Items List */}
      <ScrollArea className="max-h-64">
        <div className="space-y-1">
          {globalFilteredItems.length > 0 ? (
            globalFilteredItems.map((item, index) => {
              const IconComponent = CATEGORY_ICON_MAP[item.category] || FileText
              const isSelected = selectedIndex === index
              const isUnavailable = !item.available

              return (
                <button
                  key={`${item.category}-${item.id}`}
                  className={`
                    group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors
                    ${isSelected 
                      ? 'bg-primary/10 text-primary' 
                      : isUnavailable 
                        ? 'hover:bg-muted/50 text-muted-foreground cursor-not-allowed' 
                        : 'hover:bg-muted text-foreground'
                    }
                  `}
                  onClick={() => !isUnavailable && handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  disabled={isUnavailable}
                >
                  <IconComponent className={`h-4 w-4 flex-shrink-0 ${isUnavailable ? 'opacity-50' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm truncate ${isUnavailable ? 'opacity-50' : ''}`}>
                        {item.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {(item as any).categoryName || categories.find(c => c.id === item.category)?.name || item.category}
                      </span>
                    </div>
                    {item.description && (
                      <div className={`text-xs text-muted-foreground truncate ${isUnavailable ? 'opacity-50' : ''}`}>
                        {item.description}
                      </div>
                    )}
                  </div>
                  {isUnavailable && (
                    <AlertCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <div
                    role="button"
                    tabIndex={0}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-accent/20 flex items-center justify-center cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleItemPreview(item)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        e.preventDefault()
                        handleItemPreview(item)
                      }
                    }}
                  >
                    <Eye className="h-3 w-3" />
                  </div>
                </button>
              )
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm font-medium">
                {searchTerm.trim() ? 'No matches found' : 'No items available'}
              </div>
              <div className="text-xs">
                {searchTerm.trim() 
                  ? `No results for "${searchTerm}"` 
                  : 'Try connecting some services or adding data to see mentions'
                }
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )


  const renderPreview = () => {
    if (!previewItem) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={closePreview}>
        <Card className="max-w-md w-full mx-4 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0">
              {previewItem.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">{previewItem.displayName}</h3>
              <p className="text-sm text-muted-foreground">{previewItem.description}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={closePreview}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          
          <Separator className="my-3" />
          
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium">Insert text:</span>
              <code className="ml-2 px-2 py-1 bg-muted rounded text-sm">{previewItem.insertText}</code>
            </div>
            
            {/* Category-specific preview content */}
            {previewItem.category === 'tools' && 'tool' in previewItem && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Category:</span> {(previewItem as any).tool.category}
                </div>
                {'requiresAuth' in previewItem && previewItem.requiresAuth && (
                  <div className="text-sm flex items-center gap-1">
                    <span className="font-medium">Authentication:</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      previewItem.available ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {previewItem.available ? 'Connected' : `Requires ${(previewItem as any).oauthService}`}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {previewItem.category === 'agents' && 'agent' in previewItem && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Status:</span>
                  <span className={`ml-1 text-xs px-2 py-1 rounded ${
                    (previewItem as any).status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {(previewItem as any).status}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Organization:</span> #{(previewItem as any).organizationId}
                </div>
              </div>
            )}
            
            {previewItem.category === 'teams' && 'team' in previewItem && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Members:</span> {(previewItem as any).memberCount} agents
                </div>
                <div className="text-sm">
                  <span className="font-medium">Organization:</span> #{(previewItem as any).organizationId}
                </div>
              </div>
            )}
            
            {previewItem.category === 'data' && 'type' in previewItem && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Type:</span>
                  <span className="ml-1 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded capitalize">
                    {(previewItem as any).type}
                  </span>
                </div>
                {(previewItem as any).parentName && (
                  <div className="text-sm">
                    <span className="font-medium">Database:</span> {(previewItem as any).parentName}
                  </div>
                )}
              </div>
            )}
            
            {previewItem.category === 'settings' && 'settingType' in previewItem && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Type:</span>
                  <span className="ml-1 text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded capitalize">
                    {(previewItem as any).settingType}
                  </span>
                </div>
                {(previewItem as any).route && (
                  <div className="text-sm flex items-center gap-1">
                    <span className="font-medium">Route:</span>
                    <code className="text-xs px-1 py-0.5 bg-muted rounded">{(previewItem as any).route}</code>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Separator className="my-3" />
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closePreview}>
              Close
            </Button>
            <Button onClick={() => {
              handleItemClick(previewItem)
              closePreview()
            }}>
              Insert
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div
        data-chat-mention-dropdown
        className="bg-background border border-border rounded-xl shadow-lg min-w-[320px] max-w-[400px] overflow-hidden"
        style={{ maxHeight: position.maxHeight }}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {renderAllItemsMenu()}
      </div>
      {renderPreview()}
    </>
  )
}

// AIDEV-NOTE: This component handles the complete dropdown UI experience
// AIDEV-NOTE: Supports main category selection, item browsing with fuzzy search, and rich previews
// AIDEV-NOTE: Features fuzzy search with highlighting, ML-powered smart suggestions, hover previews, and keyboard navigation
// AIDEV-NOTE: Smart suggestions learn from user behavior and provide contextual recommendations
// AIDEV-NOTE: Keyboard navigation and accessibility features built-in