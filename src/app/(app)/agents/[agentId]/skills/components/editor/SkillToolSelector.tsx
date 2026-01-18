'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Loader2, X, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPipedreamApps, type PipedreamToolMetadata } from '@/app/actions/tools';
import { useSkillToolSearch } from './hooks/useSkillToolSearch';

interface SkillToolSelectorProps {
  onSelectTool: (tool: PipedreamToolMetadata) => void;
  disabled?: boolean;
}

interface AppOption {
  id: string;
  name: string;
  toolCount: number;
}

interface ToolGroup {
  app: string;
  appName: string;
  tools: PipedreamToolMetadata[];
}

/**
 * Tool selector for skill editor with infinite scroll and filtering
 * Only shows Pipedream/app tools (not reference tools)
 */
export function SkillToolSelector({ onSelectTool, disabled }: SkillToolSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // App filter state
  const [apps, setApps] = useState<AppOption[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [showAppDropdown, setShowAppDropdown] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Use the infinite scroll hook
  const search = useSkillToolSearch({
    query: debouncedQuery,
    selectedApps,
    connectedOnly,
    isOpen: true,
  });

  // Load apps on mount
  useEffect(() => {
    async function loadApps() {
      setIsLoadingApps(true);
      const result = await getPipedreamApps();
      if (result.success && result.data) {
        setApps(result.data);
      }
      setIsLoadingApps(false);
    }
    loadApps();
  }, []);

  // Filter apps based on search
  const filteredApps = useMemo(() => {
    if (!appSearchQuery.trim()) return apps;
    const searchLower = appSearchQuery.toLowerCase();
    return apps.filter(app =>
      app.name.toLowerCase().includes(searchLower) ||
      app.id.toLowerCase().includes(searchLower)
    );
  }, [apps, appSearchQuery]);

  // Group tools by app
  const toolGroups = useMemo(() => {
    const groups = new Map<string, ToolGroup>();

    for (const tool of search.allTools) {
      const appId = tool.app;
      if (!groups.has(appId)) {
        const app = apps.find(a => a.id === appId);
        groups.set(appId, {
          app: appId,
          appName: app?.name || appId.replace(/^_/, '').replace(/_/g, ' '),
          tools: [],
        });
      }
      groups.get(appId)!.tools.push(tool);
    }

    // Sort alphabetically
    return Array.from(groups.values()).sort((a, b) =>
      a.appName.localeCompare(b.appName)
    );
  }, [search.allTools, apps]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      const nearBottom = scrollTop + clientHeight >= scrollHeight - 200;

      if (nearBottom && search.hasMore && !search.isLoadingMore && !search.isLoading) {
        search.loadMoreTools();
      }
    }, 150);
  }, [search.hasMore, search.isLoadingMore, search.isLoading, search.loadMoreTools]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const toggleGroup = useCallback((app: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(app)) {
        next.delete(app);
      } else {
        next.add(app);
      }
      return next;
    });
  }, []);

  const toggleApp = (appId: string) => {
    setSelectedApps(prev =>
      prev.includes(appId)
        ? prev.filter(id => id !== appId)
        : [...prev, appId]
    );
    setAppSearchQuery('');
  };

  const removeApp = (appId: string) => {
    setSelectedApps(prev => prev.filter(id => id !== appId));
  };

  const clearAllFilters = () => {
    setSelectedApps([]);
    setConnectedOnly(true);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedApps.length > 0 || !connectedOnly;

  // Close app dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.app-filter-container')) {
        setShowAppDropdown(false);
      }
    };

    if (showAppDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAppDropdown]);

  return (
    <div className="border rounded-lg flex flex-col">
      {/* Search input */}
      <div className="p-2 border-b">
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

      {/* Filters header */}
      <div className="px-2 py-1.5 border-b flex items-center justify-between bg-muted/30">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {filtersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
              {selectedApps.length + (!connectedOnly ? 1 : 0)}
            </Badge>
          )}
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

      {/* Expanded filters */}
      {filtersExpanded && (
        <div className="px-2 py-2 border-b bg-muted/20 space-y-2">
          {/* App multi-select filter */}
          <div className="flex items-start gap-1.5 relative app-filter-container">
            <label className="text-[11px] text-muted-foreground whitespace-nowrap pt-1">Apps:</label>
            <div className="flex-1 relative">
              {/* Selected apps badges */}
              {selectedApps.length > 0 && !showAppDropdown && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {selectedApps.map(appId => {
                    const app = apps.find(a => a.id === appId);
                    return (
                      <span
                        key={appId}
                        className="inline-flex items-center gap-0.5 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded"
                      >
                        {app?.name || appId}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeApp(appId);
                          }}
                          className="hover:text-primary/70"
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
                  e.stopPropagation();
                  setAppSearchQuery(e.target.value);
                  setShowAppDropdown(true);
                }}
                onFocus={() => setShowAppDropdown(true)}
                onClick={(e) => e.stopPropagation()}
                placeholder={isLoadingApps ? 'Loading...' : (selectedApps.length > 0 ? 'Add more...' : 'Search apps...')}
                className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground"
                disabled={isLoadingApps || disabled}
              />
              {/* App dropdown */}
              {showAppDropdown && !isLoadingApps && filteredApps.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded shadow-lg max-h-36 overflow-y-auto z-50">
                  {filteredApps.slice(0, 50).map((app) => {
                    const isSelected = selectedApps.includes(app.id);
                    return (
                      <button
                        key={app.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleApp(app.id);
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1.5 text-xs hover:bg-accent flex items-center justify-between',
                          isSelected && 'bg-primary/10 font-medium'
                        )}
                      >
                        <span className="truncate">{app.name}</span>
                        <span className="text-muted-foreground text-[10px] ml-2">({app.toolCount})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Connected only checkbox */}
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={connectedOnly}
              onChange={(e) => setConnectedOnly(e.target.checked)}
              className="w-3 h-3"
              disabled={disabled}
            />
            Connected only
          </label>
        </div>
      )}

      {/* Tool list with infinite scroll */}
      <div
        ref={scrollContainerRef}
        className="max-h-[300px] overflow-y-auto"
        onScroll={handleScroll}
      >
        {search.isLoading ? (
          <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Searching...</span>
          </div>
        ) : search.error ? (
          <div className="p-4 text-center text-sm text-destructive">
            Failed to load tools
          </div>
        ) : search.allTools.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {debouncedQuery || selectedApps.length > 0 ? 'No tools found' : 'Start typing to search tools'}
          </div>
        ) : (
          <>
            {toolGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.app);
              const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

              return (
                <div key={group.app} className="border-b border-border/50 last:border-b-0">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.app)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-accent/50 transition-colors text-xs"
                  >
                    <ChevronIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {group.appName}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded ml-auto">
                      {group.tools.length}
                    </span>
                  </button>

                  {/* Group tools */}
                  {!isCollapsed && (
                    <div>
                      {group.tools.map((tool) => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => onSelectTool(tool)}
                          className={cn(
                            'w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors',
                            'focus:outline-none focus:ring-1 focus:ring-ring focus:ring-inset'
                          )}
                          disabled={disabled}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{tool.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {tool.description}
                          </div>
                          {/* Show required parameters */}
                          {Object.keys(tool.inputs).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(tool.inputs).slice(0, 4).map(([name, param]) => (
                                <span
                                  key={name}
                                  className={cn(
                                    'text-[10px] px-1 py-0.5 rounded',
                                    param.required
                                      ? 'text-red-500 bg-red-500/10'
                                      : 'text-muted-foreground bg-muted'
                                  )}
                                >
                                  {name}{param.required ? '*' : ''}
                                </span>
                              ))}
                              {Object.keys(tool.inputs).length > 4 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{Object.keys(tool.inputs).length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading more indicator */}
            {search.isLoadingMore && (
              <div className="flex items-center justify-center p-3 border-t border-border/50">
                <Loader2 className="w-3 h-3 animate-spin mr-2" />
                <span className="text-xs text-muted-foreground">Loading more...</span>
              </div>
            )}

            {/* Scroll for more hint */}
            {search.hasMore && !search.isLoadingMore && search.allTools.length >= 20 && (
              <div className="p-2 text-center text-[10px] text-muted-foreground border-t border-border/50">
                {search.allTools.length} tools loaded • Scroll for more
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
