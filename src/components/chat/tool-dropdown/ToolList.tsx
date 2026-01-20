import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { ToolDTO } from '@/app/mappers/tool-mapper';
import { ToolCard } from './ToolCard';
import { cn } from '@/lib/utils';

type App = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
};

interface ToolGroup {
  provider: string;
  providerApp: App | null;
  tools: ToolDTO[];
  isSystemTools: boolean;
}

interface ToolListProps {
  tools: ToolDTO[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  onLoadMore: () => void;
  onSelectTool: (tool: ToolDTO) => void;
  query: string;
  availableApps: App[];
}

/**
 * Tool results list with infinite scroll
 */
export function ToolList({
  tools,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  onLoadMore,
  onSelectTool,
  query,
  availableApps,
}: ToolListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Track expanded groups - empty set means all groups start collapsed
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [iconErrors, setIconErrors] = useState<Set<string>>(new Set());

  // Group tools by provider
  const toolGroups = useMemo(() => {
    const groups = new Map<string, ToolGroup>();

    for (const tool of tools) {
      const providerName = tool.requiredApps?.[0] || 'system';
      const isSystemTools = !tool.requiredApps || tool.requiredApps.length === 0;

      if (!groups.has(providerName)) {
        const providerApp = isSystemTools
          ? null
          : availableApps.find(app => app.id === providerName || app.name === providerName) || null;

        groups.set(providerName, {
          provider: isSystemTools ? 'System Tools' : (providerApp?.name || providerName),
          providerApp,
          tools: [],
          isSystemTools,
        });
      }

      groups.get(providerName)!.tools.push(tool);
    }

    // Sort groups: System Tools first, then alphabetically (A-Z)
    return Array.from(groups.values()).sort((a, b) => {
      if (a.isSystemTools) return -1;
      if (b.isSystemTools) return 1;
      return a.provider.localeCompare(b.provider); // A-Z alphabetical
    });
  }, [tools, availableApps]);

  const toggleGroup = useCallback((provider: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const handleIconError = useCallback((provider: string) => {
    setIconErrors(prev => new Set(prev).add(provider));
  }, []);

  // Debounced scroll handler to prevent rapid-fire triggers
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // Capture scroll values immediately (before event becomes invalid)
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce the actual load action
    scrollTimeoutRef.current = setTimeout(() => {
      // Trigger load more when within 200px of bottom and not already loading
      const nearBottom = scrollTop + clientHeight >= scrollHeight - 200;

      if (nearBottom && hasMore && !isLoadingMore && !isLoading) {
        onLoadMore();
      }
    }, 150); // 150ms debounce
  }, [hasMore, isLoadingMore, isLoading, onLoadMore]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Searching tools...</span>
        </div>
      ) : error ? (
        <div className="p-4 text-center text-sm text-red-400">
          Failed to load tools. Please try again.
        </div>
      ) : tools.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {query.trim() ? 'No tools found' : 'Type to search tools'}
        </div>
      ) : (
        <>
          {toolGroups.map((group, groupIndex) => {
            const isCollapsed = !expandedGroups.has(group.provider);
            const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;
            let toolIndex = 0;

            // Calculate starting index for this group
            for (let i = 0; i < groupIndex; i++) {
              if (expandedGroups.has(toolGroups[i].provider)) {
                toolIndex += toolGroups[i].tools.length;
              }
            }

            return (
              <div key={group.provider} className="border-b border-border/50 last:border-b-0">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.provider)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors border-b border-border/50"
                >
                  <ChevronIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  {/* Provider icon with error handling */}
                  <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {group.providerApp?.icon && !iconErrors.has(group.provider) ? (
                      <img
                        src={group.providerApp.icon}
                        alt={group.provider}
                        className="w-4 h-4 object-contain"
                        onError={() => handleIconError(group.provider)}
                      />
                    ) : null}
                  </div>

                  <span className="font-medium text-sm text-foreground flex-1 text-left truncate">
                    {group.provider}
                  </span>

                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    {group.tools.length}
                  </span>
                </button>

                {/* Group Tools */}
                {!isCollapsed && (
                  <div>
                    {group.tools.map((tool, index) => (
                      <ToolCard
                        key={`${tool.name}-${toolIndex + index}`}
                        tool={tool}
                        index={toolIndex + index}
                        isSelected={toolIndex + index === selectedIndex}
                        onSelect={onSelectTool}
                        onMouseEnter={() => setSelectedIndex(toolIndex + index)}
                        availableApps={availableApps}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex items-center justify-center p-4 border-t border-border/50">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading more tools...</span>
            </div>
          )}

          {/* Scroll for more indicator */}
          {hasMore && !isLoadingMore && tools.length >= 20 && (
            <div className="p-2 text-center text-xs text-muted-foreground border-t border-border/50">
              {tools.length} tools • Scroll for more
            </div>
          )}
        </>
      )}
    </div>
  );
}
