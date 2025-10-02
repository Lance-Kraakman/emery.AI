'use client';

/**
 * Toolbox Component (Tool Dropdown)
 *
 * Unified dropdown for selecting ReferenceTool objects with proper domain typing.
 * Uses enhanced DDD searchReferenceTools action with Tool domain integration.
 * Positioned above input since chat is at bottom of screen.
 *
 * AIDEV-NOTE: Now works with proper Tool domain objects instead of legacy references.
 * ReferenceTool provides type-safe configs and unified tool/reference architecture.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchAllTools } from '@/app/actions/tools';
import { getAvailableApps } from '@/app/actions/connections';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { ReferenceCategory, REFERENCE_CATEGORY_INFO } from '@/ddd/domain/chat/value-objects/reference-types';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';
import { ChevronDown, Search, Loader2, FileText, Bot, Database, Table, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tool: ToolDTO) => void;
  position?: {
    top: number;
    left: number;
    maxHeight?: number;
  };
}

const categoryIcons = {
  [ReferenceCategory.DOC]: FileText,
  [ReferenceCategory.FILE]: File,
  [ReferenceCategory.AGENT]: Bot,
  [ReferenceCategory.TABLE]: Table,
  [ReferenceCategory.DATABASE]: Database,
} as const;

const categoryColors = {
  [ReferenceCategory.DOC]: 'text-blue-600 bg-blue-50',
  [ReferenceCategory.FILE]: 'text-green-600 bg-green-50',
  [ReferenceCategory.AGENT]: 'text-purple-600 bg-purple-50',
  [ReferenceCategory.TABLE]: 'text-orange-600 bg-orange-50',
  [ReferenceCategory.DATABASE]: 'text-gray-600 bg-gray-50',
} as const;

// Helper functions for @ prefix filtering
function detectCategoryFromQuery(query: string): ReferenceCategory | null {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '@doc' || trimmed === '@document') return ReferenceCategory.DOC;
  if (trimmed === '@file') return ReferenceCategory.FILE;
  if (trimmed === '@agent') return ReferenceCategory.AGENT;
  if (trimmed === '@table') return ReferenceCategory.TABLE;
  if (trimmed === '@database') return ReferenceCategory.DATABASE;
  return null;
}

function getUnifiedCategory(referenceCategory: ReferenceCategory): ToolCategory {
  switch (referenceCategory) {
    case ReferenceCategory.DOC: return ToolCategory.DOCUMENTS;
    case ReferenceCategory.FILE: return ToolCategory.FILES;
    case ReferenceCategory.AGENT: return ToolCategory.AGENTS;
    case ReferenceCategory.TABLE: return ToolCategory.TABLES;
    case ReferenceCategory.DATABASE: return ToolCategory.DATABASES;
    default: return ToolCategory.BASE;
  }
}

// Helper function to get correct insertText for tools
function getToolInsertText(tool: ToolDTO): string {
  // Use tool's insertText if available
  if (tool.insertText) return tool.insertText;

  // Generate category-specific insert text for reference tools
  if (tool.type === 'reference') {
    switch (tool.category) {
      case 'documents': return `@doc:${tool.name}`;
      case 'files': return `@file:${tool.name}`;
      case 'agents': return `@agent:${tool.name}`;
      case 'tables': return `@table:${tool.name}`;
      case 'databases': return `@database:${tool.name}`;
      default: return `@tool:${tool.name}`;
    }
  }

  // System tools use @tool: prefix
  return `@tool:${tool.name}`;
}

export function ToolDropdown({
  query,
  isOpen,
  onClose,
  onSelect,
  position
}: ToolDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<ReferenceCategory[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [requiresConnection, setRequiresConnection] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(-1);
  const [isInCategoryMode, setIsInCategoryMode] = useState(false);

  // Infinite scroll state
  const [allTools, setAllTools] = useState<ToolDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fix hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initial search query (resets on query change)
  const {
    data: initialSearchResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['search-all-tools-initial', query, selectedCategories, selectedApp, connectedOnly, requiresConnection],
    queryFn: async () => {
      try {
        console.log(`[ToolDropdown] Initial search for query: "${query}"`);

        // Map ReferenceCategory to ToolCategory for unified search
        const toolCategories = selectedCategories.length > 0 ? selectedCategories.map(refCat => {
          switch (refCat) {
            case ReferenceCategory.DOC: return 'documents';
            case ReferenceCategory.FILE: return 'files';
            case ReferenceCategory.AGENT: return 'agents';
            case ReferenceCategory.TABLE: return 'tables';
            case ReferenceCategory.DATABASE: return 'databases';
            default: return refCat;
          }
        }) : undefined;

        const result = await searchAllTools({
          query,
          toolCategories,
          appId: selectedApp || undefined,
          connectedOnly,
          requiresConnection,
          limit: 20,
          offset: 0
        });

        if (!result.success) {
          console.error('[ToolDropdown] Search failed:', result.error);
          throw new Error(result.error);
        }

        console.log('[ToolDropdown] Initial search found', result.data?.tools?.length || 0, 'tools');
        console.log('[ToolDropdown] Initial search result:', {
          toolsCount: result.data?.tools?.length || 0,
          hasMore: result.data?.hasMore,
          totalCount: result.data?.totalCount,
          tools: result.data?.tools?.map(t => ({ name: t.name, type: t.type, category: t.category }))
        });
        return result.data;
      } catch (error) {
        console.error('[ToolDropdown] Search error:', error);
        throw error;
      }
    },
    enabled: isOpen && isClient,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });

  // Query for available apps
  const {
    data: availableAppsResult,
    isLoading: isLoadingApps,
  } = useQuery({
    queryKey: ['available-apps'],
    queryFn: async () => {
      try {
        console.log('[ToolDropdown] Loading available apps...');
        const result = await getAvailableApps();

        if (!result.success) {
          console.error('[ToolDropdown] Failed to load apps:', result.error);
          throw new Error(result.error);
        }

        console.log(`[ToolDropdown] Loaded ${result.data?.length || 0} available apps`);
        return result.data || [];
      } catch (error) {
        console.error('[ToolDropdown] Error loading apps:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - apps don't change often
    retry: 1,
  });

  // Reset tools and state when query changes
  useEffect(() => {
    if (initialSearchResult) {
      setAllTools(initialSearchResult.tools || []);
      setHasMore(initialSearchResult.hasMore || false);
      setOffset(initialSearchResult.tools?.length || 0);
      setSelectedIndex(0);
      console.log(`[ToolDropdown] Reset state for new query:`, {
        toolsCount: (initialSearchResult.tools || []).length,
        hasMore: initialSearchResult.hasMore,
        totalCount: initialSearchResult.totalCount,
        searchResult: initialSearchResult
      });
    }
  }, [initialSearchResult]);

  // Load more tools function
  const loadMoreTools = useCallback(async () => {
    if (isLoadingMore || !hasMore || !isClient) return;

    setIsLoadingMore(true);
    try {
      console.log(`[ToolDropdown] Loading more tools with offset: ${offset}, query: "${query}"`);

      // Map ReferenceCategory to ToolCategory for unified search
      const toolCategories = selectedCategories.length > 0 ? selectedCategories.map(refCat => {
        switch (refCat) {
          case ReferenceCategory.DOC: return 'documents';
          case ReferenceCategory.FILE: return 'files';
          case ReferenceCategory.AGENT: return 'agents';
          case ReferenceCategory.TABLE: return 'tables';
          case ReferenceCategory.DATABASE: return 'databases';
          default: return refCat;
        }
      }) : undefined;

      const result = await searchAllTools({
        query,
        toolCategories,
        appId: selectedApp || undefined,
        connectedOnly,
        requiresConnection,
        limit: 20,
        offset
      });

      console.log(`[ToolDropdown] Load more result:`, {
        success: result.success,
        toolsCount: result.data?.tools?.length || 0,
        hasMore: result.data?.hasMore,
        totalCount: result.data?.totalCount,
        offset: offset,
        query: query
      });

      if (result.success && result.data) {
        const newTools = result.data.tools || [];
        setAllTools(prev => {
          const newTotal = [...prev, ...newTools];
          console.log(`[ToolDropdown] Loaded ${newTools.length} more tools. Total: ${newTotal.length}, hasMore: ${result.data?.hasMore}`);
          return newTotal;
        });
        setHasMore(result.data.hasMore || false);
        setOffset(prev => prev + newTools.length);
      } else {
        console.error('[ToolDropdown] Load more failed:', result.error);
      }
    } catch (error) {
      console.error('[ToolDropdown] Error loading more tools:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [query, offset, hasMore, isLoadingMore, isClient]);

  // Scroll detection for infinite scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // Trigger load more when within 100px of bottom
    const nearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    console.log(`[ToolDropdown] Scroll detection:`, {
      scrollTop: Math.round(scrollTop),
      scrollHeight,
      clientHeight,
      nearBottom,
      hasMore,
      isLoadingMore,
      totalTools: allTools.length
    });

    if (nearBottom && hasMore && !isLoadingMore) {
      console.log(`[ToolDropdown] Triggering loadMoreTools from scroll`);
      loadMoreTools();
    }
  }, [hasMore, isLoadingMore, loadMoreTools, allTools.length]);

  // Handle category filter toggle
  const toggleCategory = (category: ReferenceCategory) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      console.log(`[ToolDropdown] Category filter toggled: ${category}, new filters:`, newCategories);
      return newCategories;
    });
  };


  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    const allCategories = Object.values(ReferenceCategory);

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        // Tab key should select the current tool and close dropdown
        if (allTools[selectedIndex]) {
          const selectedTool = allTools[selectedIndex];
          onSelect({...selectedTool, insertText: getToolInsertText(selectedTool)});
        } else {
          // If no tool is selected, close dropdown without selection
          onClose();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Remove category mode logic since Tab no longer enters category mode
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
        }
        setSelectedIndex(prev => {
          const newIndex = Math.min(prev + 1, allTools.length - 1);
          // Scroll into view
          setTimeout(() => {
            const element = document.querySelector(`[data-tool-item-index="${newIndex}"]`);
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        // Remove category mode logic since Tab no longer enters category mode
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
        }
        setSelectedIndex(prev => {
          const newIndex = Math.max(prev - 1, 0);
          // Scroll into view
          setTimeout(() => {
            const element = document.querySelector(`[data-tool-item-index="${newIndex}"]`);
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return newIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        // Enter key selects the currently highlighted tool
        if (allTools[selectedIndex]) {
          const selectedTool = allTools[selectedIndex];
          onSelect({...selectedTool, insertText: getToolInsertText(selectedTool)});
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
        } else {
          onClose();
        }
        break;
    }
  }, [isOpen, selectedIndex, allTools, onSelect, onClose, isInCategoryMode, focusedCategoryIndex, toggleCategory]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Don't render until client-side to prevent hydration mismatch
  if (!isOpen || !isClient) return null;

  const allCategories = Object.values(ReferenceCategory);

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-96 max-w-2xl h-96 flex flex-col"
      style={{
        top: position?.top || 0,
        left: position?.left || 0,
      }}
      data-tool-dropdown
      aria-label="Toolbox"
      role="dialog"
    >
      {/* Category Filters */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-1">
          {allCategories.map((category, index) => {
            const Icon = categoryIcons[category];
            const categoryInfo = REFERENCE_CATEGORY_INFO[category];
            const isSelected = selectedCategories.includes(category);
            const isFocused = isInCategoryMode && focusedCategoryIndex === index;

            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0',
                  isSelected
                    ? categoryColors[category]
                    : 'text-gray-500 bg-gray-50 hover:bg-gray-100',
                  isFocused && 'ring-2 ring-blue-500 ring-offset-1'
                )}
                title={categoryInfo.description}
              >
                <Icon className="w-3 h-3" />
                {categoryInfo.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {/* App Filter */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <label className="text-gray-600 whitespace-nowrap">App:</label>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white min-w-[80px]"
              disabled={isLoadingApps}
            >
              <option value="">
                {isLoadingApps ? 'Loading...' : 'All'}
              </option>
              {availableAppsResult?.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* Connected Only Checkbox */}
          <label className="flex items-center gap-1 text-gray-600 cursor-pointer flex-shrink-0 whitespace-nowrap">
            <input
              type="checkbox"
              checked={connectedOnly}
              onChange={(e) => setConnectedOnly(e.target.checked)}
              className="w-3 h-3"
            />
            Connected only
          </label>

          {/* Requires Connection Checkbox */}
          <label className="flex items-center gap-1 text-gray-600 cursor-pointer flex-shrink-0 whitespace-nowrap">
            <input
              type="checkbox"
              checked={requiresConnection}
              onChange={(e) => setRequiresConnection(e.target.checked)}
              className="w-3 h-3"
            />
            Needs auth
          </label>
        </div>
      </div>

      {/* Results */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-gray-500">Searching tools...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-red-600">
            Failed to load tools. Please try again.
          </div>
        ) : allTools.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {query.trim() ? 'No tools found' : 'Type to search tools'}
          </div>
        ) : (
          <>
            {allTools.map((tool, index) => {
              try {
                // Simple tool display using ToolDTO interface
                const displayInfo = {
                  displayName: tool.displayName,
                  description: tool.description,
                  insertText: getToolInsertText(tool),
                  category: tool.category,
                  requiresConnection: tool.requiresConnection,
                  icon: tool.icon
                };

                // Use tool icon or default
                let Icon = FileText; // Default icon
                if (tool.icon) {
                  // For now, use default icon. Could map emoji to icons later
                  Icon = FileText;
                }

                const isSelected = index === selectedIndex;
                const toolId = `tool-${tool.name}-${index}`;

                return (
                  <button
                    key={toolId}
                    data-tool-item-index={index}
                    onClick={() => onSelect({...tool, insertText: displayInfo.insertText})}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors',
                      isSelected && 'bg-blue-50 border-blue-100'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-1 rounded-md flex-shrink-0',
                        'text-gray-600 bg-gray-50' // Simple styling
                      )}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {displayInfo.displayName}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {displayInfo.description}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 font-mono">
                          {displayInfo.insertText}
                        </div>
                        {displayInfo.requiresConnection && (
                          <div className="text-xs text-orange-500 mt-1">
                            Requires OAuth connection
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              } catch (error) {
                console.error('[ToolDropdown] Error rendering tool:', error, tool);
                return (
                  <div key={`error-${index}`} className="px-4 py-3 text-xs text-red-500">
                    Error rendering tool
                  </div>
                );
              }
            })}

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center p-4 border-t border-gray-100">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Loading more tools...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
        {allTools.length > 0 && (
          <>
            {allTools.length} tool{allTools.length !== 1 ? 's' : ''}
            {hasMore && ' • Scroll for more'}
          </>
        )}
      </div>
    </div>
  );
}