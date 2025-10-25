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
import type { ToolDefinitionData } from '@/lib/db/schema';
import { ReferenceCategory, REFERENCE_CATEGORY_INFO } from '@/ddd/domain/chat/value-objects/reference-types';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';
import { ChevronDown, Search, Loader2, FileText, Bot, Database, Table, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tool: ToolDTO) => void;
  position?: {
    top?: number;
    bottom?: number;
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

// Helper function to generate insert text with parameters
function getToolInsertTextWithParameters(tool: ToolDTO): string {
  const baseTool = tool.insertText || getToolInsertText(tool);

  // Type-safe access - no || {} needed!
  const params = tool.config.parameters;
  const paramEntries = Object.entries(params);

  if (paramEntries.length === 0) {
    return baseTool;
  }

  const required = paramEntries
    .filter(([_, p]) => p.required)
    .map(([name, _]) => `${name}: [value]`);

  const optional = paramEntries
    .filter(([_, p]) => !p.required)
    .map(([name, _]) => `${name}: [value]`);

  let result = `using ${baseTool}`;

  if (required.length > 0) {
    result += ` with ${required.join(', ')}`;
  }

  if (optional.length > 0) {
    result += ` // optional: ${optional.join(', ')}`;
  }

  return result;
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
  const [selectedApps, setSelectedApps] = useState<string[]>([]); // Changed to array for multi-select
  const [appSearchQuery, setAppSearchQuery] = useState<string>('');
  const [showAppDropdown, setShowAppDropdown] = useState(false);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [requiresConnection, setRequiresConnection] = useState<boolean | undefined>(undefined); // AIDEV-NOTE: undefined = no filter, true/false = explicit filter
  const [showReferenceTools, setShowReferenceTools] = useState(true); // Toggle reference tools visibility
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

  // Auto-hide reference tools when using app or connected-only filters
  useEffect(() => {
    if (selectedApps.length > 0 || connectedOnly) {
      setShowReferenceTools(false);
    } else if (selectedApps.length === 0 && !connectedOnly && selectedCategories.length === 0) {
      setShowReferenceTools(true);
    }
  }, [selectedApps, connectedOnly, selectedCategories]);

  // Initial search query (resets on query change)
  const {
    data: initialSearchResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['search-all-tools-initial', query, selectedCategories, selectedApps, connectedOnly, requiresConnection, showReferenceTools],
    queryFn: async () => {
      try {
        console.log(`[ToolDropdown] Initial search for query: "${query}", showReferenceTools: ${showReferenceTools}`);

        // AIDEV-NOTE: ReferenceCategory enum values are already singular ('agent', 'file', etc.)
        // Backend expects singular categories, so use them directly without mapping
        const categories = selectedCategories.length > 0 ? selectedCategories : undefined;
        const appIds = selectedApps.length > 0 ? selectedApps : undefined;

        const result = await searchAllTools({
          query,
          categories,
          appIds,
          connectedOnly,
          ...(requiresConnection !== undefined && { requiresConnection }), // Only pass if explicitly set
          showReferenceTools,
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

      // AIDEV-NOTE: Use categories directly - already singular
      const categories = selectedCategories.length > 0 ? selectedCategories : undefined;
      const appIds = selectedApps.length > 0 ? selectedApps : undefined;

      const result = await searchAllTools({
        query,
        categories,
        appIds,
        connectedOnly,
        ...(requiresConnection !== undefined && { requiresConnection }), // Only pass if explicitly set
        showReferenceTools,
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

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedApps([]);
    setAppSearchQuery('');
    setConnectedOnly(false);
    setRequiresConnection(false);
    setShowReferenceTools(true);
    console.log('[ToolDropdown] All filters cleared');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedCategories.length > 0 || selectedApps.length > 0 || connectedOnly || requiresConnection || !showReferenceTools;

  // Filter apps by search query
  const filteredApps = (availableAppsResult || []).filter(app =>
    app.name.toLowerCase().includes(appSearchQuery.toLowerCase())
  );

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
          onSelect({...selectedTool, insertText: getToolInsertTextWithParameters(selectedTool)});
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
          onSelect({...selectedTool, insertText: getToolInsertTextWithParameters(selectedTool)});
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

  // Close app dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showAppDropdown && !target.closest('.app-filter-container')) {
        setShowAppDropdown(false);
      }
    };

    if (showAppDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAppDropdown]);

  // Don't render until client-side to prevent hydration mismatch
  if (!isOpen || !isClient) return null;

  const allCategories = Object.values(ReferenceCategory);

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-[440px] flex flex-col text-gray-900"
      style={{
        ...(position?.top !== undefined ? { top: position.top } : {}),
        ...(position?.bottom !== undefined ? { bottom: position.bottom } : {}),
        left: position?.left || 0,
        maxHeight: position?.maxHeight ? `${position.maxHeight}px` : '600px',
      }}
      data-tool-dropdown
      aria-label="Toolbox"
      role="dialog"
    >
      {/* Category Filters */}
      <div className="p-2.5 border-b border-gray-100">
        <div className="flex flex-wrap gap-1.5">
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
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                  isSelected
                    ? cn(
                        categoryColors[category],
                        'ring-1 ring-offset-1 shadow-sm',
                        // Ring colors by category
                        category === ReferenceCategory.DOC && 'ring-blue-400',
                        category === ReferenceCategory.FILE && 'ring-green-400',
                        category === ReferenceCategory.AGENT && 'ring-purple-400',
                        category === ReferenceCategory.TABLE && 'ring-orange-400',
                        category === ReferenceCategory.DATABASE && 'ring-gray-400'
                      )
                    : 'text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700',
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
      <div className="px-2.5 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex flex-col gap-2 text-xs text-gray-900">
          {/* Multi-select App Filter */}
          <div className="flex items-center gap-1 flex-shrink-0 relative app-filter-container">
            <label className="text-gray-600 whitespace-nowrap">Apps:</label>
            <div className="relative flex items-center gap-1">
              {/* Selected apps badges */}
              {selectedApps.length > 0 && !showAppDropdown && (
                <div className="flex items-center gap-1">
                  {selectedApps.map(appId => {
                    const app = availableAppsResult?.find(a => a.id === appId);
                    return (
                      <span
                        key={appId}
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded"
                      >
                        {app?.name || appId}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApps(prev => prev.filter(id => id !== appId));
                          }}
                          className="hover:text-blue-900"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Search input */}
              <input
                type="text"
                value={appSearchQuery}
                onChange={(e) => {
                  setAppSearchQuery(e.target.value);
                  setShowAppDropdown(true);
                }}
                onFocus={() => setShowAppDropdown(true)}
                placeholder={isLoadingApps ? 'Loading...' : (selectedApps.length > 0 ? 'Add more...' : 'Search apps...')}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white min-w-[100px] text-gray-900 placeholder:text-gray-400"
                disabled={isLoadingApps}
              />
              {/* App dropdown with multi-select */}
              {showAppDropdown && !isLoadingApps && filteredApps.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto z-[60] min-w-[200px]">
                  {filteredApps.map((app) => {
                    const isSelected = selectedApps.includes(app.id);
                    return (
                      <button
                        key={app.id}
                        onClick={() => {
                          setSelectedApps(prev =>
                            prev.includes(app.id)
                              ? prev.filter(id => id !== app.id)
                              : [...prev, app.id]
                          );
                          setAppSearchQuery('');
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 whitespace-nowrap flex items-center justify-between text-gray-900',
                          isSelected && 'bg-blue-50 font-medium'
                        )}
                      >
                        <span>{app.name}</span>
                        {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Checkbox row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Connected Only Checkbox */}
            <label className="flex items-center gap-1 text-gray-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={connectedOnly}
                onChange={(e) => setConnectedOnly(e.target.checked)}
                className="w-3 h-3"
              />
              Connected only
            </label>

            {/* Requires Connection Checkbox */}
            <label className="flex items-center gap-1 text-gray-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={requiresConnection}
                onChange={(e) => setRequiresConnection(e.target.checked)}
                className="w-3 h-3"
              />
              OAuth required
            </label>

            {/* Show Reference Tools Checkbox */}
            <label className="flex items-center gap-1 text-gray-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showReferenceTools}
                onChange={(e) => setShowReferenceTools(e.target.checked)}
                className="w-3 h-3"
              />
              Show reference tools
            </label>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors ml-auto"
                title="Clear all filters"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>
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
                // Type-safe parameter extraction
                const params = tool.config.parameters;
                const paramEntries = Object.entries(params);

                // Simple tool display using ToolDTO interface
                const displayInfo = {
                  displayName: tool.displayName,
                  description: tool.description,
                  insertText: getToolInsertTextWithParameters(tool),
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
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {displayInfo.displayName}
                          </div>
                          {displayInfo.requiresConnection && (
                            <span className="text-xs text-orange-500 whitespace-nowrap flex-shrink-0">
                              Requires OAuth connection
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-2">
                          {displayInfo.description}
                        </div>

                        {/* Parameter display */}
                        {paramEntries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {paramEntries.map(([name, param]) => (
                              <span
                                key={name}
                                title={`${param.type}${param.description ? ': ' + param.description : ''}`}
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded cursor-help transition-colors',
                                  param.required
                                    ? 'text-red-700 bg-red-50 font-semibold hover:bg-red-100'
                                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                                )}
                              >
                                {name}{param.required ? '*' : ''}
                              </span>
                            ))}
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