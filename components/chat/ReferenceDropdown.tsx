'use client';

/**
 * Consolidated Reference Dropdown Component
 * 
 * Single UI component for all reference display and interaction.
 * Uses TanStack Query for efficient server state management.
 * 
 * AIDEV-NOTE: This replaces the scattered TanStack Store complexity with
 * clean client-side state management using proper TanStack Query patterns.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { searchReferences, getReferenceCategories, type SearchReferencesParams } from '@/app/actions/search-references';
import type { SimpleReference, SearchReferencesResult } from '@/ddd/application/services/chat/reference-application-service';
import { ChevronDown, Search, Loader2, FileText, Bot, Database, Table, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReferenceDropdownProps {
  query: string;
  organizationId: number;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reference: SimpleReference) => void;
  position?: {
    top: number;
    left: number;
    maxHeight?: number;
  };
}

const categoryIcons = {
  doc: FileText,
  file: File,
  agent: Bot,
  table: Table,
  database: Database,
} as const;

const categoryColors = {
  doc: 'text-blue-600 bg-blue-50',
  file: 'text-green-600 bg-green-50', 
  agent: 'text-purple-600 bg-purple-50',
  table: 'text-orange-600 bg-orange-50',
  database: 'text-gray-600 bg-gray-50',
} as const;

export function ReferenceDropdown({
  query,
  organizationId,
  isOpen,
  onClose,
  onSelect,
  position
}: ReferenceDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Get available categories
  const { data: categories = [] } = useQuery({
    queryKey: ['reference-categories'],
    queryFn: getReferenceCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Search references with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['search-references', query, selectedCategories, organizationId],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const params: SearchReferencesParams = {
        query,
        organizationId,
        limit: 20,
        offset: pageParam,
        categories: selectedCategories.length > 0 
          ? selectedCategories as ('doc' | 'file' | 'agent' | 'table' | 'database')[]
          : undefined
      };
      return searchReferences(params);
    },
    getNextPageParam: (lastPage: SearchReferencesResult, pages) => {
      if (!lastPage.hasMore) return undefined;
      return pages.length * 20; // Calculate next offset
    },
    initialPageParam: 0,
    enabled: isOpen && query.length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Flatten all pages into single array
  const allReferences = data?.pages.flatMap(page => page.references) ?? [];

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
        setSelectedIndex(prev => Math.min(prev + 1, allReferences.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allReferences[selectedIndex]) {
          onSelect(allReferences[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, selectedIndex, allReferences, onSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle category filter toggle
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Load more when scrolling near bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    if (scrollTop + clientHeight >= scrollHeight - 50 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-96 max-w-2xl h-96 flex flex-col"
      style={{
        top: position?.top || 0,
        left: position?.left || 0,
      }}
      data-chat-search-dropdown
    >
      {/* Category Filters */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => {
            const Icon = categoryIcons[category.id];
            const isSelected = selectedCategories.includes(category.id);
            
            return (
              <button
                key={category.id}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                  isSelected
                    ? categoryColors[category.id]
                    : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                )}
              >
                <Icon className="w-3 h-3" />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm text-gray-500">Searching references...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-red-600">
            Failed to load references. Please try again.
          </div>
        ) : allReferences.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {query.trim() ? 'No references found' : 'Type to search references'}
          </div>
        ) : (
          <>
            {allReferences.map((reference, index) => {
              const Icon = categoryIcons[reference.category as keyof typeof categoryIcons];
              const isSelected = index === selectedIndex;
              
              return (
                <button
                  key={reference.id}
                  onClick={() => onSelect(reference)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors',
                    isSelected && 'bg-blue-50 border-blue-100'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'p-1 rounded-md flex-shrink-0',
                      categoryColors[reference.category as keyof typeof categoryColors]
                    )}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {reference.displayName}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {reference.description}
                      </div>
                      <div className="text-xs text-gray-400 mt-1 font-mono">
                        {reference.insertText}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            
            {/* Load More Indicator */}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center p-3 border-t border-gray-100">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Loading more...</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-center">
        {allReferences.length > 0 && (
          <>
            {allReferences.length} result{allReferences.length !== 1 ? 's' : ''}
            {hasNextPage && ' • Scroll for more'}
          </>
        )}
      </div>
    </div>
  );
}