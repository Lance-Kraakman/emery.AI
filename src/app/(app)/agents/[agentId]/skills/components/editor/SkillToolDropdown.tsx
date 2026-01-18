'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [searchQuery] = useState(''); // Empty search to load all tools

  // Filter state - default connectedOnly to false so tools show immediately
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const [requiresConnection, setRequiresConnection] = useState<boolean | undefined>(undefined);

  // Fix hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // App filter management
  const appFilter = useAppFilter();

  // Tool search with infinite scroll - fixed to only show app tools
  const search = useToolSearch({
    query: searchQuery,
    selectedCategories: [], // No reference categories
    selectedApps,
    connectedOnly,
    requiresConnection,
    showReferenceTools: false, // FIXED: no reference tools
    toolCategories: ['apps'], // FIXED: only Pipedream/app tools
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
    <div className="border rounded-lg flex flex-col overflow-hidden">
      {/* Header with expand toggle */}
      <div className="px-2.5 py-2 border-b border-border flex items-center justify-between bg-muted/30">
        <span className="text-sm font-medium text-foreground">Select Tool</span>
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title={filtersExpanded ? 'Hide filters' : 'Show filters'}
        >
          {filtersExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
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
      <ToolList
        tools={search.allTools}
        hasMore={search.hasMore}
        isLoading={search.isLoading}
        isLoadingMore={search.isLoadingMore}
        error={search.error}
        onLoadMore={search.loadMoreTools}
        onSelectTool={handleSelectTool}
        query={searchQuery}
        availableApps={appFilter.availableApps || []}
      />
    </div>
  );
}
