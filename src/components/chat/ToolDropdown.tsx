'use client';

/**
 * Tool Dropdown Component
 *
 * Unified dropdown for selecting ReferenceTool objects with proper domain typing.
 * Uses enhanced DDD searchReferenceTools action with Tool domain integration.
 * Positioned above input since chat is at bottom of screen.
 *
 * AIDEV-NOTE: Now works with proper Tool domain objects instead of legacy references.
 * ReferenceTool provides type-safe configs and unified tool/reference architecture.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchAllTools } from '@/src/app/actions/references';
import type { ReferenceToolDTO } from '@/src/app/mappers/reference-tool-mapper';
import type { ToolDTO, ToolSearchResultDTO } from '@/src/app/mappers/tool-mapper';
import { ReferenceCategory, REFERENCE_CATEGORY_INFO } from '@/src/ddd/domain/chat/value-objects/reference-types';
import { ChevronDown, Search, Loader2, FileText, Bot, Database, Table, File } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface ToolDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tool: ReferenceToolDTO | ToolDTO) => void;
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

export function ToolDropdown({
  query,
  isOpen,
  onClose,
  onSelect,
  position
}: ToolDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<ReferenceCategory[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(-1);
  const [isInCategoryMode, setIsInCategoryMode] = useState(false);

  // Fix hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Search tools using enhanced DDD action
  const {
    data: searchResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['search-all-tools', query, selectedCategories],
    queryFn: async () => {
      try {
        console.log(`[ToolDropdown] Searching with query: "${query}", categories:`, selectedCategories);
        const result = await searchAllTools({
          query,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          limit: 20,
          offset: 0
        });

        if (!result.success) {
          console.error('[ToolDropdown] Search failed:', result.error);
          throw new Error(result.error);
        }

        console.log('[ToolDropdown] Search successful:', result.data?.referenceTools?.length || 0, 'reference tools,', result.data?.systemTools?.length || 0, 'system tools found');
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

  // Combine and categorize all tools
  const allTools: (ReferenceToolDTO | ToolDTO)[] = [
    ...(searchResult?.systemTools ?? []),
    ...(searchResult?.referenceTools ?? [])
  ];

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

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    const allCategories = Object.values(ReferenceCategory);

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        if (!isInCategoryMode) {
          setIsInCategoryMode(true);
          setFocusedCategoryIndex(0);
        } else {
          setFocusedCategoryIndex(prev =>
            prev < allCategories.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
          setSelectedIndex(0);
        } else {
          setSelectedIndex(prev => {
            const newIndex = Math.min(prev + 1, allTools.length - 1);
            // Scroll into view
            setTimeout(() => {
              const element = document.querySelector(`[data-tool-item-index="${newIndex}"]`);
              element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 0);
            return newIndex;
          });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
          setSelectedIndex(allTools.length - 1);
        } else {
          setSelectedIndex(prev => {
            const newIndex = Math.max(prev - 1, 0);
            // Scroll into view
            setTimeout(() => {
              const element = document.querySelector(`[data-tool-item-index="${newIndex}"]`);
              element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 0);
            return newIndex;
          });
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isInCategoryMode && focusedCategoryIndex >= 0) {
          const category = allCategories[focusedCategoryIndex];
          toggleCategory(category);
        } else if (allTools[selectedIndex]) {
          onSelect(allTools[selectedIndex]);
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
    >
      {/* Category Filters */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex flex-wrap gap-2">
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
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
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

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
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
                // Check if it's a reference tool or system tool
                const isReferenceTool = 'toolName' in tool;

                // Create display info based on tool type
                const displayInfo = isReferenceTool ? {
                  displayName: tool.displayName || 'Unknown Tool',
                  description: tool.description || 'Tool description not available',
                  insertText: tool.insertText || '@unknown',
                  category: tool.category || ReferenceCategory.DOC,
                  supportsArtifacts: tool.supportsArtifacts || false
                } : {
                  displayName: tool.displayName || 'Unknown Tool',
                  description: tool.description || 'Tool description not available',
                  insertText: `@tool:${tool.name}`,
                  category: tool.category,
                  supportsArtifacts: false
                };

                const Icon = isReferenceTool
                  ? (categoryIcons[displayInfo.category as ReferenceCategory] || FileText)
                  : FileText; // Default for system tools
                const isSelected = index === selectedIndex;
                // Create unique key based on tool type and ID/name + index to ensure uniqueness
                const toolId = isReferenceTool
                  ? `ref-${tool.toolName || 'unknown'}-${tool.id || 'no-id'}-${index}`
                  : `sys-${tool.name || 'unknown'}-${index}`;

                return (
                  <button
                    key={toolId}
                    data-tool-item-index={index}
                    onClick={() => onSelect(tool)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors',
                      isSelected && 'bg-blue-50 border-blue-100'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'p-1 rounded-md flex-shrink-0',
                        categoryColors[displayInfo.category as ReferenceCategory] || 'text-gray-600 bg-gray-50'
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
                        {displayInfo.supportsArtifacts && (
                          <div className="text-xs text-blue-500 mt-1">
                            Can open as artifact
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
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
        {allTools.length > 0 && (
          <>
            {allTools.length} tool{allTools.length !== 1 ? 's' : ''}
          </>
        )}
      </div>
    </div>
  );
}