'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Wrench, 
  Bot, 
  Users, 
  Settings, 
  Database,
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
  onItemSelect: (insertText: string) => void
  onCategorySelect: (category: MentionCategory) => void
  onClose: () => void
  position: DropdownPosition
}

const CATEGORY_ICON_MAP = {
  tools: Wrench,
  agents: Bot,
  teams: Users,
  settings: Settings,
  data: Database
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

  // Focus search input when submenu opens
  useEffect(() => {
    if (state.currentLevel === 'submenu' && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [state.currentLevel])

  // Reset search when category changes
  useEffect(() => {
    if (state.currentLevel === 'submenu') {
      setSearchTerm('')
      setSelectedIndex(0)
      
      // Generate smart suggestions when opening a category
      if (state.selectedCategory) {
        const suggestions = getContextualSuggestions('', items, 3)
        const categorySuggestions = suggestions.filter(s => s.category === state.selectedCategory)
        setSmartSuggestions(categorySuggestions)
      }
    }
  }, [state.selectedCategory, state.currentLevel, items])

  // Update smart suggestions when search term changes
  useEffect(() => {
    if (state.currentLevel === 'submenu' && state.selectedCategory) {
      if (searchTerm.length >= 2) {
        // Get contextual suggestions based on search term
        const suggestions = getContextualSuggestions(searchTerm, items, 3)
        const categorySuggestions = suggestions.filter(s => s.category === state.selectedCategory)
        setSmartSuggestions(categorySuggestions)
      } else {
        // Clear suggestions for short searches
        setSmartSuggestions([])
      }
    }
  }, [searchTerm, state.selectedCategory, state.currentLevel, items])

  // Filter items using fuzzy search
  const filteredItems = useMemo(() => {
    if (!state.selectedCategory || state.currentLevel !== 'submenu') return []
    
    const categoryItems = items[state.selectedCategory] || []
    if (!searchTerm.trim()) return categoryItems
    
    const searchResults = fuzzySearchEngine.search(categoryItems, searchTerm)
    return searchResults.map(result => ({
      ...result.item,
      _searchScore: result.score,
      _searchMatches: result.matches
    }))
  }, [state.selectedCategory, state.currentLevel, items, searchTerm, fuzzySearchEngine])

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (state.currentLevel === 'main') {
      // Main menu navigation
      const maxIndex = categories.length - 1
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
          if (categories[selectedIndex]) {
            handleCategorySelect(categories[selectedIndex].id)
          }
          break
        case 'Escape':
          event.preventDefault()
          onClose()
          break
      }
    } else {
      // Submenu navigation
      const totalItems = smartSuggestions.length + filteredItems.length
      const maxIndex = totalItems - 1
      
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
          if (selectedIndex < smartSuggestions.length) {
            // Selected item is in smart suggestions
            const selectedItem = smartSuggestions[selectedIndex]
            if (selectedItem) {
              handleItemClick(selectedItem)
            }
          } else {
            // Selected item is in filtered items
            const filteredIndex = selectedIndex - smartSuggestions.length
            if (filteredItems[filteredIndex]) {
              handleItemClick(filteredItems[filteredIndex])
            }
          }
          break
        case 'Escape':
          event.preventDefault()
          handleBackToMain()
          break
      }
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
    onItemSelect(item.insertText)
  }

  const handleItemPreview = (item: AnyMentionItem) => {
    setPreviewItem(item)
  }

  const closePreview = () => {
    setPreviewItem(null)
  }

  const renderMainMenu = () => (
    <div className="p-2">
      <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
        Choose a category
      </div>
      <div className="space-y-1">
        {categories.map((category, index) => {
          const IconComponent = CATEGORY_ICON_MAP[category.id]
          const itemCount = items[category.id]?.length || 0
          const isSelected = selectedIndex === index

          return (
            <button
              key={category.id}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                ${isSelected 
                  ? 'bg-primary/10 text-primary' 
                  : 'hover:bg-muted text-foreground'
                }
              `}
              onClick={() => handleCategorySelect(category.id)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <IconComponent className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{category.name}</div>
                <div className="text-xs text-muted-foreground">
                  {category.description} • {itemCount} items
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderSubmenu = () => {
    if (!state.selectedCategory) return null

    const category = categories.find(c => c.id === state.selectedCategory)
    const IconComponent = category ? CATEGORY_ICON_MAP[category.id] : Database

    return (
      <div className="flex flex-col h-full">
        {/* Submenu Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleBackToMain}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <IconComponent className="h-4 w-4" />
          <span className="font-medium text-sm">{category?.name}</span>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${category?.name.toLowerCase()}...`}
              className="pl-10 h-9"
            />
          </div>
        </div>

        {/* Items List */}
        <ScrollArea className="flex-1">
          <div className="p-2" ref={listRef}>
            {/* Smart Suggestions */}
            {smartSuggestions.length > 0 && !searchTerm && (
              <div className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  Smart suggestions
                </div>
                <div className="space-y-1">
                  {smartSuggestions.map((item, index) => {
                    const isSelected = selectedIndex === index
                    const isAvailable = item.available !== false

                    return (
                      <button
                        key={`suggestion_${item.id}`}
                        className={`
                          group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                          bg-primary/5 border border-primary/20
                          ${isSelected 
                            ? 'bg-primary/15 text-primary border-primary/30' 
                            : 'hover:bg-primary/10 text-foreground'
                          }
                          ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        onClick={() => isAvailable && handleItemClick(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        disabled={!isAvailable}
                      >
                        <div className="flex-shrink-0">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {item.displayName}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                              AI
                            </span>
                            {!isAvailable && (
                              <AlertCircle className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
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
                        </div>
                      </button>
                    )
                  })}
                </div>
                <Separator className="mt-3 mb-2" />
                <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                  All {category?.name.toLowerCase()}
                </div>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">
                  {searchTerm ? 'No items found' : `No ${category?.name.toLowerCase()} available`}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredItems.map((item, index) => {
                  const adjustedIndex = smartSuggestions.length + index
                  const isSelected = selectedIndex === adjustedIndex
                  const isAvailable = item.available !== false

                  return (
                    <button
                      key={item.id}
                      className={`
                        group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                        ${isSelected 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'hover:bg-muted text-foreground'
                        }
                        ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      onClick={() => isAvailable && handleItemClick(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      disabled={!isAvailable}
                    >
                      <div className="flex-shrink-0">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span 
                            className="font-medium text-sm truncate"
                            dangerouslySetInnerHTML={{
                              __html: (item as any)._searchMatches?.find((m: any) => m.field === 'displayName' || m.field === 'name')?.highlighted || item.displayName
                            }}
                          />
                          {!isAvailable && (
                            <AlertCircle className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        {item.description && (
                          <div 
                            className="text-xs text-muted-foreground truncate"
                            dangerouslySetInnerHTML={{
                              __html: (item as any)._searchMatches?.find((m: any) => m.field === 'description')?.highlighted || item.description
                            }}
                          />
                        )}
                        {item.metadata && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {/* Render category-specific metadata */}
                            {item.category === 'tools' && 'requiresAuth' in item && item.requiresAuth && (
                              <span className="inline-flex items-center gap-1">
                                🔐 Requires {item.oauthService}
                              </span>
                            )}
                            {item.category === 'agents' && 'status' in item && (
                              <span className={`inline-flex items-center gap-1 ${
                                item.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                              }`}>
                                • {item.status}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
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
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

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
        {state.currentLevel === 'main' ? renderMainMenu() : renderSubmenu()}
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