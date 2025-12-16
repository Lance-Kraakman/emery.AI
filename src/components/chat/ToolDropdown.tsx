'use client';

/**
 * Tool Dropdown Component (Refactored)
 *
 * Unified dropdown for selecting tools with proper domain typing.
 * Uses custom hooks and sub-components for better organization.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { getToolInsertTextWithParameters } from './tool-dropdown/utils';
import { useToolFilters } from './hooks/useToolFilters';
import { useAppFilter } from './hooks/useAppFilter';
import { useToolSearch } from './hooks/useToolSearch';
import { CategoryFilters } from './tool-dropdown/CategoryFilters';
import { AdvancedFilters } from './tool-dropdown/AdvancedFilters';
import { ToolList } from './tool-dropdown/ToolList';

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

export function ToolDropdown({
  query,
  isOpen,
  onClose,
  onSelect,
  position
}: ToolDropdownProps) {
  const [isClient, setIsClient] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(-1);
  const [isInCategoryMode, setIsInCategoryMode] = useState(false);

  // Fix hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter state management
  const filters = useToolFilters();

  // App filter management
  const appFilter = useAppFilter();

  // Tool search with infinite scroll
  const search = useToolSearch({
    query,
    selectedCategories: filters.selectedCategories,
    selectedApps: filters.selectedApps,
    connectedOnly: filters.connectedOnly,
    requiresConnection: filters.requiresConnection,
    showReferenceTools: filters.showReferenceTools,
    isOpen,
    isClient,
  });

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search.allTools]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        if (search.allTools[selectedIndex]) {
          const selectedTool = search.allTools[selectedIndex];
          onSelect({ ...selectedTool, insertText: getToolInsertTextWithParameters(selectedTool) });
        } else {
          onClose();
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
        }
        setSelectedIndex(prev => {
          const newIndex = Math.min(prev + 1, search.allTools.length - 1);
          setTimeout(() => {
            const element = document.querySelector(`[data-tool-item-index="${newIndex}"]`);
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return newIndex;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isInCategoryMode) {
          setIsInCategoryMode(false);
          setFocusedCategoryIndex(-1);
        }
        setSelectedIndex(prev => {
          const newIndex = Math.max(prev - 1, 0);
          setTimeout(() => {
            const element = document.querySelector(`[data-tool-item-index="${newIndex}"]`);
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return newIndex;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (search.allTools[selectedIndex]) {
          const selectedTool = search.allTools[selectedIndex];
          onSelect({ ...selectedTool, insertText: getToolInsertTextWithParameters(selectedTool) });
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
  }, [isOpen, selectedIndex, search.allTools, onSelect, onClose, isInCategoryMode]);

  // Attach keyboard listener
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
      if (!target.closest('.app-filter-container')) {
        appFilter.setShowAppDropdown(false);
      }
    };

    if (appFilter.showAppDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [appFilter.showAppDropdown]);

  if (!isOpen || !isClient) return null;

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-[440px] flex flex-col text-gray-900"
      style={{
        ...(position?.top !== undefined ? { top: position.top } : {}),
        ...(position?.bottom !== undefined ? { bottom: position.bottom } : {}),
        left: position?.left || 0,
        height: position?.maxHeight ? `${position.maxHeight}px` : '600px',
      }}
      data-tool-dropdown
      aria-label="Toolbox"
      role="dialog"
    >
      {/* Category Filters */}
      <CategoryFilters
        selectedCategories={filters.selectedCategories}
        onToggleCategory={filters.toggleCategory}
        focusedIndex={focusedCategoryIndex}
        isInCategoryMode={isInCategoryMode}
      />

      {/* Advanced Filters */}
      <AdvancedFilters
        selectedApps={filters.selectedApps}
        onSelectApps={filters.setSelectedApps}
        appSearchQuery={appFilter.appSearchQuery}
        onAppSearchChange={appFilter.setAppSearchQuery}
        showAppDropdown={appFilter.showAppDropdown}
        onShowAppDropdown={appFilter.setShowAppDropdown}
        availableApps={appFilter.availableApps}
        filteredApps={appFilter.filteredApps}
        isLoadingApps={appFilter.isLoadingApps}
        connectedOnly={filters.connectedOnly}
        onConnectedOnlyChange={filters.setConnectedOnly}
        requiresConnection={filters.requiresConnection}
        onRequiresConnectionChange={filters.setRequiresConnection}
        showReferenceTools={filters.showReferenceTools}
        onShowReferenceToolsChange={filters.setShowReferenceTools}
        hasActiveFilters={filters.hasActiveFilters}
        onClearAll={filters.clearAllFilters}
      />

      {/* Results */}
      <ToolList
        tools={search.allTools}
        hasMore={search.hasMore}
        isLoading={search.isLoading}
        isLoadingMore={search.isLoadingMore}
        error={search.error}
        onLoadMore={search.loadMoreTools}
        onSelectTool={onSelect}
        query={query}
        availableApps={appFilter.availableApps || []}
      />
    </div>
  );
}
