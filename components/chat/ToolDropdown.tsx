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
import { searchReferenceTools } from '@/app/actions/references';
import type { ReferenceDTO } from '@/app/mappers/reference-mapper';
import type { ReferenceTool } from '@/ddd/domain/tools/entities/reference-tool';
import { ReferenceCategory, REFERENCE_CATEGORY_INFO } from '@/ddd/domain/chat/value-objects/reference-types';
import { ChevronDown, Search, Loader2, FileText, Bot, Database, Table, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tool: ReferenceTool) => void;
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

  // Search tools using enhanced DDD action
  const {
    data: searchResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['search-reference-tools', query, selectedCategories],
    queryFn: async () => {
      const result = await searchReferenceTools({
        query,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        limit: 20,
        offset: 0
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: isOpen && query.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });

  const tools = searchResult?.referenceTools ?? [];

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, tools.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (tools[selectedIndex]) {
          onSelect(tools[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, selectedIndex, tools, onSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle category filter toggle
  const toggleCategory = (category: ReferenceCategory) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (!isOpen) return null;

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
          {allCategories.map(category => {
            const Icon = categoryIcons[category];
            const categoryInfo = REFERENCE_CATEGORY_INFO[category];
            const isSelected = selectedCategories.includes(category);

            return (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                  isSelected
                    ? categoryColors[category]
                    : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
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
        ) : tools.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {query.trim() ? 'No tools found' : 'Type to search tools'}
          </div>
        ) : (
          <>
            {tools.map((tool, index) => {
              const displayInfo = tool.getChatDisplayInfo();
              const Icon = categoryIcons[displayInfo.category as ReferenceCategory];
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={tool.reference.id}
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
                      categoryColors[displayInfo.category as ReferenceCategory]
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
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
        {tools.length > 0 && (
          <>
            {tools.length} tool{tools.length !== 1 ? 's' : ''}
          </>
        )}
      </div>
    </div>
  );
}