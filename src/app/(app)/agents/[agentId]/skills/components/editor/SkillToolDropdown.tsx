'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import type { PipedreamToolMetadata } from '@/app/actions/tools';
import { AdvancedFilters } from '@/components/chat/tool-dropdown/AdvancedFilters';
import { ToolList } from '@/components/chat/tool-dropdown/ToolList';
import { useAppFilter } from '@/components/chat/hooks/useAppFilter';
import { useToolSearch } from '@/components/chat/hooks/useToolSearch';

interface SkillToolDropdownProps {
  onSelectTool: (tool: PipedreamToolMetadata) => void;
  disabled?: boolean;
}

/**
 * Tool dropdown for skill editor - reuses chat dropdown components
 * Only shows Pipedream/app tools (no reference tools like agents, tables, etc.)
 */
export function SkillToolDropdown({ onSelectTool, disabled }: SkillToolDropdownProps) {
  const [isClient, setIsClient] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Filter state - default connectedOnly to false so tools show immediately
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [requiresConnection, setRequiresConnection] = useState<boolean | undefined>(undefined);

  // Debounce search query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Fix hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // App filter management
  const appFilter = useAppFilter();

  // Tool search with infinite scroll - show only external tools (not reference tools)
  const search = useToolSearch({
    query: debouncedQuery,
    selectedCategories: [], // No reference categories
    selectedApps,
    connectedOnly,
    requiresConnection,
    showReferenceTools: false, // No reference tools (agents, tables, etc.)
    // Note: Don't filter by toolCategories - Pipedream tools have categories like
    // 'communication', 'development', etc. showReferenceTools: false is sufficient.
    isOpen: true,
    isClient,
  });

  // Convert ToolDTO to PipedreamToolMetadata for skill editor
  const handleSelectTool = (tool: ToolDTO) => {
    const pipedreamTool: PipedreamToolMetadata = {
      id: tool.name,
      app: tool.requiredApps?.[0] || '',
      name: tool.displayName,
      description: tool.description,
      type: 'action',
      inputs: tool.config?.parameters
        ? Object.fromEntries(
            Object.entries(tool.config.parameters).map(([key, param]) => [
              key,
              {
                type: (param as { type?: string }).type || 'string',
                description: (param as { description?: string }).description || '',
                required: (param as { required?: boolean }).required || false,
              }
            ])
          )
        : {},
    };
    onSelectTool(pipedreamTool);
  };

  // Compute hasActiveFilters
  const hasActiveFilters = selectedApps.length > 0 || connectedOnly || requiresConnection !== undefined;

  const clearAllFilters = () => {
    setSelectedApps([]);
    setConnectedOnly(false);
    setRequiresConnection(undefined);
  };

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

  if (!isClient) return null;

  return (
    <div className="border rounded-lg flex flex-col overflow-hidden min-h-[300px] max-h-[400px]">
      {/* Search input */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Filters header with expand toggle */}
      <div className="px-2.5 py-1.5 border-b border-border flex items-center justify-between bg-muted/30">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {filtersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Filters
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-red-500 hover:text-red-400"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Advanced Filters - collapsible */}
      {filtersExpanded && (
        <AdvancedFilters
          selectedApps={selectedApps}
          onSelectApps={setSelectedApps}
          appSearchQuery={appFilter.appSearchQuery}
          onAppSearchChange={appFilter.setAppSearchQuery}
          showAppDropdown={appFilter.showAppDropdown}
          onShowAppDropdown={appFilter.setShowAppDropdown}
          availableApps={appFilter.availableApps}
          filteredApps={appFilter.filteredApps}
          isLoadingApps={appFilter.isLoadingApps}
          connectedOnly={connectedOnly}
          onConnectedOnlyChange={setConnectedOnly}
          requiresConnection={requiresConnection}
          onRequiresConnectionChange={setRequiresConnection}
          showReferenceTools={false} // Hidden - not applicable for skill editor
          onShowReferenceToolsChange={() => {}} // No-op - not used
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
        />
      )}

      {/* Tool List with infinite scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ToolList
          tools={search.allTools}
          hasMore={search.hasMore}
          isLoading={search.isLoading}
          isLoadingMore={search.isLoadingMore}
          error={search.error}
          onLoadMore={search.loadMoreTools}
          onSelectTool={handleSelectTool}
          query={debouncedQuery}
          availableApps={appFilter.availableApps || []}
        />
      </div>
    </div>
  );
}
