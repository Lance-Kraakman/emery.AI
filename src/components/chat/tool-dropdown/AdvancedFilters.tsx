import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvailableApp {
  id: string;
  name: string;
}

interface AdvancedFiltersProps {
  // App filter
  selectedApps: string[];
  onSelectApps: (apps: string[]) => void;
  appSearchQuery: string;
  onAppSearchChange: (query: string) => void;
  showAppDropdown: boolean;
  onShowAppDropdown: (show: boolean) => void;
  availableApps?: AvailableApp[];
  filteredApps: AvailableApp[];
  isLoadingApps: boolean;

  // Checkbox filters
  connectedOnly: boolean;
  onConnectedOnlyChange: (value: boolean) => void;
  requiresConnection: boolean | undefined;
  onRequiresConnectionChange: (value: boolean | undefined) => void;
  showReferenceTools: boolean;
  onShowReferenceToolsChange: (value: boolean) => void;

  // Clear all
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

/**
 * Advanced filters section (apps, checkboxes, clear all)
 */
export function AdvancedFilters({
  selectedApps,
  onSelectApps,
  appSearchQuery,
  onAppSearchChange,
  showAppDropdown,
  onShowAppDropdown,
  availableApps,
  filteredApps,
  isLoadingApps,
  connectedOnly,
  onConnectedOnlyChange,
  requiresConnection,
  onRequiresConnectionChange,
  showReferenceTools,
  onShowReferenceToolsChange,
  hasActiveFilters,
  onClearAll,
}: AdvancedFiltersProps) {
  const toggleApp = (appId: string) => {
    onSelectApps(
      selectedApps.includes(appId)
        ? selectedApps.filter(id => id !== appId)
        : [...selectedApps, appId]
    );
    onAppSearchChange('');
  };

  const removeApp = (appId: string) => {
    onSelectApps(selectedApps.filter(id => id !== appId));
  };

  return (
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
                  const app = availableApps?.find(a => a.id === appId);
                  return (
                    <span
                      key={appId}
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded"
                    >
                      {app?.name || appId}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeApp(appId);
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
                onAppSearchChange(e.target.value);
                onShowAppDropdown(true);
              }}
              onFocus={() => onShowAppDropdown(true)}
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
                      onClick={() => toggleApp(app.id)}
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
              onChange={(e) => onConnectedOnlyChange(e.target.checked)}
              className="w-3 h-3"
            />
            Connected only
          </label>

          {/* Requires Connection Checkbox */}
          <label className="flex items-center gap-1 text-gray-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={requiresConnection === true}
              onChange={(e) => onRequiresConnectionChange(e.target.checked ? true : undefined)}
              className="w-3 h-3"
            />
            OAuth required
          </label>

          {/* Show Reference Tools Checkbox */}
          <label className="flex items-center gap-1 text-gray-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showReferenceTools}
              onChange={(e) => onShowReferenceToolsChange(e.target.checked)}
              className="w-3 h-3"
            />
            Show reference tools
          </label>

          {/* Clear All Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
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
  );
}
